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

    // Students in department with assigned mentor details
    const [studentList] = await db.query(`
      SELECT st.id, st.name, st.register_number, st.email, st.year, st.semester, st.cgpa, st.attendance_percentage, st.avatar,
             f.name AS mentor_name, f.faculty_code AS mentor_code
      FROM students st
      LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
      LEFT JOIN faculty f ON f.id = sm.faculty_id
      WHERE st.department_id = ?
      ORDER BY st.register_number ASC
    `, [id]);

    // Academic summary & mentor coverage
    const avgCgpa = studentList.length > 0 
      ? (studentList.reduce((acc, s) => acc + Number(s.cgpa || 0), 0) / studentList.length).toFixed(2)
      : 0;
    const avgAttendance = studentList.length > 0
      ? (studentList.reduce((acc, s) => acc + Number(s.attendance_percentage || 0), 0) / studentList.length).toFixed(1)
      : 0;
    const mentoredCount = studentList.filter(s => Boolean(s.mentor_name)).length;
    const unassignedCount = studentList.length - mentoredCount;

    return res.status(200).json({
      success: true,
      data: {
        department: dept,
        faculty: facultyList,
        students: studentList,
        summary: {
          totalStudents: studentList.length,
          totalFaculty: facultyList.length,
          mentoredCount,
          unassignedCount,
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

// GET /api/departments/institutional-overview (Admin Department-Wise Institutional Overview)
async function getInstitutionDepartmentOverview(req, res) {
  try {
    // 1. Institution-wide Summary Counts from DB
    const [[deptCount]] = await db.query('SELECT COUNT(*) AS total FROM departments');
    const [[hodCount]] = await db.query(`
      SELECT COUNT(DISTINCT f.id) AS total 
      FROM faculty f 
      LEFT JOIN department_hod_assignments dha ON dha.faculty_id = f.id AND dha.status = 'active'
      WHERE dha.id IS NOT NULL OR f.is_hod = 1
    `);
    const [[facCount]] = await db.query('SELECT COUNT(*) AS total FROM faculty');
    const [[studCount]] = await db.query("SELECT COUNT(*) AS total FROM students WHERE status = 'active'");

    // 2. Fetch all departments
    const [departments] = await db.query('SELECT id, code, name FROM departments ORDER BY name ASC');

    // 3. Fetch active HODs
    const [hodRows] = await db.query(`
      SELECT f.id, f.faculty_code, f.name, f.email, f.designation, f.avatar, f.department_id,
             dha.start_date AS assigned_date, dha.status AS assignment_status
      FROM department_hod_assignments dha
      JOIN faculty f ON f.id = dha.faculty_id
      WHERE dha.status = 'active'
    `);
    const hodMap = {};
    hodRows.forEach(h => {
      hodMap[h.department_id] = h;
    });

    // 4. Fetch all faculty members with mentee count
    const [facultyRows] = await db.query(`
      SELECT f.id, f.faculty_code, f.name, f.email, f.designation, f.avatar, f.department_id, f.is_hod, f.can_mentor,
             (SELECT COUNT(*) FROM student_mentors sm WHERE sm.faculty_id = f.id AND sm.status = 'active') AS mentee_count
      FROM faculty f
      ORDER BY f.is_hod DESC, f.name ASC
    `);

    // 5. Fetch all students with current GPA, attendance %, and assigned mentor
    const [studentRows] = await db.query(`
      SELECT st.id, st.register_number, st.name, st.email, st.year, st.semester, st.cgpa, st.gpa,
             st.attendance_percentage, st.risk_level, st.avatar, st.department_id,
             f.name AS assigned_mentor_name, f.id AS assigned_mentor_id
      FROM students st
      LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
      LEFT JOIN faculty f ON f.id = sm.faculty_id
      WHERE st.status = 'active'
      ORDER BY st.register_number ASC
    `);

    // Group faculty and students strictly by real database department_id
    const facultyByDept = {};
    const unassignedFaculty = [];
    facultyRows.forEach(f => {
      if (f.department_id && departments.some(d => d.id === f.department_id)) {
        if (!facultyByDept[f.department_id]) facultyByDept[f.department_id] = [];
        if (hodMap[f.department_id] && hodMap[f.department_id].id === f.id) {
          f.is_hod = 1;
        }
        facultyByDept[f.department_id].push(f);
      } else {
        unassignedFaculty.push(f);
      }
    });

    const studentsByDept = {};
    const unassignedStudents = [];
    studentRows.forEach(s => {
      if (s.department_id && departments.some(d => d.id === s.department_id)) {
        if (!studentsByDept[s.department_id]) studentsByDept[s.department_id] = [];
        studentsByDept[s.department_id].push(s);
      } else {
        unassignedStudents.push(s);
      }
    });

    // Assemble department cards
    const departmentCards = departments.map(d => {
      const fac = facultyByDept[d.id] || [];
      const stu = studentsByDept[d.id] || [];
      const activeHod = hodMap[d.id] || fac.find(f => f.is_hod === 1) || null;

      const avgCgpa = stu.length > 0 
        ? (stu.reduce((acc, s) => acc + Number(s.cgpa || 0), 0) / stu.length).toFixed(2)
        : '0.00';
      const avgAttendance = stu.length > 0
        ? (stu.reduce((acc, s) => acc + Number(s.attendance_percentage || 0), 0) / stu.length).toFixed(1)
        : '0.0';

      return {
        id: d.id,
        code: d.code,
        name: d.name,
        hod: activeHod ? {
          id: activeHod.id,
          faculty_code: activeHod.faculty_code,
          name: activeHod.name,
          email: activeHod.email,
          designation: activeHod.designation || 'Head of Department',
          avatar: activeHod.avatar,
          assigned_date: activeHod.assigned_date || null
        } : null,
        faculty: fac,
        students: stu,
        stats: {
          totalFaculty: fac.length,
          totalStudents: stu.length,
          averageCgpa: parseFloat(avgCgpa),
          averageAttendance: parseFloat(avgAttendance)
        }
      };
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalDepartments: Number(deptCount.total || departments.length),
        totalHODs: Number(hodCount.total || 0),
        totalFaculty: Number(facCount.total || 0),
        totalStudents: Number(studCount.total || 0)
      },
      departments: departmentCards,
      unassigned: {
        faculty: unassignedFaculty,
        students: unassignedStudents
      }
    });

  } catch (error) {
    console.error('[Institutional Overview Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/departments/faculty/:id/mini-dashboard (Faculty Mini-Dashboard & Mentee List)
async function getFacultyMiniDashboard(req, res) {
  try {
    const facultyId = parseInt(req.params.id, 10);

    const [facultyRows] = await db.query(`
      SELECT f.*, d.name AS department_name, d.code AS department_code,
             u.email AS user_email, u.avatar AS user_avatar,
             dha.id AS active_hod_assignment, dha.start_date AS hod_since
      FROM faculty f
      LEFT JOIN departments d ON d.id = f.department_id
      LEFT JOIN users u ON u.id = f.user_id
      LEFT JOIN department_hod_assignments dha ON dha.faculty_id = f.id AND dha.status = 'active'
      WHERE f.id = ?
    `, [facultyId]);

    if (!facultyRows || facultyRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Faculty record not found.' });
    }

    const fac = facultyRows[0];
    const isHod = Boolean(fac.is_hod || fac.active_hod_assignment);

    // RBAC validation: Admin denied; HOD only own department; Faculty only self; Students denied
    if (!req.user || req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Administrators do not have access to faculty operational profiles or mini-dashboards.'
      });
    }

    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Requires faculty authorization.'
      });
    }

    const isHodUser = req.user.facultyRole === 'hod' || req.user.isHOD;
    if (isHodUser) {
      if (req.user.departmentId && fac.department_id !== req.user.departmentId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: HOD can only view faculty profiles within their own department.'
        });
      }
    } else {
      const isSelf = (req.user.facultyId && req.user.facultyId === fac.id) || (req.user.id && fac.user_id === req.user.id);
      if (!isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Faculty members can only view their own profile.'
        });
      }
    }

    // Mentees assigned to this faculty
    const [mentees] = await db.query(`
      SELECT st.id, st.register_number, st.name, st.email, st.year, st.semester, st.cgpa, st.gpa,
             st.attendance_percentage, st.avatar, sm.assigned_at
      FROM student_mentors sm
      JOIN students st ON st.id = sm.student_id
      WHERE sm.faculty_id = ? AND sm.status = 'active'
      ORDER BY st.register_number ASC
    `, [facultyId]);

    // Subject allocations (courses taught)
    const [allocations] = await db.query(`
      SELECT sa.id, sa.section_code, s.subject_code, s.subject_name, s.credits, s.subject_type,
             sem.label AS semester_label
      FROM subject_allocations sa
      JOIN subjects s ON s.id = sa.subject_id
      LEFT JOIN semesters sem ON sem.id = sa.semester_id
      WHERE sa.faculty_id = ?
      ORDER BY s.subject_code ASC
    `, [facultyId]);

    return res.status(200).json({
      success: true,
      data: {
        faculty: {
          id: fac.id,
          faculty_code: fac.faculty_code,
          name: fac.name,
          email: fac.email || fac.user_email,
          designation: isHod ? 'Head of Department' : (fac.designation || 'Faculty Mentor'),
          department: fac.department_name || 'Department',
          department_id: fac.department_id,
          department_code: fac.department_code,
          avatar: fac.avatar || fac.user_avatar,
          is_hod: isHod,
          can_mentor: Boolean(fac.can_mentor),
          hod_since: fac.hod_since || null,
          mentee_count: mentees.length,
          course_count: allocations.length
        },
        mentees,
        courses: allocations
      }
    });

  } catch (error) {
    console.error('[Faculty Mini-Dashboard Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/departments/mini-dashboards (Institution Admin Department-Wise Mini Dashboards)
async function getDepartmentMiniDashboards(req, res) {
  try {
    const [departments] = await db.query('SELECT id, code, name FROM departments ORDER BY name ASC');

    // 1. Student stats per dept
    const [studStats] = await db.query(`
      SELECT 
        st.department_id,
        COUNT(*) AS total_students,
        AVG(st.cgpa) AS avg_cgpa,
        AVG(st.attendance_percentage) AS avg_attendance,
        SUM(CASE WHEN st.attendance_percentage < 75 OR st.cgpa < 6.0 THEN 1 ELSE 0 END) AS follow_up_count,
        SUM(CASE WHEN st.cgpa >= 8.5 THEN 1 ELSE 0 END) AS cgpa_distinction,
        SUM(CASE WHEN st.cgpa >= 7.0 AND st.cgpa < 8.5 THEN 1 ELSE 0 END) AS cgpa_first_class,
        SUM(CASE WHEN st.cgpa >= 6.0 AND st.cgpa < 7.0 THEN 1 ELSE 0 END) AS cgpa_second_class,
        SUM(CASE WHEN st.cgpa < 6.0 THEN 1 ELSE 0 END) AS cgpa_at_risk
      FROM students st
      WHERE st.status = 'active'
      GROUP BY st.department_id
    `);
    const studStatsMap = {};
    studStats.forEach(s => { studStatsMap[s.department_id] = s; });

    // 2. Faculty counts per dept
    const [facStats] = await db.query(`
      SELECT department_id, COUNT(*) AS total_faculty
      FROM faculty
      GROUP BY department_id
    `);
    const facStatsMap = {};
    facStats.forEach(f => { facStatsMap[f.department_id] = f.total_faculty; });

    // 3. Active HODs
    const [hodRows] = await db.query(`
      SELECT f.id, f.faculty_code, f.name, f.email, f.designation, f.avatar, f.department_id,
             dha.start_date AS assigned_date
      FROM department_hod_assignments dha
      JOIN faculty f ON f.id = dha.faculty_id
      WHERE dha.status = 'active'
    `);
    const hodMap = {};
    hodRows.forEach(h => { hodMap[h.department_id] = h; });

    // 4. Verified activities per department
    const [actStats] = await db.query(`
      SELECT st.department_id, COUNT(*) AS verified_activities_count
      FROM student_activities sa
      JOIN students st ON st.id = sa.student_id
      WHERE sa.status = 'Verified'
      GROUP BY st.department_id
    `);
    const actStatsMap = {};
    actStats.forEach(a => { actStatsMap[a.department_id] = a.verified_activities_count; });

    // 5. Interventions per department
    const [intervStats] = await db.query(`
      SELECT st.department_id,
             SUM(CASE WHEN ili.status IN ('Assigned', 'In Progress', 'Follow-up Due') THEN 1 ELSE 0 END) AS active_interventions,
             SUM(CASE WHEN ili.status = 'Completed' THEN 1 ELSE 0 END) AS completed_interventions
      FROM impact_loop_interventions ili
      JOIN students st ON st.id = ili.student_id
      GROUP BY st.department_id
    `);
    const intervMap = {};
    intervStats.forEach(i => { intervMap[i.department_id] = i; });

    // 6. Fee collection summary per department
    const [feeStats] = await db.query(`
      SELECT st.department_id,
             SUM(sf.total_amount) AS total_due,
             SUM(sf.paid_amount) AS total_paid,
             SUM(sf.balance_amount) AS total_balance,
             SUM(CASE WHEN sf.balance_amount > 0 THEN 1 ELSE 0 END) AS unpaid_records
      FROM student_fees sf
      JOIN students st ON st.id = sf.student_id
      GROUP BY st.department_id
    `);
    const feeStatsMap = {};
    feeStats.forEach(f => { feeStatsMap[f.department_id] = f; });

    const miniDashboards = departments.map(d => {
      const ss = studStatsMap[d.id] || {};
      const totalStudents = Number(ss.total_students || 0);
      const totalFaculty = Number(facStatsMap[d.id] || 0);
      const hod = hodMap[d.id] || null;
      const fs = feeStatsMap[d.id] || {};
      const totalDue = Number(fs.total_due || 0);
      const totalPaid = Number(fs.total_paid || 0);
      const totalBalance = Number(fs.total_balance || 0);
      const collectionRate = totalDue > 0 ? Number(((totalPaid / totalDue) * 100).toFixed(1)) : 0;
      const interv = intervMap[d.id] || {};

      return {
        id: d.id,
        code: d.code,
        name: d.name,
        studentCount: totalStudents,
        facultyCount: totalFaculty,
        hod: hod ? {
          id: hod.id,
          code: hod.faculty_code,
          name: hod.name,
          email: hod.email,
          designation: hod.designation || 'Head of Department',
          avatar: hod.avatar,
          assignedDate: hod.assigned_date
        } : null,
        attendance: {
          average: ss.avg_attendance ? Number(Number(ss.avg_attendance).toFixed(1)) : 0,
          belowThresholdCount: Number(ss.follow_up_count || 0)
        },
        academicPerformance: {
          averageCgpa: ss.avg_cgpa ? Number(Number(ss.avg_cgpa).toFixed(2)) : 0,
          distribution: {
            distinction: Number(ss.cgpa_distinction || 0),
            firstClass: Number(ss.cgpa_first_class || 0),
            secondClass: Number(ss.cgpa_second_class || 0),
            atRisk: Number(ss.cgpa_at_risk || 0)
          }
        },
        studentsRequiringFollowUp: Number(ss.follow_up_count || 0),
        verifiedActivitiesCount: Number(actStatsMap[d.id] || 0),
        interventions: {
          activeCount: Number(interv.active_interventions || 0),
          completedCount: Number(interv.completed_interventions || 0)
        },
        feeCollection: {
          totalDue,
          totalPaid,
          totalBalance,
          collectionRatePct: collectionRate,
          unpaidRecordsCount: Number(fs.unpaid_records || 0)
        }
      };
    });

    return res.status(200).json({
      success: true,
      totalDepartments: departments.length,
      data: miniDashboards
    });
  } catch (err) {
    console.error('[getDepartmentMiniDashboards Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/departments/:id/student-mini-dashboards (Student Mini Dashboards for Admin/HOD)
async function getDepartmentStudentCards(req, res) {
  try {
    const departmentId = parseInt(req.params.id, 10);

    const [deptRows] = await db.query('SELECT id, code, name FROM departments WHERE id = ?', [departmentId]);
    if (deptRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }
    const dept = deptRows[0];

    // Students with mentor
    const [students] = await db.query(`
      SELECT st.id, st.register_number, st.name, st.email, st.year, st.semester, st.avatar,
             st.cgpa, st.gpa, st.attendance_percentage, st.risk_level,
             f.id AS mentor_id, f.name AS mentor_name, f.faculty_code AS mentor_code
      FROM students st
      LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
      LEFT JOIN faculty f ON f.id = sm.faculty_id
      WHERE st.department_id = ? AND st.status = 'active'
      ORDER BY st.register_number ASC
    `, [departmentId]);

    if (students.length === 0) {
      return res.status(200).json({
        success: true,
        department: dept,
        count: 0,
        data: []
      });
    }

    const studentIds = students.map(s => s.id);

    // Verified activities count
    const [activities] = await db.query(`
      SELECT student_id, COUNT(*) AS verified_count
      FROM student_activities
      WHERE student_id IN (?) AND status = 'Verified'
      GROUP BY student_id
    `, [studentIds]);
    const actMap = {};
    activities.forEach(a => { actMap[a.student_id] = a.verified_count; });

    // Active interventions
    const [interventions] = await db.query(`
      SELECT student_id, COUNT(*) AS active_count,
             MAX(title) AS latest_title, MAX(status) AS latest_status
      FROM impact_loop_interventions
      WHERE student_id IN (?) AND status IN ('Assigned', 'In Progress', 'Follow-up Due')
      GROUP BY student_id
    `, [studentIds]);
    const intervMap = {};
    interventions.forEach(i => { intervMap[i.student_id] = i; });

    // Fee status
    const [fees] = await db.query(`
      SELECT student_id,
             SUM(total_amount) AS total_due,
             SUM(paid_amount) AS total_paid,
             SUM(balance_amount) AS total_balance,
             MIN(status) AS fee_status
      FROM student_fees
      WHERE student_id IN (?)
      GROUP BY student_id
    `, [studentIds]);
    const feeMap = {};
    fees.forEach(f => { feeMap[f.student_id] = f; });

    // Academic results summary
    const [results] = await db.query(`
      SELECT student_id,
             COUNT(*) AS total_assessments,
             AVG(CASE WHEN max_marks > 0 THEN (marks_obtained / max_marks) * 100 ELSE NULL END) AS avg_score_pct
      FROM academic_results
      WHERE student_id IN (?)
      GROUP BY student_id
    `, [studentIds]);
    const resMap = {};
    results.forEach(r => { resMap[r.student_id] = r; });

    const studentCards = students.map(st => {
      const fs = feeMap[st.id] || {};
      const rs = resMap[st.id] || {};
      const inv = intervMap[st.id] || {};

      return {
        id: st.id,
        registerNumber: st.register_number,
        name: st.name,
        email: st.email,
        year: st.year,
        semester: st.semester,
        avatar: st.avatar,
        cgpa: st.cgpa !== null ? Number(st.cgpa) : null,
        gpa: st.gpa !== null ? Number(st.gpa) : null,
        attendancePercentage: st.attendance_percentage !== null ? Number(st.attendance_percentage) : null,
        riskLevel: st.risk_level || 'Low',
        mentor: st.mentor_name ? {
          id: st.mentor_id,
          name: st.mentor_name,
          code: st.mentor_code
        } : null,
        academics: {
          totalAssessments: Number(rs.total_assessments || 0),
          averageScorePct: rs.avg_score_pct ? Number(Number(rs.avg_score_pct).toFixed(1)) : null
        },
        verifiedActivitiesCount: Number(actMap[st.id] || 0),
        intervention: {
          activeCount: Number(inv.active_count || 0),
          latestTitle: inv.latest_title || null,
          latestStatus: inv.latest_status || null
        },
        fees: {
          totalDue: Number(fs.total_due || 0),
          paidAmount: Number(fs.total_paid || 0),
          balanceAmount: Number(fs.total_balance || 0),
          status: fs.fee_status || 'Paid'
        }
      };
    });

    return res.status(200).json({
      success: true,
      department: dept,
      count: studentCards.length,
      data: studentCards
    });
  } catch (err) {
    console.error('[getDepartmentStudentCards Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllDepartments,
  getDepartmentById,
  assignDepartmentHOD,
  createDepartment,
  getInstitutionDepartmentOverview,
  getFacultyMiniDashboard,
  getDepartmentMiniDashboards,
  getDepartmentStudentCards
};
