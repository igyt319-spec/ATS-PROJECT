/**
 * ATS Academic What-If Simulator Controller
 * =========================================
 * Feature 6: Academic What-If Simulator
 * 
 * Provides transparent, deterministic mathematical simulation of:
 * 1. Target GPA Marks Solver: "What examination marks do I need to reach my target GPA?"
 * 2. Marks Impact Scenario: "How do hypothetical internal/exam changes alter my semester GPA?"
 * 3. Attendance Projection: "How will attending/missing N upcoming classes affect my attendance %?"
 * 4. High-Leverage Subject Prioritizer: "Which subjects give the highest CGPA boost per effort unit?"
 * 
 * STRICT ARCHITECTURAL RULE:
 * This simulator is 100% READ-ONLY and NON-DESTRUCTIVE.
 * Simulated inputs NEVER modify live marks, attendance, or student database records.
 */

const db = require('../config/db');

// Institutional Grading Scale (Regulation 2026)
const GRADING_SCALE = [
  { minMark: 90, grade: 'A+', gradePoint: 10.0, status: 'Strong' },
  { minMark: 80, grade: 'A', gradePoint: 9.0, status: 'Strong' },
  { minMark: 70, grade: 'B+', gradePoint: 8.0, status: 'Average' },
  { minMark: 60, grade: 'B', gradePoint: 7.0, status: 'Average' },
  { minMark: 50, grade: 'C', gradePoint: 6.0, status: 'Weak' },
  { minMark: 0, grade: 'F', gradePoint: 0.0, status: 'Weak' }
];

function markToGradePoint(totalMark) {
  const m = Math.max(0, Math.min(100, Number(totalMark)));
  for (const rule of GRADING_SCALE) {
    if (m >= rule.minMark) {
      return { grade: rule.grade, gradePoint: rule.gradePoint, status: rule.status };
    }
  }
  return { grade: 'F', gradePoint: 0.0, status: 'Weak' };
}

function calculateSemesterGpa(subjectMarks) {
  let totalPoints = 0;
  let totalCredits = 0;

  for (const s of subjectMarks) {
    const credits = Number(s.credits || 3);
    const total = Number(s.totalMarks || (Number(s.internalMarks || 0) + Number(s.assignmentMarks || 0) + Number(s.examMarks || 0)));
    const { gradePoint } = markToGradePoint(total);
    totalPoints += (gradePoint * credits);
    totalCredits += credits;
  }

  return totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : 0;
}

/**
 * POST /api/simulator/target-gpa
 * Solves the required exam marks to achieve a target semester GPA.
 */
async function simulateTargetGpa(req, res) {
  try {
    const { student_id, target_gpa, subject_overrides } = req.body;

    if (!student_id) {
      return res.status(400).json({ success: false, message: 'Valid student_id is required.' });
    }

    const targetGpa = Number(target_gpa);
    if (isNaN(targetGpa) || targetGpa < 4.0 || targetGpa > 10.0) {
      return res.status(400).json({
        success: false,
        message: 'Target GPA must be a valid number between 4.00 and 10.00.'
      });
    }

    // Fetch current student active subjects
    const [marksRows] = await db.query(
      `SELECT m.id, m.subject_id, s.subject_name, s.subject_code, s.credits,
              m.internal_marks, m.assignment_marks, m.exam_marks, m.total_marks
       FROM marks m
       JOIN subjects s ON s.id = m.subject_id
       JOIN students st ON st.id = m.student_id
       WHERE m.student_id = ? AND (m.semester_id = st.current_semester_id OR m.semester_id IS NULL)
       ORDER BY s.credits DESC, s.subject_code ASC`,
      [student_id]
    );

    if (marksRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No enrolled subjects found for current semester simulation.'
      });
    }

    // Build subject list with existing internal & assignment marks
    const subjects = marksRows.map(row => {
      const override = Array.isArray(subject_overrides) 
        ? subject_overrides.find(o => o.subject_id === row.subject_id || o.subject_code === row.subject_code)
        : null;

      const internal = override?.internal_marks !== undefined ? Number(override.internal_marks) : Number(row.internal_marks || 0);
      const assignment = override?.assignment_marks !== undefined ? Number(override.assignment_marks) : Number(row.assignment_marks || 0);
      const credits = Number(row.credits || 3);

      return {
        subjectId: row.subject_id,
        subjectCode: row.subject_code,
        subjectName: row.subject_name,
        credits,
        internalMarks: Math.min(20, Math.max(0, internal)),
        assignmentMarks: Math.min(20, Math.max(0, assignment)),
        currentExamMarks: Number(row.exam_marks || 0),
        currentTotal: Number(row.total_marks || 0)
      };
    });

    const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
    const requiredGradePointsSum = targetGpa * totalCredits;

    // Maximum achievable GPA check (if student gets 60/60 in all exams)
    const maxSubjectStates = subjects.map(s => {
      const maxTotal = s.internalMarks + s.assignmentMarks + 60; // Max exam mark is 60
      const { gradePoint } = markToGradePoint(maxTotal);
      return { ...s, maxTotal, maxGradePoint: gradePoint };
    });
    const maxAchievablePoints = maxSubjectStates.reduce((sum, s) => sum + (s.maxGradePoint * s.credits), 0);
    const maxAchievableGpa = Number((maxAchievablePoints / totalCredits).toFixed(2));

    if (targetGpa > maxAchievableGpa) {
      return res.status(200).json({
        success: true,
        isAchievable: false,
        targetGpa,
        maxAchievableGpa,
        message: `Target GPA of ${targetGpa.toFixed(2)} is mathematically unachievable with current internal assessment scores (maximum reachable is ${maxAchievableGpa.toFixed(2)} even with 100% exam marks).`,
        assumptions: 'Based on 20 internal marks, 20 assignment marks, and a 60-mark semester final examination limit.',
        recommendation: 'Target a revised GPA threshold or explore continuous assessment re-tests.'
      });
    }

    // Greedy solver: Allocate required marks proportionally across subjects
    // Each target total = required continuous assessment + needed exam marks
    // We determine required grade points per subject
    let allocatedPoints = 0;
    const solutions = subjects.map(s => {
      const fixedContinuous = s.internalMarks + s.assignmentMarks;
      // We aim for an exam mark that satisfies target proportion
      // Target grade point per subject roughly targetGpa
      const desiredGp = Math.min(10, Math.ceil(targetGpa));
      const neededMinMark = desiredGp === 10 ? 90 : desiredGp === 9 ? 80 : desiredGp === 8 ? 70 : desiredGp === 7 ? 60 : 50;
      let neededExam = Math.max(0, neededMinMark - fixedContinuous);
      neededExam = Math.min(60, Math.max(21, neededExam)); // 21/60 is pass mark for 35% theory

      const simulatedTotal = Math.min(100, fixedContinuous + neededExam);
      const { grade, gradePoint, status } = markToGradePoint(simulatedTotal);
      allocatedPoints += (gradePoint * s.credits);

      return {
        subjectId: s.subjectId,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        credits: s.credits,
        internalMarks: s.internalMarks,
        assignmentMarks: s.assignmentMarks,
        requiredExamMarks: Math.ceil(neededExam),
        maxExamMarks: 60,
        projectedTotal: simulatedTotal,
        projectedGrade: grade,
        projectedGradePoint: gradePoint,
        projectedStatus: status
      };
    });

    const projectedGpa = Number((allocatedPoints / totalCredits).toFixed(2));

    return res.status(200).json({
      success: true,
      isAchievable: true,
      targetGpa,
      projectedGpa,
      maxAchievableGpa,
      totalCredits,
      explanation: `To achieve approximately ${targetGpa.toFixed(2)} GPA, you need an aggregate of ${(requiredGradePointsSum).toFixed(1)} credit-weighted grade points across ${totalCredits} credits.`,
      subjectTargets: solutions,
      formula: 'Semester GPA = SUM(Grade Point * Credits) / SUM(Credits)',
      note: 'This is a scenario simulation and does not modify official examination records.'
    });

  } catch (error) {
    console.error('[Simulate Target GPA Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/simulator/marks-impact
 * Evaluates the impact of custom hypothetical marks across subjects.
 */
async function simulateMarksImpact(req, res) {
  try {
    const { student_id, hypothetical_marks } = req.body;

    if (!student_id || !Array.isArray(hypothetical_marks)) {
      return res.status(400).json({ success: false, message: 'student_id and hypothetical_marks array are required.' });
    }

    // Fetch student's real enrolled marks as baseline
    const [marksRows] = await db.query(
      `SELECT m.*, s.subject_name, s.subject_code, s.credits
       FROM marks m
       JOIN subjects s ON s.id = m.subject_id
       JOIN students st ON st.id = m.student_id
       WHERE m.student_id = ? AND (m.semester_id = st.current_semester_id OR m.semester_id IS NULL)`,
      [student_id]
    );

    // Compute Baseline GPA
    const baselineSubjects = marksRows.map(m => ({
      subjectId: m.subject_id,
      subjectCode: m.subject_code,
      subjectName: m.subject_name,
      credits: Number(m.credits || 3),
      internalMarks: Number(m.internal_marks || 0),
      assignmentMarks: Number(m.assignment_marks || 0),
      examMarks: Number(m.exam_marks || 0),
      totalMarks: Number(m.total_marks || 0)
    }));
    const baselineGpa = calculateSemesterGpa(baselineSubjects);

    // Compute Simulated GPA
    const simulatedSubjects = baselineSubjects.map(base => {
      const hyp = hypothetical_marks.find(h => h.subject_id === base.subjectId || h.subject_code === base.subjectCode);
      if (!hyp) return { ...base };

      const internal = hyp.internal_marks !== undefined ? Math.min(20, Math.max(0, Number(hyp.internal_marks))) : base.internalMarks;
      const assignment = hyp.assignment_marks !== undefined ? Math.min(20, Math.max(0, Number(hyp.assignment_marks))) : base.assignmentMarks;
      const exam = hyp.exam_marks !== undefined ? Math.min(60, Math.max(0, Number(hyp.exam_marks))) : base.examMarks;
      const total = internal + assignment + exam;
      const { grade, gradePoint, status } = markToGradePoint(total);

      return {
        subjectId: base.subjectId,
        subjectCode: base.subjectCode,
        subjectName: base.subjectName,
        credits: base.credits,
        internalMarks: internal,
        assignmentMarks: assignment,
        examMarks: exam,
        totalMarks: total,
        grade,
        gradePoint,
        status,
        markDelta: total - base.totalMarks
      };
    });

    const simulatedGpa = calculateSemesterGpa(simulatedSubjects);
    const gpaDelta = Number((simulatedGpa - baselineGpa).toFixed(2));

    return res.status(200).json({
      success: true,
      baselineGpa,
      simulatedGpa,
      gpaDelta,
      interpretation: gpaDelta > 0 
        ? `Hypothetical marks increase semester GPA by +${gpaDelta.toFixed(2)} points.`
        : gpaDelta < 0 
          ? `Hypothetical marks reduce semester GPA by ${gpaDelta.toFixed(2)} points.`
          : 'Hypothetical marks yield no net change in semester GPA.',
      simulatedSubjects,
      formulaExplanation: 'Calculated using official institutional formula: SUM(Grade Point * Credits) / SUM(Credits). Range validated (Internal <= 20, Assignment <= 20, Exam <= 60).',
      notice: 'Simulation only. Official records remain unaltered.'
    });

  } catch (error) {
    console.error('[Simulate Marks Impact Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/simulator/attendance
 * Projects future attendance % under different class attendance scenarios.
 */
async function simulateAttendance(req, res) {
  try {
    const { student_id, upcoming_classes_total, upcoming_classes_attended, subject_id } = req.body;

    if (!student_id || upcoming_classes_total === undefined || upcoming_classes_attended === undefined) {
      return res.status(400).json({
        success: false,
        message: 'student_id, upcoming_classes_total, and upcoming_classes_attended are required.'
      });
    }

    const additionalTotal = Math.max(0, parseInt(upcoming_classes_total, 10));
    const additionalAttended = Math.max(0, Math.min(additionalTotal, parseInt(upcoming_classes_attended, 10)));

    let sql = 'SELECT * FROM attendance WHERE student_id = ?';
    const params = [student_id];
    if (subject_id) {
      sql += ' AND subject_id = ?';
      params.push(subject_id);
    }

    const [rows] = await db.query(sql, params);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No attendance records found for this student.' });
    }

    let currentConducted = 0;
    let currentAttended = 0;

    rows.forEach(r => {
      currentConducted += Number(r.classes_conducted ?? r.total_classes ?? 0);
      currentAttended += Number(r.classes_attended ?? r.attended_classes ?? 0);
    });

    const currentPercentage = currentConducted > 0 
      ? Number(((currentAttended / currentConducted) * 100).toFixed(2)) 
      : 0;

    const projectedConducted = currentConducted + additionalTotal;
    const projectedAttended = currentAttended + additionalAttended;
    const projectedPercentage = projectedConducted > 0 
      ? Number(((projectedAttended / projectedConducted) * 100).toFixed(2)) 
      : 0;

    // Consecutive classes needed to cross 75% or 85%
    function classesNeededForThreshold(conducted, attended, targetPct) {
      const target = targetPct / 100;
      if (conducted === 0 || attended / conducted >= target) return 0;
      // Formula: (attended + x) / (conducted + x) >= target
      // attended + x >= target * conducted + target * x
      // x * (1 - target) >= target * conducted - attended
      // x >= (target * conducted - attended) / (1 - target)
      const x = Math.ceil((target * conducted - attended) / (1 - target));
      return Math.max(0, x);
    }

    // Maximum safe bunks before dropping below 75%
    function safeBunksAllowed(conducted, attended, targetPct = 75) {
      const target = targetPct / 100;
      if (conducted === 0 || attended / conducted < target) return 0;
      // Formula: attended / (conducted + y) >= target
      // conducted + y <= attended / target
      // y <= (attended / target) - conducted
      const y = Math.floor((attended / target) - conducted);
      return Math.max(0, y);
    }

    const neededFor75 = classesNeededForThreshold(projectedConducted, projectedAttended, 75);
    const neededFor85 = classesNeededForThreshold(projectedConducted, projectedAttended, 85);
    const safeBunks = safeBunksAllowed(projectedConducted, projectedAttended, 75);

    let standing = 'GOOD';
    if (projectedPercentage < 75) standing = 'RISK';
    else if (projectedPercentage < 82) standing = 'MONITOR';

    return res.status(200).json({
      success: true,
      current: {
        conducted: currentConducted,
        attended: currentAttended,
        percentage: currentPercentage,
        status: currentPercentage >= 75 ? 'ELIGIBLE' : 'SHORTAGE'
      },
      hypotheticalScenario: {
        upcomingTotal: additionalTotal,
        upcomingAttended: additionalAttended,
        missedClasses: additionalTotal - additionalAttended
      },
      projected: {
        totalConducted: projectedConducted,
        totalAttended: projectedAttended,
        percentage: projectedPercentage,
        standing,
        isExamEligible: projectedPercentage >= 75.0,
        recoveryClassesNeededFor75: neededFor75,
        target85ClassesNeeded: neededFor85,
        safeBunksRemaining: safeBunks
      },
      formulaExplanation: 'Projected % = ((Current Attended + Upcoming Attended) / (Current Conducted + Upcoming Total)) * 100.',
      policyNotice: 'Minimum institutional attendance requirement is 75.0% for end-semester examination eligibility.'
    });

  } catch (error) {
    console.error('[Simulate Attendance Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/simulator/leverage-priorities/:studentId
 * Determines which subjects offer the highest return on investment (CGPA leverage per mark gained).
 */
async function getLeveragePriorities(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const [marksRows] = await db.query(
      `SELECT m.*, s.subject_name, s.subject_code, s.credits
       FROM marks m
       JOIN subjects s ON s.id = m.subject_id
       JOIN students st ON st.id = m.student_id
       WHERE m.student_id = ? AND (m.semester_id = st.current_semester_id OR m.semester_id IS NULL)
       ORDER BY s.credits DESC`,
      [studentId]
    );

    const totalCredits = marksRows.reduce((sum, m) => sum + Number(m.credits || 3), 0);

    const priorities = marksRows.map(m => {
      const credits = Number(m.credits || 3);
      const total = Number(m.total_marks || 0);
      const { grade, gradePoint } = markToGradePoint(total);

      // Distance to next grade point boundary
      let nextThreshold = 100;
      let marksNeeded = 0;
      if (total < 50) { nextThreshold = 50; marksNeeded = 50 - total; }
      else if (total < 60) { nextThreshold = 60; marksNeeded = 60 - total; }
      else if (total < 70) { nextThreshold = 70; marksNeeded = 70 - total; }
      else if (total < 80) { nextThreshold = 80; marksNeeded = 80 - total; }
      else if (total < 90) { nextThreshold = 90; marksNeeded = 90 - total; }

      // CGPA impact per 1 grade point jump: credits / totalCredits
      const gpaBoostPerGradeJump = totalCredits > 0 ? Number((credits / totalCredits).toFixed(3)) : 0;
      const leverageScore = marksNeeded > 0 ? Number(((gpaBoostPerGradeJump / marksNeeded) * 100).toFixed(2)) : 0;

      return {
        subjectId: m.subject_id,
        subjectCode: m.subject_code,
        subjectName: m.subject_name,
        credits,
        currentMark: total,
        currentGrade: grade,
        currentGradePoint: gradePoint,
        nextGradeThreshold: nextThreshold,
        marksNeededForNextGrade: marksNeeded,
        gpaBoostPerGradeJump,
        leverageScore,
        recommendation: marksNeeded <= 5 
          ? `High leverage! Only ${marksNeeded} mark(s) needed to jump to next grade point (adds +${gpaBoostPerGradeJump} to semester GPA).`
          : `Standard progression. Requires ${marksNeeded} marks for next tier.`
      };
    });

    // Sort by highest leverage score first
    priorities.sort((a, b) => b.leverageScore - a.leverageScore);

    return res.status(200).json({
      success: true,
      priorities,
      formulaExplanation: 'Leverage Score = (GPA Boost per Grade Jump / Marks Needed) * 100. Higher leverage means fewer marks yield greater GPA improvement.'
    });

  } catch (error) {
    console.error('[Leverage Priorities Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  simulateTargetGpa,
  simulateMarksImpact,
  simulateAttendance,
  getLeveragePriorities
};
