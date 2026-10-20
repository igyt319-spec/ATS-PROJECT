const db = require('../config/db');
const { logAuditEvent } = require('../utils/auditLogger');

function calculateGradeAndStatus(total) {
  let grade = 'F';
  let status = 'Weak';

  if (total >= 90) {
    grade = 'A+';
    status = 'Strong';
  } else if (total >= 80) {
    grade = 'A';
    status = 'Strong';
  } else if (total >= 70) {
    grade = 'B+';
    status = 'Average';
  } else if (total >= 60) {
    grade = 'B';
    status = 'Average';
  } else if (total >= 50) {
    grade = 'C';
    status = 'Weak';
  } else {
    grade = 'F';
    status = 'Weak';
  }

  return { grade, status };
}

async function getGradeRules() {
  try {
    const [rows] = await db.query('SELECT minimum_mark,grade,grade_point,performance_status FROM grading_rules ORDER BY minimum_mark DESC');
    if (rows.length) return rows;
  } catch (_) {}
  return [{minimum_mark:90,grade:'A+',grade_point:10,performance_status:'Strong'},{minimum_mark:80,grade:'A',grade_point:9,performance_status:'Strong'},{minimum_mark:70,grade:'B+',grade_point:8,performance_status:'Average'},{minimum_mark:60,grade:'B',grade_point:7,performance_status:'Average'},{minimum_mark:50,grade:'C',grade_point:6,performance_status:'Weak'},{minimum_mark:0,grade:'F',grade_point:0,performance_status:'Weak'}];
}

function gradeFromRules(total, rules) {
  const rule = rules.find(r => total >= Number(r.minimum_mark));
  return rule ? { grade:rule.grade, status:rule.performance_status, gradePoint:Number(rule.grade_point) } : calculateGradeAndStatus(total);
}

// GET /api/performance/:studentId
async function getPerformanceByStudent(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const [marks] = await db.query('SELECT m.*, s.subject_name, s.subject_code AS subject_code, s.credits FROM marks m JOIN subjects s ON s.id=m.subject_id WHERE m.student_id = ? ORDER BY m.semester_id,s.subject_code', [studentId]);
    const gradeRules = await getGradeRules();

    // Calculate aggregated statistics
    let totalMarksSum = 0;
    let strongCount = 0;
    let averageCount = 0;
    let weakCount = 0;

    const formattedMarks = marks.map(m => {
      const internal = parseFloat(m.internal_marks) || 0;
      const assignment = parseFloat(m.assignment_marks) || 0;
      const exam = parseFloat(m.exam_marks) || 0;
      const total = parseFloat(m.total_marks) || (internal + assignment + exam);
      const { grade, status } = gradeFromRules(total, gradeRules);

      totalMarksSum += total;
      if (status === 'Strong') strongCount++;
      else if (status === 'Average') averageCount++;
      else weakCount++;

      return {
        ...m,
        internal_marks: internal,
        assignment_marks: assignment,
        exam_marks: exam,
        total_marks: total,
        grade: m.grade || grade,
        status: m.status || status
      };
    });

    const averageMark = marks.length > 0 ? (totalMarksSum / marks.length).toFixed(2) : 0;

    return res.status(200).json({
      success: true,
      count: formattedMarks.length,
      averageMark: parseFloat(averageMark),
      summary: {
        strong: strongCount,
        average: averageCount,
        weak: weakCount
      },
      data: formattedMarks
    });
  } catch (error) {
    console.error('[Performance Get Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/performance
async function addMarks(req, res) {
  try {
    const { student_id, subject_id, internal_marks, assignment_marks, exam_marks, semester } = req.body;

    const internal = parseFloat(internal_marks) || 0;
    const assignment = parseFloat(assignment_marks) || 0;
    const exam = parseFloat(exam_marks) || 0;
    if (!student_id || !subject_id || internal < 0 || internal > 20 || assignment < 0 || assignment > 20 || exam < 0 || exam > 60) {
      return res.status(400).json({ success: false, message: 'Student and subject are required. Marks must be within internal 0-20, assignment 0-20, and exam 0-60.' });
    }
    const total = internal + assignment + exam;
    const gradeRules = await getGradeRules();
    const { grade, status, gradePoint } = gradeFromRules(total, gradeRules);
    const [[student]] = await db.query('SELECT current_semester_id, semester FROM students WHERE id = ?', [student_id]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const [result] = await db.query(
      `INSERT INTO marks (student_id, subject_id, semester_id, internal_marks, assignment_marks, exam_marks, total_marks, grade, grade_point, performance_status, status, semester)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE internal_marks=VALUES(internal_marks), assignment_marks=VALUES(assignment_marks), exam_marks=VALUES(exam_marks), total_marks=VALUES(total_marks), grade=VALUES(grade), grade_point=VALUES(grade_point), performance_status=VALUES(performance_status), status=VALUES(status)`,
      [student_id, subject_id, student.current_semester_id, internal, assignment, exam, total, grade, gradePoint, status, status, semester || student.semester]
    );

    await logAuditEvent({
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      action: 'RECORD_MARKS',
      entityType: 'marks',
      entityId: result.insertId,
      newValue: { student_id, subject_id, internal, assignment, exam, total, grade },
      reason: 'Continuous assessment and semester marks recording',
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Marks recorded successfully',
      data: { id: result.insertId, total, grade, status }
    });
  } catch (error) {
    console.error('[Performance Add Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/performance/:id
async function updateMarks(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { internal_marks, assignment_marks, exam_marks } = req.body;

    const internal = parseFloat(internal_marks) || 0;
    const assignment = parseFloat(assignment_marks) || 0;
    const exam = parseFloat(exam_marks) || 0;
    if (internal < 0 || internal > 20 || assignment < 0 || assignment > 20 || exam < 0 || exam > 60) {
      return res.status(400).json({ success: false, message: 'Marks must be within internal 0-20, assignment 0-20, and exam 0-60.' });
    }
    const total = internal + assignment + exam;
    const gradeRules = await getGradeRules();
    const { grade, status, gradePoint } = gradeFromRules(total, gradeRules);

    // Fetch previous marks for audit history
    const [prevMarks] = await db.query('SELECT * FROM marks WHERE id = ?', [id]);
    const previousValue = prevMarks.length > 0 ? {
      internal: prevMarks[0].internal_marks,
      assignment: prevMarks[0].assignment_marks,
      exam: prevMarks[0].exam_marks,
      total: prevMarks[0].total_marks,
      grade: prevMarks[0].grade
    } : null;

    await db.query(
      `UPDATE marks SET internal_marks = ?, assignment_marks = ?, exam_marks = ?, total_marks = ?, grade = ?, grade_point = ?, performance_status = ?, status = ? WHERE id = ?`,
      [internal, assignment, exam, total, grade, gradePoint, status, status, id]
    );

    await logAuditEvent({
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      action: 'UPDATE_MARKS',
      entityType: 'marks',
      entityId: id,
      previousValue,
      newValue: { internal, assignment, exam, total, grade },
      reason: req.body?.reason || 'Marks revised by faculty evaluator',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Marks updated successfully',
      data: { id, total, grade, status }
    });
  } catch (error) {
    console.error('[Performance Update Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// DELETE /api/performance/:id
async function deleteMarks(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM marks WHERE id = ?', [id]);

    await logAuditEvent({
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      action: 'DELETE_MARKS',
      entityType: 'marks',
      entityId: id,
      reason: req.body?.reason || 'Marks record removed',
      ipAddress: req.ip
    });

    return res.status(200).json({ success: true, message: 'Marks record deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getPerformanceByStudent,
  addMarks,
  updateMarks,
  deleteMarks
};
