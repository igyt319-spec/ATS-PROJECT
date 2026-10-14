const db = require('../../database/db');

// GET /api/results/student/:studentId
async function getStudentResults(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const isStudentUser = req.user.role === 'student';

    // If student, can only view published results
    const publishFilter = isStudentUser ? 'AND ar.is_published = 1' : '';

    const [rows] = await db.query(
      `SELECT ar.*, 
              s.subject_name, s.subject_code, s.credits,
              st.name AS student_name, st.register_number,
              d.name AS department_name
       FROM academic_results ar
       JOIN students st ON st.id = ar.student_id
       LEFT JOIN subjects s ON s.id = ar.subject_id
       LEFT JOIN departments d ON d.id = ar.department_id
       WHERE ar.student_id = ? ${publishFilter}
       ORDER BY ar.academic_year DESC, ar.assessment_type ASC, s.subject_code ASC`,
      [studentId]
    );

    // Group by assessment_type
    const internals = rows.filter(r => r.assessment_type === 'internal');
    const labs = rows.filter(r => r.assessment_type === 'lab');
    const semesters = rows.filter(r => r.assessment_type === 'semester');

    // Summary calculation
    const totalMarksObtained = rows.reduce((acc, r) => acc + Number(r.marks_obtained || 0), 0);
    const totalMaxMarks = rows.reduce((acc, r) => acc + Number(r.max_marks || 0), 0);
    const overallPercentage = totalMaxMarks > 0 ? ((totalMarksObtained / totalMaxMarks) * 100).toFixed(1) : 0;

    return res.status(200).json({
      success: true,
      data: {
        results: rows,
        categorized: {
          internals,
          labs,
          semesters
        },
        summary: {
          totalEntries: rows.length,
          internalsCount: internals.length,
          labsCount: labs.length,
          semestersCount: semesters.length,
          overallPercentage
        }
      }
    });
  } catch (err) {
    console.error('[getStudentResults Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/results/mentor/mentees
async function getMentorMenteeResults(req, res) {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Faculty profile not resolved.' });
    }

    let filterQuery = "WHERE sm.faculty_id = ? AND sm.status = 'active'";
    let filterParams = [facultyId];

    if (req.user.role === 'admin' && !facultyId) {
      filterQuery = '';
      filterParams = [];
    }

    const [rows] = await db.query(
      `SELECT ar.*, 
              s.subject_name, s.subject_code,
              st.name AS student_name, st.register_number, st.year, st.semester AS current_semester,
              d.name AS department_name
       FROM academic_results ar
       JOIN student_mentors sm ON sm.student_id = ar.student_id
       JOIN students st ON st.id = ar.student_id
       LEFT JOIN subjects s ON s.id = ar.subject_id
       LEFT JOIN departments d ON d.id = ar.department_id
       ${filterQuery}
       ORDER BY st.register_number ASC, ar.assessment_type ASC`,
      filterParams
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getMentorMenteeResults Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/results/department
async function getDepartmentResults(req, res) {
  try {
    const departmentId = req.user.role === 'admin' && req.query.department_id 
      ? parseInt(req.query.department_id, 10) 
      : req.user.departmentId;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department scope could not be determined.' });
    }

    const { assessment_type, semester, academic_year } = req.query;
    let extraFilters = '';
    const params = [departmentId];

    if (assessment_type) {
      extraFilters += ' AND ar.assessment_type = ?';
      params.push(assessment_type);
    }
    if (academic_year) {
      extraFilters += ' AND ar.academic_year = ?';
      params.push(academic_year);
    }

    const [rows] = await db.query(
      `SELECT ar.*, 
              s.subject_name, s.subject_code,
              st.name AS student_name, st.register_number, st.year,
              d.name AS department_name
       FROM academic_results ar
       JOIN students st ON st.id = ar.student_id
       LEFT JOIN subjects s ON s.id = ar.subject_id
       LEFT JOIN departments d ON d.id = ar.department_id
       WHERE ar.department_id = ? ${extraFilters}
       ORDER BY st.register_number ASC, ar.assessment_type ASC`,
      params
    );

    return res.status(200).json({
      success: true,
      departmentId,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getDepartmentResults Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/results (Admin or authorized faculty)
async function createAcademicResult(req, res) {
  try {
    const {
      student_id,
      subject_id,
      assessment_type,
      assessment_name,
      marks_obtained,
      max_marks,
      academic_year,
      is_published
    } = req.body;

    if (!student_id || !assessment_type || marks_obtained === undefined || !max_marks) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, assessment type, marks obtained, and max marks are required.'
      });
    }

    const marksNum = Number(marks_obtained);
    const maxMarksNum = Number(max_marks);

    if (isNaN(marksNum) || isNaN(maxMarksNum) || marksNum < 0 || maxMarksNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid marks values. Must be non-negative numbers.'
      });
    }

    if (marksNum > maxMarksNum) {
      return res.status(400).json({
        success: false,
        message: `Marks obtained (${marksNum}) cannot exceed maximum permitted marks (${maxMarksNum}).`
      });
    }

    // Verify student department
    const [st] = await db.query('SELECT department_id FROM students WHERE id = ?', [student_id]);
    if (st.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const studentDeptId = st[0].department_id;

    // If HOD, verify department match
    if (req.user.role === 'faculty' && req.user.departmentId && req.user.departmentId !== studentDeptId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only record marks for students within your department.'
      });
    }

    const pct = (marksNum / maxMarksNum) * 100;
    let grade = 'F';
    let gradePoint = 0.0;
    let status = 'Fail';

    if (pct >= 90) { grade = 'O'; gradePoint = 10.0; status = 'Pass'; }
    else if (pct >= 80) { grade = 'A+'; gradePoint = 9.0; status = 'Pass'; }
    else if (pct >= 70) { grade = 'A'; gradePoint = 8.0; status = 'Pass'; }
    else if (pct >= 60) { grade = 'B+'; gradePoint = 7.0; status = 'Pass'; }
    else if (pct >= 50) { grade = 'B'; gradePoint = 6.0; status = 'Pass'; }

    const published = is_published ? 1 : 0;
    const publishedAt = published ? new Date() : null;

    const [insertResult] = await db.query(
      `INSERT INTO academic_results 
       (student_id, subject_id, department_id, academic_year, assessment_type, assessment_name, marks_obtained, max_marks, grade, grade_point, status, is_published, published_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student_id,
        subject_id || null,
        studentDeptId,
        academic_year || '2026-2027',
        assessment_type,
        assessment_name || `${assessment_type.toUpperCase()} Examination`,
        marksNum,
        maxMarksNum,
        grade,
        gradePoint,
        status,
        published,
        publishedAt,
        req.user.id
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Academic result record created successfully.',
      resultId: insertResult.insertId
    });
  } catch (err) {
    console.error('[createAcademicResult Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/results/:id/publish (Toggle or set publication status)
async function publishResult(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { is_published } = req.body;
    const published = is_published === false || is_published === 0 ? 0 : 1;

    // Check scope if HOD
    if (req.user.role === 'faculty') {
      const [resRow] = await db.query('SELECT department_id FROM academic_results WHERE id = ?', [id]);
      if (resRow.length === 0) return res.status(404).json({ success: false, message: 'Result not found.' });
      if (resRow[0].department_id !== req.user.departmentId) {
        return res.status(403).json({ success: false, message: 'Cannot modify results outside your department.' });
      }
    }

    await db.query(
      'UPDATE academic_results SET is_published = ?, published_at = IF(? = 1, NOW(), NULL), updated_at = NOW() WHERE id = ?',
      [published, published, id]
    );

    return res.status(200).json({
      success: true,
      message: `Result successfully ${published ? 'published for student visibility' : 'unpublished'}.`
    });
  } catch (err) {
    console.error('[publishResult Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getStudentResults,
  getMentorMenteeResults,
  getDepartmentResults,
  createAcademicResult,
  publishResult
};
