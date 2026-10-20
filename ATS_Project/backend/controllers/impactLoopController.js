const db = require('../config/db');
const { logAuditEvent } = require('../utils/auditLogger');

/**
 * ATS Impact Loop Controller
 * Manages student academic risk interventions, owners, follow-ups, and outcome measurements.
 */

// GET /api/impact-loop
async function getInterventions(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let whereClause = '';
    const params = [];

    if (user.role === 'student') {
      const studentId = user.studentId || (user.student && user.student.id);
      if (!studentId) {
        return res.status(400).json({ success: false, message: 'Student ID not resolved.' });
      }
      whereClause = 'WHERE ili.student_id = ?';
      params.push(studentId);
    } else if (user.role === 'faculty') {
      const isHod = Boolean(user.isHOD || user.facultyRole === 'hod');
      if (isHod && user.departmentId) {
        // HOD views all interventions in their department
        whereClause = 'WHERE st.department_id = ?';
        params.push(user.departmentId);
      } else {
        // Faculty Mentor views interventions for their assigned mentees
        const facultyId = user.facultyId || (user.faculty && user.faculty.id);
        whereClause = 'WHERE sm.faculty_id = ? AND sm.status = \'active\'';
        params.push(facultyId);
      }
    } else if (user.role === 'admin') {
      // Admin sees all institution interventions
      if (req.query.department_id) {
        whereClause = 'WHERE st.department_id = ?';
        params.push(parseInt(req.query.department_id, 10));
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Role-dependent notes masking: students NEVER see private_mentor_notes
    const isStudent = user.role === 'student';
    const notesSelect = isStudent 
      ? 'NULL AS private_mentor_notes, ili.student_guidance_notes' 
      : 'ili.private_mentor_notes, ili.student_guidance_notes';

    const [interventions] = await db.query(`
      SELECT ili.id, ili.student_id, ili.assigned_by, ili.assigned_to,
             ili.risk_alert_id, ili.recommendation_id, ili.intervention_type,
             ili.title, ili.contributing_factors, ili.action_plan, ili.status,
             ili.baseline_attendance, ili.baseline_gpa, ili.outcome_attendance, ili.outcome_gpa,
             ili.outcome_assessment, ${notesSelect},
             ili.target_date, ili.follow_up_date, ili.completed_at, ili.created_at, ili.updated_at,
             st.name AS student_name, st.register_number, st.year, st.semester, st.avatar AS student_avatar,
             d.name AS department_name, d.code AS department_code,
             f_assigner.name AS assigned_by_name,
             f_owner.name AS owner_name, f_owner.email AS owner_email
      FROM impact_loop_interventions ili
      JOIN students st ON st.id = ili.student_id
      LEFT JOIN departments d ON d.id = st.department_id
      LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
      LEFT JOIN users u_assigner ON u_assigner.id = ili.assigned_by
      LEFT JOIN faculty f_assigner ON f_assigner.user_id = u_assigner.id
      LEFT JOIN faculty f_owner ON f_owner.id = ili.assigned_to
      ${whereClause}
      ORDER BY 
        CASE ili.status 
          WHEN 'Follow-up Due' THEN 1 
          WHEN 'In Progress' THEN 2 
          WHEN 'Assigned' THEN 3 
          WHEN 'Completed' THEN 4 
          ELSE 5 
        END ASC,
        ili.created_at DESC
    `, params);

    // Summary counts
    const total = interventions.length;
    const active = interventions.filter(i => i.status === 'Assigned' || i.status === 'In Progress' || i.status === 'Follow-up Due').length;
    const completed = interventions.filter(i => i.status === 'Completed').length;
    const improved = interventions.filter(i => i.outcome_assessment === 'Significant Improvement' || i.outcome_assessment === 'Moderate Improvement').length;

    return res.status(200).json({
      success: true,
      count: total,
      summary: {
        total,
        active,
        completed,
        improved,
        successRate: completed > 0 ? Math.round((improved / completed) * 100) : 0
      },
      data: interventions
    });
  } catch (error) {
    console.error('[Get Interventions Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/impact-loop/interventions
async function createIntervention(req, res) {
  try {
    const user = req.user;
    if (user.role === 'student') {
      return res.status(403).json({ success: false, message: 'Students cannot create interventions.' });
    }

    const {
      student_id,
      intervention_type,
      title,
      contributing_factors,
      action_plan,
      target_date,
      follow_up_date,
      private_mentor_notes,
      student_guidance_notes,
      assigned_to
    } = req.body;

    if (!student_id || !intervention_type || !title || !action_plan) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, intervention type, title, and action plan are required.'
      });
    }

    // Verify student exists and fetch baseline academic standing
    const [stRows] = await db.query(`
      SELECT st.id, st.name, st.department_id, st.attendance_percentage, st.gpa, st.cgpa,
             (SELECT COALESCE(SUM(m.grade_point*su.credits)/NULLIF(SUM(su.credits),0),0) 
              FROM marks m JOIN subjects su ON su.id=m.subject_id 
              WHERE m.student_id=st.id AND m.semester_id=st.current_semester_id) AS computed_gpa,
             (SELECT COALESCE(100*SUM(a.classes_attended)/NULLIF(SUM(a.classes_conducted),0),0) 
              FROM attendance a 
              WHERE a.student_id=st.id AND a.semester_id=st.current_semester_id) AS computed_attendance
      FROM students st WHERE st.id = ?
    `, [student_id]);

    if (stRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const student = stRows[0];

    // Enforce role-based department and mentee boundary
    if (user.role === 'faculty') {
      const isHod = Boolean(user.isHOD || user.facultyRole === 'hod');
      if (isHod) {
        if (user.departmentId && student.department_id !== user.departmentId) {
          return res.status(403).json({ success: false, message: 'HOD can only assign interventions to department students.' });
        }
      } else {
        // Faculty mentor check
        const [mentorCheck] = await db.query(
          'SELECT id FROM student_mentors WHERE student_id = ? AND faculty_id = ? AND status = \'active\'',
          [student_id, user.facultyId]
        );
        if (mentorCheck.length === 0) {
          return res.status(403).json({ success: false, message: 'Mentors can only assign interventions to their active mentees.' });
        }
      }
    }

    const baselineAttendance = Number(student.computed_attendance || student.attendance_percentage || 0);
    const baselineGpa = Number(student.computed_gpa || student.gpa || 0);
    const ownerFacultyId = assigned_to || (user.role === 'faculty' ? user.facultyId : null);

    const factorsJson = contributing_factors 
      ? (typeof contributing_factors === 'string' ? contributing_factors : JSON.stringify(contributing_factors))
      : JSON.stringify({ baselineAttendance, baselineGpa, timestamp: new Date().toISOString() });

    const [result] = await db.query(`
      INSERT INTO impact_loop_interventions (
        student_id, assigned_by, assigned_to, intervention_type, title,
        contributing_factors, action_plan, status,
        baseline_attendance, baseline_gpa,
        private_mentor_notes, student_guidance_notes,
        target_date, follow_up_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?, ?, ?, ?, ?)
    `, [
      student_id,
      user.id,
      ownerFacultyId,
      intervention_type,
      title,
      factorsJson,
      action_plan,
      baselineAttendance,
      baselineGpa,
      private_mentor_notes || null,
      student_guidance_notes || null,
      target_date || null,
      follow_up_date || null
    ]);

    // Create decision trace record linked to this intervention
    await db.query(`
      INSERT INTO academic_decision_traces (
        student_id, intervention_id, indicator_type, trigger_condition,
        observed_value, threshold_applied, rule_engine_type, model_version,
        evidence_summary, explanation, recommended_action, decision_status,
        reviewed_by, action_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, 'Rule-Based Deterministic Engine v2.1', 'RuleSet-Academic-2026.1', ?, ?, ?, 'Action Taken', ?, NOW())
    `, [
      student_id,
      result.insertId,
      intervention_type.includes('Attendance') ? 'Attendance Compliance' : 'Continuous Assessment & Revision',
      `Intervention created: ${intervention_type}`,
      `Baseline Att: ${baselineAttendance.toFixed(1)}%, Baseline GPA: ${baselineGpa.toFixed(2)}`,
      'Institutional Academic Intervention Policy §4.3',
      `Academic signals triggered intervention "${title}". Action plan: ${action_plan}`,
      `Generated by mentor review for student ${student.name}.`,
      action_plan,
      user.id
    ]);

    // Send student a notification
    await db.query(`
      INSERT INTO notifications (student_id, type, title, message)
      VALUES (?, 'recommendation', ?, ?)
    `, [
      student_id,
      `New Academic Support Plan: ${title}`,
      student_guidance_notes || `Your mentor has assigned an academic support plan: "${action_plan}". Check your ATS Impact Loop dashboard for details.`
    ]);

    // Audit log
    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE_INTERVENTION',
      entityType: 'impact_loop_interventions',
      entityId: result.insertId,
      newValue: { student_id, intervention_type, title, action_plan },
      reason: 'Academic support intervention initiated',
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: `Intervention plan "${title}" created successfully for ${student.name}.`,
      interventionId: result.insertId,
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('[Create Intervention Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/impact-loop/interventions/:id
async function updateIntervention(req, res) {
  try {
    const user = req.user;
    if (user.role === 'student') {
      return res.status(403).json({ success: false, message: 'Students cannot update intervention status.' });
    }

    const id = parseInt(req.params.id, 10);
    const {
      status,
      action_plan,
      private_mentor_notes,
      student_guidance_notes,
      follow_up_date,
      outcome_assessment,
      outcome_notes
    } = req.body;

    const [existing] = await db.query(`
      SELECT ili.*, st.department_id, st.name AS student_name, st.current_semester_id
      FROM impact_loop_interventions ili
      JOIN students st ON st.id = ili.student_id
      WHERE ili.id = ?
    `, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Intervention not found.' });
    }
    const item = existing[0];

    // Check permissions
    if (user.role === 'faculty') {
      const isHod = Boolean(user.isHOD || user.facultyRole === 'hod');
      if (isHod) {
        if (user.departmentId && item.department_id !== user.departmentId) {
          return res.status(403).json({ success: false, message: 'Access denied: Department mismatch.' });
        }
      } else {
        const [mentorCheck] = await db.query(
          'SELECT id FROM student_mentors WHERE student_id = ? AND faculty_id = ? AND status = \'active\'',
          [item.student_id, user.facultyId]
        );
        if (mentorCheck.length === 0 && item.assigned_to !== user.facultyId) {
          return res.status(403).json({ success: false, message: 'Access denied: Not your assigned mentee.' });
        }
      }
    }

    // If completing or closing, measure live outcome from current student database marks & attendance
    let outcomeAttendance = item.outcome_attendance;
    let outcomeGpa = item.outcome_gpa;
    let calculatedOutcomeAssessment = outcome_assessment || item.outcome_assessment;
    let completedAt = item.completed_at;

    if (status === 'Completed' || status === 'Closed') {
      if (!completedAt) completedAt = new Date();

      const [metricsRows] = await db.query(`
        SELECT 
          (SELECT COALESCE(100*SUM(a.classes_attended)/NULLIF(SUM(a.classes_conducted),0),0) 
           FROM attendance a 
           WHERE a.student_id = ? AND (a.semester_id = ? OR ? IS NULL)) AS current_attendance,
          (SELECT COALESCE(SUM(m.grade_point*su.credits)/NULLIF(SUM(su.credits),0),0) 
           FROM marks m JOIN subjects su ON su.id=m.subject_id 
           WHERE m.student_id = ? AND (m.semester_id = ? OR ? IS NULL)) AS current_gpa
      `, [item.student_id, item.current_semester_id, item.current_semester_id, item.student_id, item.current_semester_id, item.current_semester_id]);

      const currentMetrics = (metricsRows && metricsRows.length > 0) ? metricsRows[0] : {};
      outcomeAttendance = Number(currentMetrics.current_attendance || 0);
      outcomeGpa = Number(currentMetrics.current_gpa || 0);

      // Evaluate change vs baseline
      const attDiff = outcomeAttendance - Number(item.baseline_attendance || 0);
      const gpaDiff = outcomeGpa - Number(item.baseline_gpa || 0);

      if (!outcome_assessment || outcome_assessment === 'Pending Evaluation') {
        if (attDiff >= 5 || gpaDiff >= 0.5) {
          calculatedOutcomeAssessment = 'Significant Improvement';
        } else if (attDiff > 0 || gpaDiff > 0) {
          calculatedOutcomeAssessment = 'Moderate Improvement';
        } else if (attDiff === 0 && gpaDiff === 0) {
          calculatedOutcomeAssessment = 'Neutral / No Change';
        } else {
          calculatedOutcomeAssessment = 'Limited Improvement / Needs Revision';
        }
      }
    }

    const VALID_OUTCOMES = [
      'Significant Improvement',
      'Moderate Improvement',
      'Neutral / No Change',
      'Limited Improvement / Needs Revision',
      'Pending Evaluation'
    ];
    if (calculatedOutcomeAssessment && !VALID_OUTCOMES.includes(calculatedOutcomeAssessment)) {
      const lower = calculatedOutcomeAssessment.toLowerCase();
      if (lower.includes('signif')) {
        calculatedOutcomeAssessment = 'Significant Improvement';
      } else if (lower.includes('improv')) {
        calculatedOutcomeAssessment = 'Moderate Improvement';
      } else if (lower.includes('limit') || lower.includes('revis') || lower.includes('declin')) {
        calculatedOutcomeAssessment = 'Limited Improvement / Needs Revision';
      } else if (lower.includes('neutr') || lower.includes('no change')) {
        calculatedOutcomeAssessment = 'Neutral / No Change';
      } else {
        calculatedOutcomeAssessment = 'Moderate Improvement';
      }
    }

    await db.query(`
      UPDATE impact_loop_interventions
      SET status = COALESCE(?, status),
          action_plan = COALESCE(?, action_plan),
          private_mentor_notes = COALESCE(?, private_mentor_notes),
          student_guidance_notes = COALESCE(?, student_guidance_notes),
          follow_up_date = COALESCE(?, follow_up_date),
          outcome_attendance = ?,
          outcome_gpa = ?,
          outcome_assessment = ?,
          completed_at = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [
      status || null,
      action_plan || null,
      private_mentor_notes || null,
      student_guidance_notes || null,
      follow_up_date || null,
      outcomeAttendance,
      outcomeGpa,
      calculatedOutcomeAssessment,
      completedAt,
      id
    ]);

    // Update corresponding decision trace follow_up_result
    await db.query(`
      UPDATE academic_decision_traces
      SET follow_up_result = ?,
          decision_status = ?,
          updated_at = NOW()
      WHERE intervention_id = ?
    `, [
      `Status: ${status || item.status}. Outcome: ${calculatedOutcomeAssessment}. Baseline Att: ${item.baseline_attendance}%, Final Att: ${outcomeAttendance}%. Baseline GPA: ${item.baseline_gpa}, Final GPA: ${outcomeGpa}. ${outcome_notes || ''}`,
      (status === 'Completed' || status === 'Closed') ? 'Action Taken' : (status === 'Dismissed' ? 'Dismissed' : 'Accepted'),
      id
    ]);

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE_INTERVENTION',
      entityType: 'impact_loop_interventions',
      entityId: id,
      previousValue: { status: item.status, outcome_assessment: item.outcome_assessment },
      newValue: { status, outcome_assessment: calculatedOutcomeAssessment },
      reason: 'Intervention progress or outcome updated',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Intervention updated successfully.',
      data: {
        id,
        status: status || item.status,
        outcome_assessment: calculatedOutcomeAssessment,
        outcome_attendance: outcomeAttendance,
        outcome_gpa: outcomeGpa
      }
    });

  } catch (error) {
    console.error('[Update Intervention Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/impact-loop/analytics
async function getImpactLoopAnalytics(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let deptFilter = '';
    const params = [];
    if (user.role === 'faculty') {
      const isHod = Boolean(user.isHOD || user.facultyRole === 'hod');
      if (isHod && user.departmentId) {
        deptFilter = 'WHERE st.department_id = ?';
        params.push(user.departmentId);
      } else {
        deptFilter = 'WHERE sm.faculty_id = ? AND sm.status = \'active\'';
        params.push(user.facultyId);
      }
    } else if (user.role === 'admin' && req.query.department_id) {
      deptFilter = 'WHERE st.department_id = ?';
      params.push(parseInt(req.query.department_id, 10));
    }

    // 1. By Intervention Type
    const [byType] = await db.query(`
      SELECT ili.intervention_type,
             COUNT(*) AS total_count,
             SUM(CASE WHEN ili.status = 'Completed' THEN 1 ELSE 0 END) AS completed_count,
             SUM(CASE WHEN ili.outcome_assessment IN ('Significant Improvement', 'Moderate Improvement') THEN 1 ELSE 0 END) AS improved_count,
             AVG(CASE WHEN ili.outcome_attendance IS NOT NULL THEN (ili.outcome_attendance - ili.baseline_attendance) ELSE NULL END) AS avg_attendance_delta,
             AVG(CASE WHEN ili.outcome_gpa IS NOT NULL THEN (ili.outcome_gpa - ili.baseline_gpa) ELSE NULL END) AS avg_gpa_delta
      FROM impact_loop_interventions ili
      JOIN students st ON st.id = ili.student_id
      LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
      ${deptFilter}
      GROUP BY ili.intervention_type
      ORDER BY total_count DESC
    `, params);

    // 2. Outcome Assessment Distribution
    const [byOutcome] = await db.query(`
      SELECT ili.outcome_assessment, COUNT(*) AS count
      FROM impact_loop_interventions ili
      JOIN students st ON st.id = ili.student_id
      LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
      ${deptFilter}
      GROUP BY ili.outcome_assessment
    `, params);

    // 3. High Risk Signals Needing Intervention (Students with low attendance or low GPA without active intervention)
    const [studentsAtRiskWithoutIntervention] = await db.query(`
      SELECT st.id, st.name, st.register_number, st.year, st.semester, st.attendance_percentage, st.gpa,
             d.name AS department_name, f.name AS mentor_name
      FROM students st
      LEFT JOIN departments d ON d.id = st.department_id
      LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
      LEFT JOIN faculty f ON f.id = sm.faculty_id
      WHERE (st.attendance_percentage < 75 OR st.gpa < 6.5)
        AND st.id NOT IN (
          SELECT student_id FROM impact_loop_interventions 
          WHERE status IN ('Assigned', 'In Progress', 'Follow-up Due')
        )
      ${user.role === 'faculty' && user.departmentId ? 'AND st.department_id = ?' : ''}
      ORDER BY st.attendance_percentage ASC, st.gpa ASC
      LIMIT 10
    `, user.role === 'faculty' && user.departmentId ? [user.departmentId] : []);

    return res.status(200).json({
      success: true,
      data: {
        byType,
        byOutcome,
        studentsNeedingIntervention: studentsAtRiskWithoutIntervention
      }
    });

  } catch (error) {
    console.error('[Impact Loop Analytics Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getInterventions,
  createIntervention,
  updateIntervention,
  getImpactLoopAnalytics
};
