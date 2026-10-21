const db = require('../../database/db');

/**
 * GET /api/skill-evidence/:studentId
 * Returns the Skill Evidence Graph linking coursework, activities, and certifications to skills and career roles.
 */
async function getSkillEvidenceGraph(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required.' });
    }

    // 1. Fetch student info and target career role
    const [students] = await db.query(
      `SELECT st.*, d.name AS department_name, sct.role_id AS target_role_id, cr.title AS target_role_title, cr.category AS target_role_category
       FROM students st
       LEFT JOIN departments d ON d.id = st.department_id
       LEFT JOIN student_career_targets sct ON sct.student_id = st.id AND sct.status = 'In Progress'
       LEFT JOIN career_roles cr ON cr.id = sct.role_id
       WHERE st.id = ?`,
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const student = students[0];

    // 2. Fetch all recorded student skills
    const [skills] = await db.query(
      'SELECT * FROM student_skills WHERE student_id = ? ORDER BY is_verified DESC, skill_name ASC',
      [studentId]
    );

    // 3. Fetch verified co-curricular activities
    const [activities] = await db.query(
      'SELECT * FROM student_activities WHERE student_id = ? ORDER BY event_date DESC, id DESC',
      [studentId]
    );

    // 4. Fetch certifications (NPTEL, industry credentials)
    const [certifications] = await db.query(
      'SELECT * FROM certifications WHERE student_id = ? ORDER BY issue_date DESC, id DESC',
      [studentId]
    );

    // 5. Fetch strong academic coursework (grade A, A+, B+ or total_marks >= 70)
    const [coursework] = await db.query(`
      SELECT m.*, s.subject_name, s.subject_code, s.credits
      FROM marks m
      JOIN subjects s ON s.id = m.subject_id
      WHERE m.student_id = ? AND (m.total_marks >= 70 OR m.grade IN ('A+', 'A', 'B+'))
      ORDER BY m.total_marks DESC
      LIMIT 10
    `, [studentId]);

    // 6. Fetch target career role details and competencies
    const targetRoleId = student.target_role_id || 1;
    const [roles] = await db.query('SELECT * FROM career_roles WHERE id = ? OR is_active = 1 LIMIT 3', [targetRoleId]);
    const targetRole = roles.find(r => r.id === targetRoleId) || roles[0];
    
    let requiredCompetencies = [];
    if (targetRole && targetRole.required_competencies) {
      requiredCompetencies = typeof targetRole.required_competencies === 'string'
        ? JSON.parse(targetRole.required_competencies)
        : targetRole.required_competencies;
    }

    // Build Graph Nodes & Edges
    const nodes = [];
    const edges = [];
    let nodeIdCounter = 1;

    // Career Role Node
    const roleNodeId = `role_${targetRole ? targetRole.id : 1}`;
    nodes.push({
      id: roleNodeId,
      label: targetRole ? targetRole.title : 'Software Engineer',
      type: 'Career Role',
      category: targetRole ? targetRole.category : 'Technology',
      status: 'Target Goal',
      description: targetRole ? targetRole.description : 'Primary career aspiration'
    });

    // Skill Nodes and Evidence Nodes
    const skillMap = new Map();
    const evidenceList = [];

    // Add declared skills
    skills.forEach(s => {
      const sId = `skill_${s.id}`;
      skillMap.set(s.skill_name.toLowerCase(), sId);
      const isReq = requiredCompetencies.some(rc => 
        rc.toLowerCase().includes(s.skill_name.toLowerCase()) || 
        s.skill_name.toLowerCase().includes(rc.toLowerCase())
      );

      nodes.push({
        id: sId,
        label: s.skill_name,
        type: 'Skill',
        proficiency: s.proficiency_level,
        status: s.is_verified ? 'Verified' : 'Self-Reported',
        evidence_type: s.evidence_type,
        isRequired: isReq
      });

      if (isReq) {
        edges.push({
          source: sId,
          target: roleNodeId,
          relationship: 'fulfills_requirement',
          label: 'Required Competency'
        });
      }
    });

    // Add Certifications as Evidence
    certifications.forEach(c => {
      const eId = `cert_${c.id}`;
      const status = c.verification_status === 'Verified' ? 'Verified' : 'Pending Verification';
      nodes.push({
        id: eId,
        label: c.title || c.certificate_name,
        type: 'Evidence',
        evidence_kind: 'Certification',
        issuer: c.issuing_organization || 'NPTEL / MOOC',
        status,
        score: c.score_or_grade || 'Completed'
      });

      evidenceList.push({
        id: c.id,
        title: c.title || c.certificate_name,
        type: 'Certification',
        source: c.issuing_organization || 'External Issuer',
        status,
        date: c.issue_date,
        credential_id: c.credential_id || 'CERT-' + c.id
      });

      // Link to skill if matching
      skills.forEach(s => {
        if ((c.title && c.title.toLowerCase().includes(s.skill_name.toLowerCase())) ||
            (s.evidence_ref && s.evidence_ref.includes(String(c.id)))) {
          edges.push({
            source: eId,
            target: `skill_${s.id}`,
            relationship: 'validates',
            label: 'Certified Evidence'
          });
        }
      });
    });

    // Add Activities as Evidence
    activities.forEach(a => {
      const aId = `act_${a.id}`;
      const status = a.verified ? 'Verified' : 'Pending Verification';
      nodes.push({
        id: aId,
        label: a.title,
        type: 'Evidence',
        evidence_kind: 'Activity / Competition',
        issuer: a.organizing_institution || a.organization_or_issuer || 'Institution',
        status,
        points: a.portfolio_points || 10
      });

      evidenceList.push({
        id: a.id,
        title: a.title,
        type: a.activity_type || 'Co-Curricular',
        source: a.organizing_institution || a.organization_or_issuer || 'Institution',
        status,
        date: a.start_date,
        points: a.portfolio_points || 0
      });

      // Edge from activity to career role or skills
      edges.push({
        source: aId,
        target: roleNodeId,
        relationship: 'portfolio_evidence',
        label: `${a.activity_type || 'Activity'} Portfolio`
      });
    });

    // Add Coursework Evidence
    coursework.forEach(cw => {
      const cwId = `course_${cw.id}`;
      nodes.push({
        id: cwId,
        label: `${cw.subject_name} (${cw.grade})`,
        type: 'Evidence',
        evidence_kind: 'Coursework Mastery',
        issuer: 'Academic Examination Board',
        status: 'Verified',
        score: `${cw.total_marks}/100`
      });

      evidenceList.push({
        id: cw.id,
        title: cw.subject_name,
        type: 'Academic Coursework',
        source: 'University Assessment',
        status: 'Verified',
        grade: cw.grade,
        marks: Number(cw.total_marks)
      });
    });

    // Skill Gap Analysis
    const verifiedSkillNames = skills.filter(s => s.is_verified).map(s => s.skill_name.toLowerCase());
    const pendingSkillNames = skills.filter(s => !s.is_verified).map(s => s.skill_name.toLowerCase());

    const matchedCompetencies = [];
    const missingCompetencies = [];

    requiredCompetencies.forEach(comp => {
      const isVerified = verifiedSkillNames.some(v => v.includes(comp.toLowerCase()) || comp.toLowerCase().includes(v));
      const isPending = pendingSkillNames.some(p => p.includes(comp.toLowerCase()) || comp.toLowerCase().includes(p));

      if (isVerified) {
        matchedCompetencies.push({ competency: comp, status: 'Verified' });
      } else if (isPending) {
        matchedCompetencies.push({ competency: comp, status: 'Pending Verification' });
      } else {
        missingCompetencies.push({
          competency: comp,
          status: 'Gap',
          recommendation: `Add study tasks or project portfolio in ${comp} to meet ${targetRole ? targetRole.title : 'Target Role'} requirements.`
        });
      }
    });

    const totalReq = requiredCompetencies.length || 1;
    const verifiedCount = matchedCompetencies.filter(m => m.status === 'Verified').length;
    const coveragePercentage = Math.round((verifiedCount / totalReq) * 100);

    return res.status(200).json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          register_number: student.register_number,
          department: student.department_name,
          target_role: targetRole ? targetRole.title : 'Software Engineer'
        },
        graph: {
          nodes,
          edges
        },
        evidence: evidenceList,
        evidenceList,
        skills,
        competencies: {
          required: requiredCompetencies,
          matched: matchedCompetencies,
          gaps: missingCompetencies,
          coveragePercentage
        },
        careerGapAnalysis: {
          targetRole: targetRole ? targetRole.title : 'Software Engineer',
          requiredSkills: requiredCompetencies,
          matchedSkills: matchedCompetencies,
          missingSkills: missingCompetencies,
          coveragePercentage
        }
      }
    });

  } catch (err) {
    console.error('[getSkillEvidenceGraph Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/skill-evidence/verify
 * Allows authorized staff/mentor to verify a student skill
 */
async function verifyStudentSkill(req, res) {
  try {
    const { skill_id, is_verified, evidence_ref } = req.body;
    const skillId = parseInt(skill_id, 10);

    if (!skillId) {
      return res.status(400).json({ success: false, message: 'Valid skill_id is required.' });
    }

    const verifiedBy = req.user.facultyId || req.user.id;
    const verifiedVal = is_verified ? 1 : 0;

    await db.query(`
      UPDATE student_skills 
      SET is_verified = ?, verified_by = ?, evidence_ref = COALESCE(?, evidence_ref), updated_at = NOW()
      WHERE id = ?
    `, [verifiedVal, verifiedBy, evidence_ref || null, skillId]);

    return res.status(200).json({
      success: true,
      message: `Skill ${verifiedVal ? 'verified' : 'unverified'} successfully.`
    });

  } catch (err) {
    console.error('[verifyStudentSkill Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getSkillEvidenceGraph,
  verifyStudentSkill
};
