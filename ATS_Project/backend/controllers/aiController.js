const { spawn } = require('child_process');
const path = require('path');
const db = require('../config/db');
require('dotenv').config();

const PYTHON_BIN = process.env.PYTHON_PATH || 'python';

// Helper to execute Python scripts with JSON payload
function executePythonScript(scriptPath, inputData) {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(PYTHON_BIN, [scriptPath]);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        if (code !== 0) {
          console.warn(`[Python Worker] Exited with code ${code}. Stderr: ${stderr}`);
          return reject(new Error(stderr || `Exited with code ${code}`));
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (parseErr) {
          reject(new Error(`Failed to parse Python JSON output: ${stdout}`));
        }
      });

      child.on('error', err => {
        reject(err);
      });

      child.stdin.write(JSON.stringify(inputData));
      child.stdin.end();
    } catch (e) {
      reject(e);
    }
  });
}

// Pure JS Fallback Engine for Explainable Academic Analysis
function runFallbackAnalysis(student, marks, attendance, achievements) {
  const currentSemester = Number(String(student.semester || '').match(/\d+/)?.[0] || 0);
  const currentMarks = currentSemester ? marks.filter(m => Number(m.semester_number) === currentSemester) : marks;
  const strong = [];
  const average = [];
  const weak = [];
  let totalMarksSum = 0;

  currentMarks.forEach(m => {
    const tot = parseFloat(m.total_marks) || 0;
    totalMarksSum += tot;
    const name = m.subject_name || 'Subject';
    if (tot >= 80) strong.push(name);
    else if (tot >= 60) average.push(name);
    else weak.push(name);
  });

  const avgMarks = currentMarks.length > 0 ? totalMarksSum / currentMarks.length : 0;

  let totalCls = 0;
  let attendedCls = 0;
  attendance.forEach(a => {
    totalCls += Number(a.classes_conducted ?? a.total_classes) || 0;
    attendedCls += Number(a.classes_attended ?? a.attended_classes) || 0;
  });
  const attPct = totalCls > 0 ? (attendedCls / totalCls) * 100 : 0;

  let attRisk = 'LOW';
  if (attPct < 75) attRisk = 'HIGH';
  else if (attPct < 80) attRisk = 'MEDIUM';

  let acadRisk = 'LOW';
  if (attPct < 75 || avgMarks < 60 || weak.length >= 2) acadRisk = 'HIGH';
  else if (attPct < 80 || avgMarks < 70 || weak.length >= 1) acadRisk = 'MEDIUM';

  const achievementNorm = Math.min(100, (achievements.length / 8) * 100);
  const compositeScore = Math.round((0.70 * avgMarks) + (0.20 * attPct) + (0.10 * achievementNorm));

  const recommendations = [];
  if (weak.length > 0) {
    weak.forEach(w => {
      recommendations.push({
        priority: 'HIGH',
        title: `Targeted Academic Recovery: ${w}`,
        reason: `Subject aggregate is in the Weak category (<60%).`,
        action: `Consult faculty mentor and solve past 3 years' semester question papers.`,
        category: 'Academic Recovery'
      });
    });
  }

  if (attRisk === 'HIGH') {
    recommendations.push({
      priority: 'HIGH',
      title: 'Mandatory Attendance Normalization',
      reason: `Overall attendance is ${attPct.toFixed(1)}%, which is below the required 75% institutional threshold.`,
      action: 'Attend all remaining lecture hours and laboratory sessions without absence.',
      category: 'Attendance Compliance'
    });
  }

  const bySubject = new Map();
  marks.forEach(m => {
    const bucket = bySubject.get(m.subject_name) || [];
    bucket.push({ semester: Number(m.semester_number || 0), total: Number(m.total_marks || 0) });
    bySubject.set(m.subject_name, bucket);
  });
  const fallingSubjects = [];
  bySubject.forEach((records, subject) => {
    records.sort((a,b) => a.semester-b.semester);
    if (records.length > 1 && records.at(-1).total < records.at(-2).total) fallingSubjects.push(subject);
  });
  fallingSubjects.forEach(subject => recommendations.push({ priority: 'MEDIUM', title: `Review falling performance in ${subject}`, reason: 'The latest recorded score is lower than the preceding semester score.', action: 'Review recent feedback and agree a practice plan with the subject faculty.', category: 'Performance Trend' }));
  const semesterScores = new Map();
  marks.forEach(m => {
    const semester = Number(m.semester_number || 0), credits = Number(m.credits || 1), total = Number(m.total_marks || 0);
    const gp = m.grade_point != null ? Number(m.grade_point) : total>=90?10:total>=80?9:total>=70?8:total>=60?7:total>=50?6:0;
    const bucket = semesterScores.get(semester) || { points:0,credits:0 };
    bucket.points += gp*credits; bucket.credits += credits; semesterScores.set(semester,bucket);
  });
  const semesterTrend = [...semesterScores.entries()].sort((a,b)=>a[0]-b[0]).map(([semester,v])=>({semester,gpa:Number((v.points/v.credits).toFixed(2))}));
  if (semesterTrend.length>1 && semesterTrend.at(-1).gpa<semesterTrend.at(-2).gpa) recommendations.push({priority:'MEDIUM',title:'Review recent semester performance trend',reason:`Calculated semester GPA decreased from ${semesterTrend.at(-2).gpa.toFixed(2)} to ${semesterTrend.at(-1).gpa.toFixed(2)}.`,action:'Review recent marks with an academic advisor and plan focused support.',category:'Performance Trend'});
  if (achievements.length === 0) recommendations.push({ priority: 'LOW', title: 'Build an achievement portfolio', reason: 'No verified achievements are currently recorded.', action: 'Consider adding a verified workshop, competition, certification, or project outcome.', category: 'Achievement Gap' });

  return {
    analysis_type: 'Explainable Rule-Based Analytics & Statistical Evaluation (Built-in ATS Engine)',
    performance_level: avgMarks >= 85 ? 'Excellent' : avgMarks >= 70 ? 'Proficient / Good' : 'Needs Support',
    academic_risk: acadRisk,
    attendance_risk: attRisk,
    composite_academic_score: compositeScore,
    statistical_metrics: {
      mean: parseFloat(avgMarks.toFixed(2)),
      sample_count: currentMarks.length
    },
    overall_attendance: parseFloat(attPct.toFixed(1)),
    strong_subjects: strong,
    average_subjects: average,
    weak_subjects: weak,
    falling_subjects: fallingSubjects,
    semester_trend: semesterTrend,
    recommendations,
    explanation: 'Calculated using 70% weighted subject performance, 20% attendance compliance, and 10% co-curricular achievement factor.'
  };
}

// GET /api/ai/analysis/:studentId
async function getAnalysis(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const [students] = await db.query('SELECT st.*,d.name AS department FROM students st LEFT JOIN departments d ON d.id=st.department_id WHERE st.id = ?', [studentId]);

    if (!students || students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const student = students[0];
    const [marks] = await db.query('SELECT m.*,s.subject_name,s.credits,se.semester_number FROM marks m JOIN subjects s ON s.id=m.subject_id LEFT JOIN semesters se ON se.id=m.semester_id WHERE m.student_id = ? ORDER BY se.semester_number', [studentId]);
    const [attendance] = await db.query('SELECT a.*,s.subject_name,se.semester_number FROM attendance a JOIN subjects s ON s.id=a.subject_id JOIN semesters se ON se.id=a.semester_id WHERE a.student_id = ? AND a.semester_id=?', [studentId, student.current_semester_id]);
    const [attendanceHistory] = await db.query('SELECT a.*,s.subject_name,se.semester_number FROM attendance a JOIN subjects s ON s.id=a.subject_id JOIN semesters se ON se.id=a.semester_id WHERE a.student_id = ? ORDER BY se.semester_number', [studentId]);
    const [achievements] = await db.query("SELECT * FROM achievements WHERE student_id = ? AND status='Verified'", [studentId]);

    const semesterMarks = marks.filter(m => Number(m.semester_number) === Number(student.semester.match(/\d+/)?.[0] || 0));
    const currentCredits = semesterMarks.reduce((n,m) => n+Number(m.credits||0),0);
    const currentGpa = currentCredits ? semesterMarks.reduce((n,m) => n+Number(m.grade_point||0)*Number(m.credits||0),0)/currentCredits : 0;
    const payload = {
      id: student.id,
      name: student.name,
      register_number: student.register_number,
      department: student.department,
      gpa: currentGpa,
      current_semester_number: Number(student.semester.match(/\d+/)?.[0] || 0),
      marks,
      attendance,
      attendance_history: attendanceHistory,
      achievements
    };

    const pythonScript = path.join(__dirname, '../../ai/analysis.py');

    try {
      const pyResult = await executePythonScript(pythonScript, payload);
      return res.status(200).json({
        success: true,
        source: 'Python AI Analytics Engine',
        data: pyResult
      });
    } catch (pyErr) {
      console.warn('[AI Engine Notice] Using local JS rule-based analytics fallback:', pyErr.message);
      const fallbackResult = runFallbackAnalysis(student, marks, attendance, achievements);
      return res.status(200).json({
        success: true,
        source: 'ATS Built-In Explainable Analytics Engine (Local Fallback)',
        data: fallbackResult
      });
    }

  } catch (error) {
    console.error('[AI Analysis Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/ai/run-agent
async function runAgent(req, res) {
  try {
    const studentId = parseInt(req.body.student_id, 10);
    const [students] = await db.query('SELECT st.*,d.name AS department FROM students st LEFT JOIN departments d ON d.id=st.department_id WHERE st.id = ?', [studentId]);

    if (!students || students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const student = students[0];
    const [marks] = await db.query('SELECT m.*,s.subject_name,s.credits,se.semester_number FROM marks m JOIN subjects s ON s.id=m.subject_id LEFT JOIN semesters se ON se.id=m.semester_id WHERE m.student_id = ? ORDER BY se.semester_number', [studentId]);
    const [attendance] = await db.query('SELECT a.*,s.subject_name,se.semester_number FROM attendance a JOIN subjects s ON s.id=a.subject_id JOIN semesters se ON se.id=a.semester_id JOIN students st ON st.id=a.student_id WHERE a.student_id = ? AND a.semester_id=st.current_semester_id', [studentId]);
    const [achievements] = await db.query("SELECT * FROM achievements WHERE student_id = ? AND status='Verified'", [studentId]);

    const payload = {
      name: student.name,
      register_number: student.register_number,
      current_semester_number: Number(student.semester.match(/\d+/)?.[0] || 0),
      marks,
      attendance,
      achievements
    };

    const agentScript = path.join(__dirname, '../../agent/academic_agent.py');
    let report = null;

    try {
      report = await executePythonScript(agentScript, payload);
    } catch (pyErr) {
      // Intelligent Agent JS Fallback
      report = {
        agent_name: 'ATS Intelligent Academic Monitoring Agent v2.4 (Engine Fallback)',
        execution_timestamp: new Date().toISOString(),
        target_student: { name: student.name, register_number: student.register_number },
        alerts: [
          ...attendance.filter(a => Number(a.percentage) < 75).map(a => ({priority:'HIGH',type:'ATTENDANCE_CRITICAL',title:`Attendance risk in ${a.subject_name}`,alert:`Attendance is ${Number(a.percentage).toFixed(1)}%, below the configured 75% threshold.`,recommendation:'Attend upcoming classes and consult the assigned faculty member.',explainable_reason:`Observed ${a.attended_classes}/${a.total_classes} classes attended.`})),
          ...marks.filter(m => Number(m.semester_number) === Number(payload.current_semester_number) && Number(m.total_marks) < 60).map(m => ({priority:'HIGH',type:'ACADEMIC_DEFICIT',title:`Low score in ${m.subject_name}`,alert:`Recorded total is ${m.total_marks}/100.`,recommendation:'Review feedback and arrange targeted practice with faculty.',explainable_reason:'Current stored mark is below 60/100.'})),
          ...(achievements.length ? [] : [{priority:'LOW',type:'ACHIEVEMENT_GAP',title:'No verified achievements on record',alert:'The database contains no verified achievements for this student.',recommendation:'Record relevant workshop, certification, sports, or competition achievements after verification.',explainable_reason:'Counted verified achievement rows in the database.'}])
        ],
        overall_status: attendance.some(a=>Number(a.percentage)<75) || marks.some(m=>Number(m.semester_number) === Number(payload.current_semester_number) && Number(m.total_marks)<60) ? 'Intervention Needed' : 'Stable Monitoring'
      };
    }

    for (const alert of (report.alerts || [])) {
      await db.query('INSERT INTO risk_alerts(student_id,alert_type,severity,message) VALUES(?,?,?,?)',
        [studentId, alert.type || 'ACADEMIC_REVIEW', alert.priority || 'LOW', alert.alert || alert.title || 'Academic review recommended.']);
    }

    return res.status(200).json({
      success: true,
      message: 'Intelligent Academic Monitoring Agent cycle completed successfully.',
      data: report
    });
  } catch (error) {
    console.error('[Run Agent Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getAnalysis,
  runAgent
};
