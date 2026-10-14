const db = require('../config/db');

// Calculate Explainable Academic Score (Requirement 13)
// 70% Academic Marks + 20% Attendance + 10% Achievement Activity
function calculateAcademicScore(avgMarks, attendancePct, achievementCount) {
  // Normalize achievement activity (up to 10 achievements = 100%)
  const achievementScore = Math.min(100, (achievementCount / 8) * 100);
  const marksComponent = (avgMarks * 0.70);
  const attendanceComponent = (attendancePct * 0.20);
  const achievementComponent = (achievementScore * 0.10);

  const totalScore = Math.round(marksComponent + attendanceComponent + achievementComponent);

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    components: {
      marks: { weight: '70%', value: avgMarks, contribution: parseFloat(marksComponent.toFixed(1)) },
      attendance: { weight: '20%', value: attendancePct, contribution: parseFloat(attendanceComponent.toFixed(1)) },
      achievements: { weight: '10%', count: achievementCount, contribution: parseFloat(achievementComponent.toFixed(1)) }
    },
    formula: 'Academic Score = (70% × Avg Marks) + (20% × Attendance) + (10% × Achievement Activity)'
  };
}

// Determine Academic Risk Level
function determineRiskLevel(gpa, attendance, weakSubjectCount) {
  if (attendance < 75 || gpa < 6.0 || weakSubjectCount >= 2) {
    return 'HIGH';
  } else if (attendance < 80 || gpa < 7.5 || weakSubjectCount >= 1) {
    return 'MEDIUM';
  }
  return 'LOW';
}

// GET /api/dashboard/:studentId
async function getStudentDashboard(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const [studentRows] = await db.query('SELECT st.*,d.name AS department FROM students st LEFT JOIN departments d ON d.id=st.department_id WHERE st.id = ?', [studentId]);

    if (!studentRows || studentRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const student = studentRows[0];
    const [marks] = await db.query('SELECT m.*, su.subject_name, su.credits, se.semester_number FROM marks m JOIN subjects su ON su.id=m.subject_id LEFT JOIN semesters se ON se.id=m.semester_id WHERE m.student_id = ? AND (m.semester_id = ? OR m.semester_id IS NULL)', [studentId, student.current_semester_id]);
    const [allMarks] = await db.query('SELECT m.*, su.subject_name, su.credits, se.semester_number FROM marks m JOIN subjects su ON su.id=m.subject_id LEFT JOIN semesters se ON se.id=m.semester_id WHERE m.student_id = ? ORDER BY se.semester_number', [studentId]);
    const [attendance] = await db.query('SELECT a.*, su.subject_name FROM attendance a JOIN subjects su ON su.id=a.subject_id WHERE a.student_id = ? AND (a.semester_id = ? OR a.semester_id IS NULL)', [studentId, student.current_semester_id]);
    const [achievements] = await db.query('SELECT * FROM achievements WHERE student_id = ?', [studentId]);
    const [recommendations] = await db.query("SELECT * FROM recommendations WHERE student_id = ? AND status = 'Active'", [studentId]);
    const [notifications] = await db.query('SELECT * FROM notifications WHERE student_id = ? ORDER BY created_at DESC LIMIT 5', [studentId]);

    // Average Marks
    let totalMarks = 0;
    let weakCount = 0;
    marks.forEach(m => {
      const tot = Number(m.total_marks) || 0;
      totalMarks += tot;
      if (tot < 60 || m.status === 'Weak') weakCount++;
    });
    const avgMarks = marks.length > 0 ? parseFloat((totalMarks / marks.length).toFixed(2)) : 0;

    // Attendance
    let totalCls = 0;
    let attendedCls = 0;
    attendance.forEach(a => {
      totalCls += Number(a.classes_conducted ?? a.total_classes) || 0;
      attendedCls += Number(a.classes_attended ?? a.attended_classes) || 0;
    });
    const attendancePct = totalCls > 0 ? parseFloat(((attendedCls / totalCls) * 100).toFixed(2)) : 0;

    // Academic Score Calculation
    const verifiedAchievements = achievements.filter(a => a.status === 'Verified').length;
    const academicScoreObj = calculateAcademicScore(avgMarks, attendancePct, verifiedAchievements);
    const pointsFor = m => m.grade_point != null ? Number(m.grade_point) : Number(m.total_marks)>=90?10:Number(m.total_marks)>=80?9:Number(m.total_marks)>=70?8:Number(m.total_marks)>=60?7:Number(m.total_marks)>=50?6:0;
    const gradePoints = marks.reduce((sum, m) => sum + pointsFor(m) * Number(m.credits || 0), 0);
    const creditTotal = marks.reduce((sum, m) => sum + Number(m.credits || 0), 0);
    const gpa = creditTotal ? gradePoints / creditTotal : 0;
    const allGradePoints = allMarks.reduce((sum, m) => sum + pointsFor(m) * Number(m.credits || 0), 0);
    const allCredits = allMarks.reduce((sum, m) => sum + Number(m.credits || 0), 0);
    const cgpa = allCredits ? allGradePoints / allCredits : 0;
    const riskLevel = determineRiskLevel(gpa, attendancePct, weakCount);

    // Chart 1: Subject Performance Bar Chart Data
    const subjectPerformanceChart = {
      labels: marks.map(m => m.subject_name || 'Subject'),
      datasets: [
        {
          label: 'Total Score',
          data: marks.map(m => parseFloat(m.total_marks) || 0),
          backgroundColor: marks.map(m => {
            const tot = parseFloat(m.total_marks) || 0;
            return tot >= 80 ? 'rgba(56, 189, 248, 0.85)' : tot >= 60 ? 'rgba(251, 191, 36, 0.85)' : 'rgba(239, 68, 68, 0.85)';
          }),
          borderRadius: 8
        }
      ]
    };

    // Chart 2: academic trend is calculated from stored semester grades.
    const semesterMap = new Map();
    allMarks.forEach(m => {
      const n = Number(m.semester_number);
      if (!n) return;
      const bucket = semesterMap.get(n) || { points: 0, credits: 0 };
      bucket.points += Number(m.grade_point || 0) * Number(m.credits || 0);
      bucket.credits += Number(m.credits || 0);
      semesterMap.set(n, bucket);
    });
    const semesterEntries = [...semesterMap.entries()].sort((a,b) => a[0]-b[0]);
    const academicTrendChart = {
      labels: semesterEntries.map(([n]) => `Semester ${n}`),
      datasets: [
        {
          label: 'Semester SGPA',
          data: semesterEntries.map(([,v]) => v.credits ? Number((v.points/v.credits).toFixed(2)) : 0),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          fill: true,
          tension: 0.4,
          pointRadius: 5
        }
      ]
    };

    // Chart 3: attendance trend uses recorded semester attendance.
    const [attendanceHistory] = await db.query('SELECT se.semester_number, SUM(a.classes_attended) attended, SUM(a.classes_conducted) conducted FROM attendance a JOIN semesters se ON se.id=a.semester_id WHERE a.student_id=? GROUP BY se.semester_number ORDER BY se.semester_number', [studentId]);
    const attendanceTrendChart = {
      labels: attendanceHistory.map(r => `Semester ${r.semester_number}`),
      datasets: [
        {
          label: 'Attendance %',
          data: attendanceHistory.map(r => Number(r.conducted) ? Number((100*r.attended/r.conducted).toFixed(1)) : 0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 5
        },
        {
          label: 'Minimum Safe Threshold (75%)',
          data: attendanceHistory.map(() => 75),
          borderColor: '#ef4444',
          borderDash: [6, 6],
          pointRadius: 0,
          fill: false
        }
      ]
    };

    // Chart 4: Achievement Distribution Chart Data
    const catMap = {};
    achievements.forEach(a => {
      catMap[a.category] = (catMap[a.category] || 0) + 1;
    });
    const achievementDistChart = {
      labels: Object.keys(catMap),
      datasets: [
        {
        data: Object.values(catMap),
          backgroundColor: [
            '#6366f1',
            '#38bdf8',
            '#10b981',
            '#f59e0b',
            '#ec4899',
            '#8b5cf6'
          ]
        }
      ]
    };

    return res.status(200).json({
      success: true,
      student: {
        id: student.id,
        register_number: student.register_number,
        name: student.name,
        email: student.email,
        department: student.department,
        year: student.year,
        semester: student.semester,
        avatar: student.avatar
      },
      kpi: {
        gpa: Number(gpa.toFixed(2)),
        cgpa: Number(cgpa.toFixed(2)),
        attendance: attendancePct,
        achievementsCount: verifiedAchievements,
        academicScore: academicScoreObj.score,
        academicScoreDetails: academicScoreObj,
        riskLevel: riskLevel
      },
      charts: {
        subjectPerformance: subjectPerformanceChart,
        academicTrend: academicTrendChart,
        attendanceTrend: attendanceTrendChart,
        achievementDistribution: achievementDistChart
      },
      recentRecommendations: recommendations.slice(0, 3),
      recentNotifications: notifications
    });
  } catch (error) {
    console.error('[Student Dashboard Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/dashboard/admin/summary
async function getAdminSummary(req, res) {
  try {
    const [students] = await db.query(`SELECT st.id,st.register_number,st.name,d.name AS department,st.year,st.semester,
      COALESCE((SELECT SUM(m.grade_point*su.credits)/NULLIF(SUM(su.credits),0) FROM marks m JOIN subjects su ON su.id=m.subject_id WHERE m.student_id=st.id AND m.semester_id=st.current_semester_id),0) AS gpa,
      COALESCE((SELECT 100*SUM(a.classes_attended)/NULLIF(SUM(a.classes_conducted),0) FROM attendance a WHERE a.student_id=st.id AND a.semester_id=st.current_semester_id),0) AS attendance,
      (SELECT COUNT(*) FROM marks m WHERE m.student_id=st.id AND m.semester_id=st.current_semester_id AND m.total_marks<60) AS weak_count
      FROM students st LEFT JOIN departments d ON d.id=st.department_id WHERE st.status='active' ORDER BY st.id`);
    const [achievements] = await db.query('SELECT * FROM achievements');
    const [departments] = await db.query('SELECT COUNT(*) AS total FROM departments');
    const [recentAchievements] = await db.query('SELECT a.id,a.title,a.category,a.achievement_date,a.status,s.name AS student_name,s.register_number FROM achievements a JOIN students s ON s.id=a.student_id ORDER BY a.achievement_date DESC LIMIT 8');

    let totalGpa = 0;
    let totalAttendance = 0;
    let atRiskCount = 0;

    const riskTable = students.map(st => {
      const gpa = Number(st.gpa) || 0;
      const att = Number(st.attendance) || 0;
      totalGpa += gpa;
      totalAttendance += att;

      let risk = 'LOW';
      let rec = 'Maintain current academic progress and consistency.';

      if (att < 75 || gpa < 6.0 || Number(st.weak_count) >= 2) {
        risk = 'HIGH';
        rec = 'Urgent faculty mentorship required for attendance and remedial subjects.';
      } else if (att < 85 || gpa < 7.5 || Number(st.weak_count) >= 1) {
        risk = 'MEDIUM';
        rec = 'Advised to attend weekend problem-solving clinics.';
      }
      if (risk !== 'LOW') atRiskCount++;

      return {
        id: st.id,
        register_number: st.register_number,
        name: st.name,
        department: st.department,
        year: st.year,
        gpa: gpa.toFixed(2),
        attendance: att.toFixed(1) + '%',
        performance: gpa >= 8.5 ? 'Distinction' : gpa >= 7.0 ? 'First Class' : 'Remedial',
        risk: risk,
        recommendation: rec
      };
    });

    const studentCount = students.length || 1;
    const avgGpa = (totalGpa / studentCount).toFixed(2);
    const avgAttendance = (totalAttendance / studentCount).toFixed(1);

    return res.status(200).json({
      success: true,
      stats: {
        totalStudents: students.length,
        averageGpa: parseFloat(avgGpa),
        averageAttendance: parseFloat(avgAttendance),
        atRiskStudents: atRiskCount,
        totalAchievements: achievements.length,
        totalDepartments: departments[0]?.total || 0
      },
      riskTable,
      recentAchievements
    });
  } catch (error) {
    console.error('[Admin Summary Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getStudentDashboard,
  getAdminSummary,
  calculateAcademicScore,
  determineRiskLevel
};
