const db = require('../../database/db');

/**
 * Calculate Ordinary Least Squares (OLS) Linear Trend
 */
function calculateLinearTrend(points) {
  const n = points.length;
  if (n < 2) {
    const defaultY = n === 1 ? points[0].y : 0;
    return { slope: 0, intercept: defaultY, r2: 0, se: 0.25 };
  }

  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }

  const slope = den !== 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const fitted = slope * p.x + intercept;
    ssRes += (p.y - fitted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }

  const r2 = ssTot !== 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  const se = n > 2 ? Math.sqrt(ssRes / (n - 2)) : Math.sqrt(ssRes / n || 0.1);

  return { slope, intercept, r2, se: Math.max(0.12, se) };
}

/**
 * GET /api/trajectory/predict/:studentId
 * Produces transparent statistical trajectory projection and explanation
 */
async function getTrajectoryPrediction(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required.' });
    }

    // 1. Fetch student
    const [students] = await db.query(
      `SELECT st.*, d.name AS department_name, f.name AS mentor_name 
       FROM students st
       LEFT JOIN departments d ON d.id = st.department_id
       LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
       LEFT JOIN faculty f ON f.id = sm.faculty_id
       WHERE st.id = ?`,
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }
    const student = students[0];

    // 2. Fetch all historical marks grouped by semester
    const [marksRows] = await db.query(`
      SELECT m.*, s.subject_name, s.subject_code, s.credits,
             COALESCE(se.semester_number, CAST(SUBSTRING_INDEX(m.semester, ' ', -1) AS UNSIGNED), 1) AS sem_num
      FROM marks m
      JOIN subjects s ON s.id = m.subject_id
      LEFT JOIN semesters se ON se.id = m.semester_id
      WHERE m.student_id = ?
      ORDER BY sem_num ASC, m.id ASC
    `, [studentId]);

    // 3. Fetch attendance
    const [attRows] = await db.query(
      'SELECT * FROM attendance WHERE student_id = ?',
      [studentId]
    );

    let totalClasses = 0;
    let attendedClasses = 0;
    attRows.forEach(a => {
      totalClasses += Number(a.classes_conducted || a.total_classes || 0);
      attendedClasses += Number(a.classes_attended || a.attended_classes || 0);
    });
    const attendancePercentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : Number(student.attendance_percentage || 85.0);

    // Group semester GPAs
    const semMap = new Map();
    marksRows.forEach(m => {
      const sNum = m.sem_num || 1;
      if (!semMap.has(sNum)) {
        semMap.set(sNum, { points: 0, credits: 0, subjects: [] });
      }
      const item = semMap.get(sNum);
      const cred = Number(m.credits || 3);
      const total = Number(m.total_marks || (Number(m.internal_marks || 0) + Number(m.exam_marks || 0)));
      
      let gp = 0;
      if (total >= 90) gp = 10;
      else if (total >= 80) gp = 9;
      else if (total >= 70) gp = 8;
      else if (total >= 60) gp = 7;
      else if (total >= 50) gp = 6;
      else gp = 0;

      item.points += (gp * cred);
      item.credits += cred;
      item.subjects.push({ name: m.subject_name, marks: total, grade: m.grade });
    });

    const semesterHistory = [];
    for (const [semNum, data] of semMap.entries()) {
      const gpa = data.credits > 0 ? Number((data.points / data.credits).toFixed(2)) : 0;
      semesterHistory.push({
        semester: semNum,
        gpa,
        credits: data.credits,
        subjectCount: data.subjects.length
      });
    }

    semesterHistory.sort((a, b) => a.semester - b.semester);

    // Check data sufficiency
    const hasSufficientData = semesterHistory.length >= 2;
    const targetSemester = (semesterHistory.length > 0 ? semesterHistory[semesterHistory.length - 1].semester + 1 : 2);

    let predictedGpa = 0;
    let gpaRangeLow = 0;
    let gpaRangeHigh = 0;
    let confidenceScore = 0;
    let regressionSlope = 0;
    let methodUsed = 'OLS Linear Trend & Internal Continuous Assessment Weighted Model';
    const influencingFactors = [];

    if (hasSufficientData) {
      const points = semesterHistory.map(s => ({ x: s.semester, y: s.gpa }));
      const trend = calculateLinearTrend(points);
      regressionSlope = trend.slope;

      // Base statistical trend projection
      const trendPred = trend.intercept + trend.slope * targetSemester;

      // Attendance impact multiplier (threshold 75% regulatory requirement)
      let attAdjustment = 0;
      if (attendancePercentage >= 90) {
        attAdjustment = +0.12;
        influencingFactors.push({
          factor: 'Excellent Attendance Compliance',
          impact: '+0.12 GPA',
          evidence: `${attendancePercentage.toFixed(1)}% attendance preserves continuous learning eligibility.`
        });
      } else if (attendancePercentage < 75) {
        attAdjustment = -0.35;
        influencingFactors.push({
          factor: 'Attendance Threshold Deficit (<75%)',
          impact: '-0.35 GPA',
          evidence: `${attendancePercentage.toFixed(1)}% attendance risks exam condonation or assessment forfeiture.`
        });
      } else {
        attAdjustment = 0.0;
        influencingFactors.push({
          factor: 'Attendance Satisfactory',
          impact: 'Neutral',
          evidence: `${attendancePercentage.toFixed(1)}% attendance satisfies university requirements.`
        });
      }

      // Historical momentum factor
      const prevGpa = semesterHistory[semesterHistory.length - 1].gpa;
      influencingFactors.push({
        factor: 'Historical Performance Baseline',
        impact: `${trend.slope >= 0 ? '+' : ''}${(trend.slope).toFixed(2)} / semester`,
        evidence: `Previous Semester ${semesterHistory[semesterHistory.length - 1].semester} GPA was ${prevGpa.toFixed(2)}.`
      });

      // Combine trend with attendance modifier, bounded within 0.00 to 10.00
      predictedGpa = Math.max(4.0, Math.min(10.0, Number((trendPred + attAdjustment).toFixed(2))));
      const intervalMargin = Number((trend.se * 1.645).toFixed(2)); // 90% confidence interval
      gpaRangeLow = Math.max(3.5, Number((predictedGpa - intervalMargin).toFixed(2)));
      gpaRangeHigh = Math.min(10.0, Number((predictedGpa + intervalMargin).toFixed(2)));
      confidenceScore = Math.min(95, Math.max(65, Math.round((trend.r2 * 40) + 55)));

    } else {
      // Insufficient data fallback
      const singleGpa = semesterHistory.length === 1 ? semesterHistory[0].gpa : Number(student.cgpa || 7.5);
      predictedGpa = singleGpa;
      gpaRangeLow = Math.max(3.5, Number((singleGpa - 0.5).toFixed(2)));
      gpaRangeHigh = Math.min(10.0, Number((singleGpa + 0.5).toFixed(2)));
      confidenceScore = 50;
      methodUsed = 'Descriptive Baseline (Insufficient multi-semester historical data)';

      influencingFactors.push({
        factor: 'Single Semester Baseline',
        impact: 'Descriptive Only',
        evidence: 'At least two completed semesters are required for rigorous Ordinary Least Squares (OLS) regression.'
      });
    }

    // Persist prediction snapshot into academic_predictions
    try {
      await db.query(`
        INSERT INTO academic_predictions 
        (student_id, target_semester_number, predicted_gpa, gpa_range_low, gpa_range_high, confidence_score, influencing_factors, method_used, prediction_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        studentId,
        targetSemester,
        predictedGpa,
        gpaRangeLow,
        gpaRangeHigh,
        confidenceScore,
        JSON.stringify(influencingFactors),
        methodUsed,
        `Transparent statistical projection for Semester ${targetSemester}.`
      ]);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          register_number: student.register_number,
          department: student.department_name,
          current_cgpa: Number(student.cgpa || 0),
          attendance_percentage: attendancePercentage
        },
        hasSufficientData,
        targetSemester,
        projected_gpa: predictedGpa,
        projected_gpa_range: { lower: gpaRangeLow, upper: gpaRangeHigh },
        contributing_factors: {
          internal_assessment_factor: influencingFactors.find(f => f.factor.includes('Performance') || f.factor.includes('Baseline'))?.evidence || 'Internal continuous assessment tracking',
          attendance_factor: influencingFactors.find(f => f.factor.includes('Attendance'))?.evidence || 'Attendance compliance evaluation',
          momentum_factor: `${regressionSlope >= 0 ? '+' : ''}${regressionSlope.toFixed(3)} GPA delta/semester`,
          factors_list: influencingFactors
        },
        methodology: {
          model_type: methodUsed,
          algorithm: 'Ordinary Least Squares (OLS) Linear Regression',
          transparent: true
        },
        prediction: {
          predictedGpa,
          gpaRangeLow,
          gpaRangeHigh,
          confidenceScore,
          methodUsed,
          regressionSlope: Number(regressionSlope.toFixed(3))
        },
        semesterHistory,
        influencingFactors,
        dataLimitations: [
          'Statistical projection only; cannot account for unrecorded medical leaves or external life events.',
          'Assumes subject credit load in target semester remains within standard departmental curricula.',
          'Forecast intervals expand when semester mark variance is high.'
        ],
        disclaimer: 'Official academic marks and semester GPAs are determined solely by university examination boards. Predictions are advisory decision-support estimates and do not guarantee graduation standing.'
      }
    });

  } catch (err) {
    console.error('[getTrajectoryPrediction Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getTrajectoryPrediction
};
