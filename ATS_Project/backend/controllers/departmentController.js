const db = require('../config/db');
const { logAuditEvent } = require('../utils/auditLogger');

// GET /api/departments
async function getAllDepartments(req, res) {
  try {
    const [departments] = await db.query(`
      SELECT d.id, d.code, d.name, d.college_id, d.created_at, d.updated_at,
             (SELECT COUNT(*) FROM students st WHERE st.department_id = d.id) AS student_count,
             (SELECT COUNT(*) FROM faculty f WHERE f.department_id = d.id) AS faculty_count,
             dha.id AS active_assignment_id,
             f.id AS active_hod_faculty_id,
             f.name AS active_hod_name,
             f.email AS active_hod_email,
             f.faculty_code AS active_hod_code,
             f.avatar AS active_hod_avatar,
             dha.start_date AS hod_assigned_date
      FROM departments d
      LEFT JOIN department_hod_assignments dha ON dha.department_id = d.id AND dha.status = 'active'
      LEFT JOIN faculty f ON f.id = dha.faculty_id
      ORDER BY d.name ASC
    `);

    return res.status(200).json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (error) {
    console.error('[Get Departments Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/departments/:id
async function getDepartmentById(req, res) {
  try {
    const id = parseInt(req.params.id, 10);

    const [deptRows] = await db.query(`
      SELECT d.*,
             dha.id AS active_assignment_id,
             f.id AS active_hod_faculty_id,
             f.name AS active_hod_name,
             f.email AS active_hod_email,
             f.faculty_code AS active_hod_code,
             f.avatar AS active_hod_avatar,
             dha.start_date AS hod_assigned_date
      FROM departments d
      LEFT JOIN department_hod_assignments dha ON dha.department_id = d.id AND dha.status = 'active'
      LEFT JOIN faculty f ON f.id = dha.faculty_id
      WHERE d.id = ?
    `, [id]);

    if (!deptRows || deptRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }
    const dept = deptRows[0];

    // Faculty in department
    const [facultyList] = await db.query(`
      SELECT f.id, f.name, f.email, f.faculty_code, f.designation, f.is_hod, f.can_mentor, f.avatar,
             (SELECT COUNT(*) FROM student_mentors sm WHERE sm.faculty_id = f.id AND sm.status = 'active') AS mentee_count
      FROM faculty f
      WHERE f.department_id = ?
      ORDER BY f.is_hod DESC, f.name ASC
    `, [id]);

    // Students in department
    const [studentList] = await db.query(`
      SELECT st.id, st.name, st.register_number, st.email, st.year, st.semester, st.cgpa, st.attendance_percentage, st.avatar
      FROM students st
      WHERE st.department_id = ?
      ORDER BY st.register_number ASC
    `, [id]);

    // Academic summary
    const avgCgpa = studentList.length > 0 
      ? (studentList.reduce((acc, s) => acc + Number(s.cgpa || 0), 0) / studentList.length).toFixed(2)
      : 0;
    const avgAttendance = studentList.length > 0
      ? (studentList.reduce((acc, s) => acc + Number(s.attendance_percentage || 0), 0) / studentList.length).toFixed(1)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        department: dept,
        faculty: facultyList,
        students: studentList,
        summary: {
          totalStudents: studentList.length,
          totalFaculty: facultyList.length,
          averageCgpa: Number(avgCgpa),
          averageAttendance: Number(avgAttendance)
        }
      }
    });
  } catch (error) {
    console.error('[Get Department Detail Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/departments/:id/hod (Assign Active HOD Transactionally with Single-Active Constraint)
async function assignDepartmentHOD(req, res) {
  try {
    const departmentId = parseInt(req.params.id, 10);
    const { faculty_id, reason } = req.body;

    if (!faculty_id) {
      return res.status(400).json({ success: false, message: 'Faculty ID is required for HOD assignment.' });
    }

    const facId = parseInt(faculty_id, 10);

    // Verify faculty exists and belongs to this department
    const [facRows] = await db.query(
      'SELECT f.*, u.id AS user_id FROM faculty f LEFT JOIN users u ON u.id = f.user_id WHERE f.id = ?',
      [facId]
    );

    if (!facRows || facRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Faculty record not found.' });
    }

    const faculty = facRows[0];
    if (faculty.department_id !== departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Faculty member does not belong to this department. Transfer department first.'
      });
    }

    // Capture previous active HOD
    const [prevHODRows] = await db.query(`
      SELECT dha.id, dha.faculty_id, f.name AS prev_hod_name, f.user_id AS prev_user_id
      FROM department_hod_assignments dha
      JOIN faculty f ON f.id = dha.faculty_id
      WHERE dha.department_id = ? AND dha.status = 'active'
    `, [departmentId]);

    const prevHod = prevHODRows.length > 0 ? prevHODRows[0] : null;

    // Execute transactional reassignment
    await db.query('START TRANSACTION');
    try {
      // 1. Deactivate any existing active HOD for this department
      await db.query(`
        UPDATE department_hod_assignments 
        SET status = 'inactive', end_date = CURDATE()
        WHERE department_id = ? AND status = 'active'
      `, [departmentId]);

      // 2. Set previous faculty is_hod = 0 and user faculty_role = 'mentor'
      await db.query('UPDATE faculty SET is_hod = 0 WHERE department_id = ?', [departmentId]);
      if (prevHod && prevHod.prev_user_id) {
        await db.query("UPDATE users SET faculty_role = 'mentor' WHERE id = ?", [prevHod.prev_user_id]);
      }

      // 3. Insert new active HOD assignment (enforced by DB unique key uq_one_active_hod)
      const [insertRes] = await db.query(`
        INSERT INTO department_hod_assignments 
          (department_id, faculty_id, assigned_by, start_date, status)
        VALUES (?, ?, ?, CURDATE(), 'active')
      `, [departmentId, facId, req.user.id]);

      // 4. Update new faculty is_hod = 1 and user faculty_role = 'hod'
      await db.query('UPDATE faculty SET is_hod = 1 WHERE id = ?', [facId]);
      if (faculty.user_id) {
        await db.query("UPDATE users SET faculty_role = 'hod' WHERE id = ?", [faculty.user_id]);
      }

      // 5. Audit Log
      await logAuditEvent({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'HOD_ASSIGNMENT',
        entityType: 'department_hod_assignments',
        entityId: insertRes.insertId,
        previousValue: prevHod ? { faculty_id: prevHod.faculty_id, name: prevHod.prev_hod_name } : null,
        newValue: { faculty_id: facId, name: faculty.name, department_id: departmentId },
        reason: reason || 'Administrative HOD appointment',
        ipAddress: req.ip
      });

      await db.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `Successfully appointed ${faculty.name} as active HOD.`,
        assignmentId: insertRes.insertId,
        departmentId,
        facultyId: facId
      });

    } catch (txnErr) {
      await db.query('ROLLBACK');
      throw txnErr;
    }

  } catch (error) {
    console.error('[Assign HOD Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to assign HOD: ' + error.message });
  }
}

// POST /api/departments (Admin only)
async function createDepartment(req, res) {
  try {
    const { code, name, college_id } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Department code and name are required.' });
    }

    const [existing] = await db.query('SELECT id FROM departments WHERE code = ? OR name = ?', [code, name]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'A department with this code or name already exists.' });
    }

    const [result] = await db.query(
      'INSERT INTO departments (code, name, college_id) VALUES (?, ?, ?)',
      [code.toUpperCase(), name, college_id || 1]
    );

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'CREATE_DEPARTMENT',
      entityType: 'departments',
      entityId: result.insertId,
      newValue: { code: code.toUpperCase(), name },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Department created successfully.',
      departmentId: result.insertId
    });
  } catch (error) {
    console.error('[Create Department Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getAllDepartments,
  getDepartmentById,
  assignDepartmentHOD,
  createDepartment
};
