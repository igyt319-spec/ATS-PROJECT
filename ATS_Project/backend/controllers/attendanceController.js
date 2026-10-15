const db = require('../config/db');

function calculateAttendanceStatus(percentage) {
  if (percentage >= 85) return 'GOOD';
  if (percentage >= 75) return 'MONITOR';
  return 'RISK';
}

async function getAttendanceRules() {
  try {
    const [rows] = await db.query('SELECT status,minimum_percentage FROM attendance_thresholds ORDER BY minimum_percentage DESC');
    if (rows.length) return rows;
  } catch (_) {}
  return [{status:'GOOD',minimum_percentage:85},{status:'MONITOR',minimum_percentage:75},{status:'RISK',minimum_percentage:0}];
}

function statusFromRules(percentage, rules) {
  return rules.find(r => percentage >= Number(r.minimum_percentage))?.status || calculateAttendanceStatus(percentage);
}

// GET /api/attendance/:studentId
async function getAttendanceByStudent(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const [records] = await db.query('SELECT a.*, s.subject_name FROM attendance a JOIN subjects s ON s.id=a.subject_id JOIN students st ON st.id=a.student_id WHERE a.student_id = ? AND (a.semester_id=st.current_semester_id OR a.semester_id IS NULL) ORDER BY a.semester_id,s.subject_code', [studentId]);
    const thresholds = await getAttendanceRules();

    let totalClassesSum = 0;
    let attendedClassesSum = 0;
    const atRiskSubjects = [];

    const formattedRecords = records.map(r => {
      const total = parseInt(r.classes_conducted ?? r.total_classes, 10) || 0;
      const attended = parseInt(r.classes_attended ?? r.attended_classes, 10) || 0;
      const pct = total > 0 ? parseFloat(((attended / total) * 100).toFixed(2)) : 0;
      const status = statusFromRules(pct, thresholds);

      totalClassesSum += total;
      attendedClassesSum += attended;

      // Calculate recovery metrics
      let classesNeededFor75 = 0;
      let classesNeededFor85 = 0;
      let bunkBuffer75 = 0;

      if (total > 0) {
        if (pct < 75) {
          // (attended + x) / (total + x) >= 0.75 => x >= (0.75*total - attended) / 0.25
          classesNeededFor75 = Math.ceil(Math.max(0, (0.75 * total - attended) / 0.25));
        }
        if (pct < 85) {
          // (attended + x) / (total + x) >= 0.85 => x >= (0.85*total - attended) / 0.15
          classesNeededFor85 = Math.ceil(Math.max(0, (0.85 * total - attended) / 0.15));
        }
        if (pct >= 75) {
          // attended / (total + m) >= 0.75 => m <= (attended - 0.75*total) / 0.75
          bunkBuffer75 = Math.floor(Math.max(0, (attended - 0.75 * total) / 0.75));
        }
      }

      if (status === 'RISK') {
        atRiskSubjects.push({
          subject_name: r.subject_name || 'Subject',
          percentage: pct,
          classesNeededFor75
        });
      }

      return {
        ...r,
        total_classes: total,
        attended_classes: attended,
        percentage: pct,
        status,
        classesNeededFor75,
        classesNeededFor85,
        bunkBuffer75
      };
    });

    const overallPercentage = totalClassesSum > 0
      ? parseFloat(((attendedClassesSum / totalClassesSum) * 100).toFixed(2))
      : 0;

    const overallStatus = statusFromRules(overallPercentage, thresholds);

    const overallClassesNeededFor75 = overallPercentage < 75 && totalClassesSum > 0
      ? Math.ceil(Math.max(0, (0.75 * totalClassesSum - attendedClassesSum) / 0.25))
      : 0;
    const overallClassesNeededFor85 = overallPercentage < 85 && totalClassesSum > 0
      ? Math.ceil(Math.max(0, (0.85 * totalClassesSum - attendedClassesSum) / 0.15))
      : 0;
    const overallBunkBuffer75 = overallPercentage >= 75 && totalClassesSum > 0
      ? Math.floor(Math.max(0, (attendedClassesSum - 0.75 * totalClassesSum) / 0.75))
      : 0;

    const [history] = await db.query('SELECT se.semester_number, SUM(a.classes_attended) attended, SUM(a.classes_conducted) conducted FROM attendance a JOIN semesters se ON se.id=a.semester_id WHERE a.student_id=? GROUP BY se.semester_number ORDER BY se.semester_number', [studentId]);
    const monthlyTrend = history.map(r => ({ month: `Semester ${r.semester_number}`, percentage: Number(r.conducted) ? Number((100*r.attended/r.conducted).toFixed(2)) : 0 }));

    return res.status(200).json({
      success: true,
      overallPercentage,
      overallStatus,
      totalClasses: totalClassesSum,
      attendedClasses: attendedClassesSum,
      overallClassesNeededFor75,
      overallClassesNeededFor85,
      overallBunkBuffer75,
      hasRiskAlert: atRiskSubjects.length > 0 || overallStatus === 'RISK',
      atRiskSubjects,
      monthlyTrend,
      data: formattedRecords
    });
  } catch (error) {
    console.error('[Attendance Get Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/attendance
async function addAttendance(req, res) {
  try {
    const { student_id, subject_id, total_classes, attended_classes, month } = req.body;
    const total = parseInt(total_classes, 10) || 0;
    const attended = parseInt(attended_classes, 10) || 0;
    const pct = total > 0 ? parseFloat(((attended / total) * 100).toFixed(2)) : 0;
    const thresholds = await getAttendanceRules();
    const configuredStatus = statusFromRules(pct, thresholds);
    if (!student_id || !subject_id || total <= 0 || attended < 0 || attended > total) return res.status(400).json({ success: false, message: 'Student and subject are required. Enter attended classes from 0 through the positive total class count.' });

    const [result] = await db.query(
      `INSERT INTO attendance (student_id, subject_id, semester_id, classes_conducted, classes_attended, attendance_percentage, attendance_status, total_classes, attended_classes, percentage, status, month)
       SELECT ?, ?, current_semester_id, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM students WHERE id=?
       ON DUPLICATE KEY UPDATE classes_conducted=VALUES(classes_conducted), classes_attended=VALUES(classes_attended), attendance_percentage=VALUES(attendance_percentage), attendance_status=VALUES(attendance_status), total_classes=VALUES(total_classes), attended_classes=VALUES(attended_classes), percentage=VALUES(percentage), status=VALUES(status)`,
      [student_id, subject_id, total, attended, pct, configuredStatus, total, attended, pct, configuredStatus, month || 'Overall', student_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Attendance record created successfully',
      data: { id: result.insertId, percentage: pct, status: configuredStatus }
    });
  } catch (error) {
    console.error('[Attendance Add Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/attendance/:id
async function updateAttendance(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { total_classes, attended_classes } = req.body;
    const total = parseInt(total_classes, 10) || 0;
    const attended = parseInt(attended_classes, 10) || 0;
    const pct = total > 0 ? parseFloat(((attended / total) * 100).toFixed(2)) : 0;
    if (total <= 0 || attended < 0 || attended > total) return res.status(400).json({ success: false, message: 'Enter attended classes from 0 through the positive total class count.' });
    const thresholds = await getAttendanceRules();
    const status = statusFromRules(pct, thresholds);

    await db.query(
      `UPDATE attendance SET classes_conducted = ?, classes_attended = ?, attendance_percentage = ?, attendance_status = ?, total_classes = ?, attended_classes = ?, percentage = ?, status = ? WHERE id = ?`,
      [total, attended, pct, status, total, attended, pct, status, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: { id, percentage: pct, status }
    });
  } catch (error) {
    console.error('[Attendance Update Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getAttendanceByStudent,
  addAttendance,
  updateAttendance
};
