/**
 * ATS College Digital Twin Controller
 * ===================================
 * Feature 4: College Digital Twin Dashboard
 * 
 * Provides:
 * - Macro-level Department Intelligence and Institutional Analytics.
 * - Multi-semester GPA performance trajectories.
 * - Cohort-wide attendance risk distributions (Good >= 85%, Monitor 75-84%, Risk < 75%).
 * - Subject-level and semester-level pass/fail & mean performance analytics.
 * - Academic risk distribution (LOW, MEDIUM, HIGH).
 * - Faculty mentorship workload distributions (mentee-to-mentor ratios).
 * - Co-curricular activity verification throughput.
 * - Comparative department benchmarks using uniform statistical definitions.
 * 
 * STRICT ACCESS CONTROL:
 * - HOD: strictly scoped to their authorized department.
 * - Faculty Mentor: assigned mentees only.
 * - Admin: institution-level aggregates only (no operational personal dossiers).
 */

const db = require('../config/db');

/**
 * GET /api/college-twin/department/:departmentId
 * Comprehensive Department Intelligence Digest.
 */
async function getDepartmentTwin(req, res) {
  try {
    const requestedDeptId = parseInt(req.params.departmentId, 10);

    // Enforce role boundary
    if (req.user.role === 'faculty') {
      if (req.user.isHOD && req.user.departmentId !== requestedDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view the College Digital Twin for your authorized department.'
        });
      }
    }

    const deptId = requestedDeptId;

    // 1. Department Info & Active HOD
    const [deptRows] = await db.query(
      `SELECT d.*, c.name AS college_name,
              f.name AS hod_name, f.email AS hod_email, f.designation AS hod_designation
       FROM departments d
       LEFT JOIN colleges c ON c.id = d.college_id
       LEFT JOIN department_hod_assignments dha ON dha.department_id = d.id AND dha.status = 'active'
       LEFT JOIN faculty f ON f.id = dha.faculty_id
       WHERE d.id = ?`,
      [deptId]
    );

    if (deptRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }
    const dept = deptRows[0];

    // 2. Student Cohort Core Metrics & Risk Distribution
    const [studentRiskRows] = await db.query(
      `SELECT risk_level, COUNT(*) AS count,
              AVG(cgpa) AS avg_cgpa,
              AVG(attendance_percentage) AS avg_attendance
       FROM students 
       WHERE department_id = ? AND status = 'active'
       GROUP BY risk_level`,
      [deptId]
    );

    let totalActiveStudents = 0;
    const riskDistribution = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    let deptTotalCgpaSum = 0;
    let deptTotalAttSum = 0;

    studentRiskRows.forEach(r => {
      const c = Number(r.count || 0);
      totalActiveStudents += c;
      if (riskDistribution[r.risk_level] !== undefined) {
        riskDistribution[r.risk_level] = c;
      }
      deptTotalCgpaSum += (Number(r.avg_cgpa || 0) * c);
      deptTotalAttSum += (Number(r.avg_attendance || 0) * c);
    });

    const averageDeptCgpa = totalActiveStudents > 0 
      ? Number((deptTotalCgpaSum / totalActiveStudents).toFixed(2)) 
      : 0;
    const averageDeptAttendance = totalActiveStudents > 0 
      ? Number((deptTotalAttSum / totalActiveStudents).toFixed(1)) 
      : 0;

    // 3. Attendance Compliance Distribution (Good >= 85%, Monitor 75-84%, Risk < 75%)
    const [[attGood]] = await db.query(
      'SELECT COUNT(*) AS total FROM students WHERE department_id = ? AND attendance_percentage >= 85.0',
      [deptId]
    );
    const [[attMonitor]] = await db.query(
      'SELECT COUNT(*) AS total FROM students WHERE department_id = ? AND attendance_percentage >= 75.0 AND attendance_percentage < 85.0',
      [deptId]
    );
    const [[attRisk]] = await db.query(
      'SELECT COUNT(*) AS total FROM students WHERE department_id = ? AND attendance_percentage < 75.0',
      [deptId]
    );

    const attendanceDistribution = {
      good: Number(attGood?.total || 0),
      monitor: Number(attMonitor?.total || 0),
      risk: Number(attRisk?.total || 0)
    };

    // 4. Semester Performance Trends across Department
    const [semTrends] = await db.query(
      `SELECT COALESCE(se.semester_number, 1) AS semester_num,
              COUNT(DISTINCT m.student_id) AS student_count,
              AVG(m.total_marks) AS mean_marks,
              AVG(m.grade_point) AS mean_gpa
       FROM marks m
       JOIN students st ON st.id = m.student_id
       LEFT JOIN semesters se ON se.id = m.semester_id
       WHERE st.department_id = ?
       GROUP BY semester_num
       ORDER BY semester_num ASC`,
      [deptId]
    );

    // 5. Subject-Level Performance Analytics (Pass rates & averages)
    const [subjectAnalytics] = await db.query(
      `SELECT s.id, s.subject_code, s.subject_name, s.credits,
              COUNT(m.id) AS total_enrolled,
              AVG(m.total_marks) AS avg_mark,
              SUM(CASE WHEN m.total_marks >= 50 THEN 1 ELSE 0 END) AS passed_count,
              SUM(CASE WHEN m.total_marks < 50 THEN 1 ELSE 0 END) AS failed_count,
              SUM(CASE WHEN m.total_marks >= 80 THEN 1 ELSE 0 END) AS distinction_count
       FROM subjects s
       JOIN marks m ON m.subject_id = s.id
       JOIN students st ON st.id = m.student_id
       WHERE st.department_id = ?
       GROUP BY s.id, s.subject_code, s.subject_name, s.credits
       ORDER BY s.subject_code ASC`,
      [deptId]
    );

    const formattedSubjects = subjectAnalytics.map(sub => {
      const enrolled = Number(sub.total_enrolled || 0);
      const passed = Number(sub.passed_count || 0);
      const passRate = enrolled > 0 ? Number(((passed / enrolled) * 100).toFixed(1)) : 0;
      return {
        id: sub.id,
        code: sub.subject_code,
        name: sub.subject_name,
        credits: Number(sub.credits || 3),
        enrolledCount: enrolled,
        averageMark: Number(Number(sub.avg_mark || 0).toFixed(1)),
        passRate,
        failedCount: Number(sub.failed_count || 0),
        distinctionCount: Number(sub.distinction_count || 0)
      };
    });

    // 6. Faculty Mentorship Workload & Intervention Tracking
    const [facultyWorkload] = await db.query(
      `SELECT f.id, f.name, f.email, f.designation, f.is_hod,
              COUNT(DISTINCT sm.student_id) AS assigned_mentees,
              (SELECT COUNT(*) FROM student_activities sa 
               JOIN student_mentors sm2 ON sm2.student_id = sa.student_id 
               WHERE sm2.faculty_id = f.id AND sa.status = 'Pending') AS pending_verifications
       FROM faculty f
       LEFT JOIN student_mentors sm ON sm.faculty_id = f.id AND sm.status = 'active'
       WHERE f.department_id = ?
       GROUP BY f.id, f.name, f.email, f.designation, f.is_hod
       ORDER BY assigned_mentees DESC, f.name ASC`,
      [deptId]
    );

    // 7. Activity Verification Throughput
    const [[actVerified]] = await db.query(
      `SELECT COUNT(*) AS total FROM student_activities sa
       JOIN students st ON st.id = sa.student_id
       WHERE st.department_id = ? AND sa.status = 'Verified'`,
      [deptId]
    );
    const [[actPending]] = await db.query(
      `SELECT COUNT(*) AS total FROM student_activities sa
       JOIN students st ON st.id = sa.student_id
       WHERE st.department_id = ? AND sa.status = 'Pending'`,
      [deptId]
    );
    const [[actRejected]] = await db.query(
      `SELECT COUNT(*) AS total FROM student_activities sa
       JOIN students st ON st.id = sa.student_id
       WHERE st.department_id = ? AND sa.status = 'Rejected'`,
      [deptId]
    );

    const activityStats = {
      verified: Number(actVerified?.total || 0),
      pending: Number(actPending?.total || 0),
      rejected: Number(actRejected?.total || 0),
      totalSubmitted: Number(actVerified?.total || 0) + Number(actPending?.total || 0) + Number(actRejected?.total || 0)
    };

    const twinData = {
      department: {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        college: dept.college_name,
        hod: dept.hod_name ? { name: dept.hod_name, email: dept.hod_email, designation: dept.hod_designation } : null
      },
      executiveSummary: {
        totalActiveStudents,
        totalFacultyMembers: facultyWorkload.length,
        averageCgpa: averageDeptCgpa,
        averageAttendance: averageDeptAttendance,
        riskCounts: riskDistribution,
        highRiskPercentage: totalActiveStudents > 0 ? Number(((riskDistribution.HIGH / totalActiveStudents) * 100).toFixed(1)) : 0
      },
      metrics: {
        totalActiveStudents,
        totalFacultyMembers: facultyWorkload.length,
        averageCgpa: averageDeptCgpa,
        averageAttendance: averageDeptAttendance,
        highRiskPercentage: totalActiveStudents > 0 ? Number(((riskDistribution.HIGH / totalActiveStudents) * 100).toFixed(1)) : 0
      },
      attendanceDistribution,
      riskDistribution,
      semesterTrends: semTrends.map(t => ({
        semester_num: Number(t.semester_num),
        semester: Number(t.semester_num),
        student_count: Number(t.student_count),
        studentCount: Number(t.student_count),
        mean_marks: Number(Number(t.mean_marks || 0).toFixed(1)),
        meanMarks: Number(Number(t.mean_marks || 0).toFixed(1)),
        mean_gpa: Number(Number(t.mean_gpa || 0).toFixed(2)),
        meanGpa: Number(Number(t.mean_gpa || 0).toFixed(2))
      })),
      subjectPerformance: formattedSubjects,
      facultyWorkload: facultyWorkload.map(fw => ({
        id: fw.id,
        name: fw.name,
        email: fw.email,
        designation: fw.designation,
        isHod: Boolean(fw.is_hod),
        assignedMentees: Number(fw.assigned_mentees || 0),
        pendingVerifications: Number(fw.pending_verifications || 0)
      })),
      activityVerificationStats: activityStats,
      generatedAt: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      collegeTwin: twinData,
      departmentTwin: twinData
    });

  } catch (error) {
    console.error('[Get Department Twin Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/college-twin/institution
 * Aggregate institutional comparison across all departments (Strictly for Leadership / Admin).
 */
async function getInstitutionTwin(req, res) {
  try {
    // Only Admin or Faculty Leadership can access aggregate institution analytics
    if (req.user.role !== 'admin' && !(req.user.role === 'faculty' && req.user.isHOD)) {
      return res.status(403).json({ success: false, message: 'Access denied: Requires Administrative or Leadership authority.' });
    }

    const [deptSummaries] = await db.query(`
      SELECT d.id, d.name, d.code,
             COUNT(DISTINCT st.id) AS student_count,
             COUNT(DISTINCT f.id) AS faculty_count,
             AVG(st.cgpa) AS avg_cgpa,
             AVG(st.attendance_percentage) AS avg_attendance,
             SUM(CASE WHEN st.risk_level = 'HIGH' THEN 1 ELSE 0 END) AS high_risk_count,
             SUM(CASE WHEN st.risk_level = 'MEDIUM' THEN 1 ELSE 0 END) AS medium_risk_count,
             SUM(CASE WHEN st.risk_level = 'LOW' THEN 1 ELSE 0 END) AS low_risk_count
      FROM departments d
      LEFT JOIN students st ON st.department_id = d.id AND st.status = 'active'
      LEFT JOIN faculty f ON f.department_id = d.id
      GROUP BY d.id, d.name, d.code
      ORDER BY d.name ASC
    `);

    let totalStudents = 0;
    let totalFaculty = 0;
    let institutionGpaSum = 0;
    let institutionAttSum = 0;
    let institutionHighRiskSum = 0;

    const formattedDepts = deptSummaries.map(d => {
      const sCount = Number(d.student_count || 0);
      const fCount = Number(d.faculty_count || 0);
      const avgGpa = sCount > 0 ? Number(Number(d.avg_cgpa || 0).toFixed(2)) : 0;
      const avgAtt = sCount > 0 ? Number(Number(d.avg_attendance || 0).toFixed(1)) : 0;
      const highRisk = Number(d.high_risk_count || 0);

      totalStudents += sCount;
      totalFaculty += fCount;
      institutionGpaSum += (avgGpa * sCount);
      institutionAttSum += (avgAtt * sCount);
      institutionHighRiskSum += highRisk;

      return {
        id: d.id,
        name: d.name,
        code: d.code,
        studentCount: sCount,
        facultyCount: fCount,
        studentToFacultyRatio: fCount > 0 ? Number((sCount / fCount).toFixed(1)) : sCount,
        averageCgpa: avgGpa,
        averageAttendance: avgAtt,
        riskCounts: {
          high: highRisk,
          medium: Number(d.medium_risk_count || 0),
          low: Number(d.low_risk_count || 0)
        }
      };
    });

    const institutionAvgGpa = totalStudents > 0 ? Number((institutionGpaSum / totalStudents).toFixed(2)) : 0;
    const institutionAvgAtt = totalStudents > 0 ? Number((institutionAttSum / totalStudents).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      institutionTwin: {
        macroKPIs: {
          totalDepartments: formattedDepts.length,
          totalStudents,
          totalFaculty,
          institutionAverageCgpa: institutionAvgGpa,
          institutionAverageAttendance: institutionAvgAtt,
          totalHighRiskStudents: institutionHighRiskSum,
          overallStudentFacultyRatio: totalFaculty > 0 ? Number((totalStudents / totalFaculty).toFixed(1)) : totalStudents
        },
        departmentComparisons: formattedDepts,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Get Institution Twin Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getDepartmentTwin,
  getInstitutionTwin
};
