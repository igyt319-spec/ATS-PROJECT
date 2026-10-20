const db = require('../config/db');
const { logAuditEvent } = require('../utils/auditLogger');

/**
 * Academic Decision Trace Controller
 * Explainable recommendations, rule evidence, and decision tracking.
 */

// GET /api/decision-trace
async function getDecisionTraces(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let whereClause = '';
    const params = [];

    if (user.role === 'student') {
      const studentId = user.studentId || (user.student && user.student.id);
      if (!studentId) return res.status(400).json({ success: false, message: 'Student ID not resolved.' });
      whereClause = 'WHERE adt.student_id = ?';
      params.push(studentId);
    } else if (user.role === 'faculty') {
      const isHod = Boolean(user.isHOD || user.facultyRole === 'hod');
      if (isHod && user.departmentId) {
        whereClause = 'WHERE st.department_id = ?';
        params.push(user.departmentId);
      } else {
        const facultyId = user.facultyId || (user.faculty && user.faculty.id);
        whereClause = 'WHERE sm.faculty_id = ? AND sm.status = \'active\'';
        params.push(facultyId);
      }
    } else if (user.role === 'admin') {
      if (req.query.department_id) {
        whereClause = 'WHERE st.department_id = ?';
        params.push(parseInt(req.query.department_id, 10));
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [traces] = await db.query(`
      SELECT adt.id, adt.student_id, adt.alert_id, adt.intervention_id,
             adt.indicator_type, adt.trigger_condition, adt.observed_value,
             adt.threshold_applied, adt.rule_engine_type, adt.model_version,
             adt.evidence_summary, adt.explanation, adt.recommended_action,
             adt.decision_status, adt.reviewed_by, adt.reviewer_action,
             adt.action_timestamp, adt.follow_up_result, adt.created_at, adt.updated_at,
             st.name AS student_name, st.register_number, st.year, st.semester,
             d.name AS department_name, d.code AS department_code,
             u_rev.name AS reviewer_name, u_rev.email AS reviewer_email
      FROM academic_decision_traces adt
      JOIN students st ON st.id = adt.student_id
      LEFT JOIN departments d ON d.id = st.department_id
      LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
      LEFT JOIN users u_rev ON u_rev.id = adt.reviewed_by
      ${whereClause}
      ORDER BY 
        CASE adt.decision_status 
          WHEN 'Pending Review' THEN 1 
          WHEN 'Modified' THEN 2 
          WHEN 'Accepted' THEN 3 
          WHEN 'Action Taken' THEN 4 
          ELSE 5 
        END ASC,
        adt.created_at DESC
    `, params);

    // If traces are empty, generate initial baseline rule traces for students with risk flags
    if (traces.length === 0 && (user.role === 'faculty' || user.role === 'admin')) {
      await generateInitialDecisionTraces();
      // re-query once
      const [seededTraces] = await db.query(`
        SELECT adt.id, adt.student_id, adt.alert_id, adt.intervention_id,
               adt.indicator_type, adt.trigger_condition, adt.observed_value,
               adt.threshold_applied, adt.rule_engine_type, adt.model_version,
               adt.evidence_summary, adt.explanation, adt.recommended_action,
               adt.decision_status, adt.reviewed_by, adt.reviewer_action,
               adt.action_timestamp, adt.follow_up_result, adt.created_at, adt.updated_at,
               st.name AS student_name, st.register_number, st.year, st.semester,
               d.name AS department_name, d.code AS department_code,
               u_rev.name AS reviewer_name, u_rev.email AS reviewer_email
        FROM academic_decision_traces adt
        JOIN students st ON st.id = adt.student_id
        LEFT JOIN departments d ON d.id = st.department_id
        LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
        LEFT JOIN users u_rev ON u_rev.id = adt.reviewed_by
        ${whereClause}
        ORDER BY adt.created_at DESC
      `, params);
      return res.status(200).json({
        success: true,
        count: seededTraces.length,
        data: seededTraces
      });
    }

    return res.status(200).json({
      success: true,
      count: traces.length,
      data: traces
    });

  } catch (error) {
    console.error('[Get Decision Traces Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Helper to seed initial rule-based decision traces from actual marks/attendance in DB
async function generateInitialDecisionTraces() {
  try {
    const [students] = await db.query(`
      SELECT st.id, st.name, st.attendance_percentage, st.gpa, st.current_semester_id
      FROM students st
      WHERE st.attendance_percentage < 75 OR st.gpa < 6.5
      LIMIT 10
    `);

    for (const s of students) {
      if (Number(s.attendance_percentage) < 75) {
        await db.query(`
          INSERT INTO academic_decision_traces (
            student_id, indicator_type, trigger_condition, observed_value,
            threshold_applied, rule_engine_type, model_version,
            evidence_summary, explanation, recommended_action, decision_status
          ) VALUES (?, 'Attendance Compliance', 'Attendance has fallen below the 75% examination threshold',
                    ?, 'Minimum Examination Eligibility Policy §4.1 (Threshold: 75.0%)',
                    'Rule-Based Deterministic Engine v2.1', 'RuleSet-Academic-2026.1',
                    ?, ?, 'Mentor follow-up meeting and attendance recovery plan.', 'Pending Review')
        `, [
          s.id,
          `${Number(s.attendance_percentage).toFixed(1)}%`,
          `Recorded student attendance is ${Number(s.attendance_percentage).toFixed(1)}%, triggering the mandatory 75% attendance compliance rule.`,
          `The attendance monitoring rule was evaluated against current lecture records. The student is at risk of exam debarment without remedial sessions.`
        ]);
      }
      if (Number(s.gpa) < 6.5) {
        await db.query(`
          INSERT INTO academic_decision_traces (
            student_id, indicator_type, trigger_condition, observed_value,
            threshold_applied, rule_engine_type, model_version,
            evidence_summary, explanation, recommended_action, decision_status
          ) VALUES (?, 'Continuous Assessment & GPA', 'GPA has fallen below the 6.5 good standing benchmark',
                    ?, 'Academic Standing Regulation §5.2 (Threshold: 6.50)',
                    'Rule-Based Deterministic Engine v2.1', 'RuleSet-Academic-2026.1',
                    ?, ?, 'Subject revision schedule and faculty tutorial clinic enrollment.', 'Pending Review')
        `, [
          s.id,
          `${Number(s.gpa).toFixed(2)} SGPA`,
          `Current computed GPA is ${Number(s.gpa).toFixed(2)}, breaching the 6.5 academic standing benchmark.`,
          `Continuous assessment marks indicate struggling subject areas requiring personalized academic intervention.`
        ]);
      }
    }
  } catch (err) {
    console.warn('[Initial Decision Traces Notice]', err.message);
  }
}

// POST /api/decision-trace
async function createDecisionTrace(req, res) {
  try {
    const user = req.user;
    if (user.role === 'student') {
      return res.status(403).json({ success: false, message: 'Students cannot log decision traces directly.' });
    }

    const {
      student_id,
      alert_id,
      intervention_id,
      indicator_type,
      trigger_condition,
      observed_value,
      threshold_applied,
      evidence_summary,
      explanation,
      recommended_action
    } = req.body;

    if (!student_id || !indicator_type || !observed_value || !recommended_action) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: student_id, indicator_type, observed_value, recommended_action.'
      });
    }

    const effectiveTrigger = trigger_condition || `Rule triggered for ${indicator_type}: observed ${observed_value}`;

    const [result] = await db.query(`
      INSERT INTO academic_decision_traces (
        student_id, alert_id, intervention_id, indicator_type,
        trigger_condition, observed_value, threshold_applied,
        rule_engine_type, model_version, evidence_summary, explanation,
        recommended_action, decision_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Rule-Based Deterministic Engine v2.1', 'RuleSet-Academic-2026.1', ?, ?, ?, 'Pending Review')
    `, [
      student_id,
      alert_id || null,
      intervention_id || null,
      indicator_type,
      effectiveTrigger,
      observed_value,
      threshold_applied || 'Standard Academic Policy Threshold',
      evidence_summary || `Triggered by ${indicator_type}: ${observed_value}`,
      explanation || `Observed ${observed_value} against threshold ${threshold_applied}`,
      recommended_action
    ]);

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE_DECISION_TRACE',
      entityType: 'academic_decision_traces',
      entityId: result.insertId,
      newValue: { student_id, indicator_type, trigger_condition, observed_value },
      reason: 'Academic decision trace logged',
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Decision trace created successfully.',
      traceId: result.insertId,
      data: { id: result.insertId }
    });

  } catch (error) {
    console.error('[Create Decision Trace Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/decision-trace/:id/decision
async function reviewDecisionTrace(req, res) {
  try {
    const user = req.user;
    if (user.role === 'student') {
      return res.status(403).json({ success: false, message: 'Students cannot review decision traces.' });
    }

    const id = parseInt(req.params.id, 10);
    const { decision_status, reviewer_action, follow_up_result } = req.body;

    const validStatuses = ['Accepted', 'Modified', 'Dismissed', 'Action Taken'];
    if (!validStatuses.includes(decision_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid decision status. Allowed: ${validStatuses.join(', ')}`
      });
    }

    const [existing] = await db.query('SELECT * FROM academic_decision_traces WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Decision trace not found.' });
    }
    const current = existing[0];

    await db.query(`
      UPDATE academic_decision_traces
      SET decision_status = ?,
          reviewer_action = COALESCE(?, reviewer_action),
          follow_up_result = COALESCE(?, follow_up_result),
          reviewed_by = ?,
          action_timestamp = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [
      decision_status,
      reviewer_action || null,
      follow_up_result || null,
      user.id,
      id
    ]);

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'REVIEW_DECISION_TRACE',
      entityType: 'academic_decision_traces',
      entityId: id,
      previousValue: { decision_status: current.decision_status },
      newValue: { decision_status, reviewer_action },
      reason: `Decision trace marked as ${decision_status}`,
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: `Decision trace updated to '${decision_status}'.`,
      data: {
        id,
        decision_status,
        reviewer_action,
        reviewed_by: user.name,
        action_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Review Decision Trace Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/decision-trace/rules
async function getDecisionRulesCatalog(req, res) {
  try {
    const rules = [
      {
        ruleId: 'RULE-ATT-75',
        title: 'Attendance Debarment Risk Threshold',
        indicator: 'Attendance Compliance',
        thresholdValue: '< 75.0%',
        policyReference: 'Institutional Examination Ordinance §4.1',
        engineType: 'Rule-Based Deterministic Engine v2.1',
        severity: 'HIGH',
        suggestedAction: 'Mentor interview, attendance recovery contract, compensatory tutorial lectures.'
      },
      {
        ruleId: 'RULE-ATT-85',
        title: 'Attendance Advisory Monitor',
        indicator: 'Attendance Compliance',
        thresholdValue: '75.0% - 84.9%',
        policyReference: 'Academic Standing Regulation §4.2',
        engineType: 'Rule-Based Deterministic Engine v2.1',
        severity: 'MEDIUM',
        suggestedAction: 'Weekly attendance review with mentor to prevent exam debarment.'
      },
      {
        ruleId: 'RULE-CIA-60',
        title: 'Continuous Internal Assessment (CIA) Deficit',
        indicator: 'Continuous Assessment',
        thresholdValue: '< 60% in any subject',
        policyReference: 'Continuous Assessment Benchmark §3.4',
        engineType: 'Rule-Based Deterministic Engine v2.1',
        severity: 'MEDIUM',
        suggestedAction: 'Subject remedial assignments, revision sessions, peer study group.'
      },
      {
        ruleId: 'RULE-GPA-6.0',
        title: 'Cumulative Academic Standing Risk',
        indicator: 'GPA Trajectory',
        thresholdValue: '< 6.00 SGPA',
        policyReference: 'Degree Progression Policy §5.1',
        engineType: 'Rule-Based Deterministic Engine v2.1',
        severity: 'HIGH',
        suggestedAction: 'Comprehensive study schedule overhaul, parent-mentor consultation, course load pacing.'
      },
      {
        ruleId: 'RULE-MCDA-SCORE',
        title: 'Multi-Criteria Decision Analysis (MCDA) Holistic Composite',
        indicator: 'Composite Score (70% Marks + 20% Attendance + 10% Achievements)',
        thresholdValue: '< 65 Composite Points',
        policyReference: 'ATS Explainable Academic Heuristics Framework',
        engineType: 'Rule-Based Deterministic Engine v2.1',
        severity: 'MEDIUM',
        suggestedAction: 'Targeted support across highest-leverage components (Marks and Attendance recovery).'
      }
    ];

    return res.status(200).json({
      success: true,
      rulesCatalog: rules
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getDecisionTraces,
  createDecisionTrace,
  reviewDecisionTrace,
  getDecisionRulesCatalog
};
