/**
 * ATS AI Career Readiness Engine Controller
 * =========================================
 * Feature 2: AI Career Readiness Engine
 * 
 * Provides:
 * - Technical career path tracks: VLSI, Embedded Systems, ECE, Software Engineering, AI/ML.
 * - Dynamic student target career role selection & status tracking.
 * - Competency mapping comparing student verified achievements, course grades,
 *   certifications, and declared skills against required competencies.
 * - Clear distinction between verified evidence (NPTEL, IEEE, courses, hackathons)
 *   and self-declared skills.
 * - Skills-gap diagnostic and automated generation of prioritized learning roadmaps.
 * - Admin/Faculty management of career track competencies.
 */

const db = require('../config/db');

/**
 * GET /api/career/roles
 * List all available active career tracks with competencies.
 */
async function getCareerRoles(req, res) {
  try {
    const [roles] = await db.query(
      'SELECT * FROM career_roles WHERE is_active = 1 ORDER BY category ASC, title ASC'
    );

    const parsedRoles = roles.map(r => ({
      ...r,
      required_competencies: typeof r.required_competencies === 'string' 
        ? JSON.parse(r.required_competencies) 
        : r.required_competencies
    }));

    return res.status(200).json({
      success: true,
      count: parsedRoles.length,
      data: parsedRoles
    });
  } catch (error) {
    console.error('[Get Career Roles Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/career/roles/:id
 * Retrieve a specific career role with detailed requirements.
 */
async function getCareerRoleById(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const [roles] = await db.query('SELECT * FROM career_roles WHERE id = ?', [id]);
    if (roles.length === 0) {
      return res.status(404).json({ success: false, message: 'Career role not found.' });
    }

    const role = roles[0];
    role.required_competencies = typeof role.required_competencies === 'string'
      ? JSON.parse(role.required_competencies)
      : role.required_competencies;

    return res.status(200).json({ success: true, data: role });
  } catch (error) {
    console.error('[Get Career Role By Id Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/career/target
 * Student selects or updates their primary target career role.
 */
async function setStudentCareerTarget(req, res) {
  try {
    const studentId = (req.user && req.user.studentId) || parseInt(req.body.student_id || req.body.studentId, 10);
    const role_id = req.body.role_id || req.body.career_role_id;
    const target_proficiency = req.body.target_proficiency || 'Entry';

    if (!studentId || !role_id) {
      return res.status(400).json({ success: false, message: 'student_id and role_id are required.' });
    }

    // Verify role exists
    const [roles] = await db.query('SELECT id, title FROM career_roles WHERE id = ? AND is_active = 1', [role_id]);
    if (roles.length === 0) {
      return res.status(404).json({ success: false, message: 'Selected career track is invalid or inactive.' });
    }

    await db.query(
      `INSERT INTO student_career_targets (student_id, role_id, target_proficiency, status)
       VALUES (?, ?, ?, 'In Progress')
       ON DUPLICATE KEY UPDATE target_proficiency = VALUES(target_proficiency), status = 'In Progress', updated_at = NOW()`,
      [studentId, role_id, target_proficiency]
    );

    return res.status(200).json({
      success: true,
      message: `Target career path updated to ${roles[0].title}. Evaluation and roadmap updated.`
    });
  } catch (error) {
    console.error('[Set Career Target Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/career/evaluation/:studentId
 * Holistic competency assessment against target or requested career role.
 */
async function getCareerReadinessEvaluation(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const requestedRoleId = req.query.role_id ? parseInt(req.query.role_id, 10) : null;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required.' });
    }

    // 1. Fetch student's target role or requested role
    let roleId = requestedRoleId;
    let targetRecord = null;

    if (!roleId) {
      const [targets] = await db.query(
        `SELECT sct.*, cr.title, cr.category, cr.description, cr.required_competencies
         FROM student_career_targets sct
         JOIN career_roles cr ON cr.id = sct.role_id
         WHERE sct.student_id = ?
         ORDER BY sct.updated_at DESC LIMIT 1`,
        [studentId]
      );
      if (targets.length > 0) {
        targetRecord = targets[0];
        roleId = targetRecord.role_id;
      }
    }

    // If still no role, default to first available role (e.g. Software Engineering or VLSI)
    let role = null;
    if (targetRecord) {
      role = targetRecord;
    } else {
      const [roles] = await db.query(
        roleId ? 'SELECT * FROM career_roles WHERE id = ?' : 'SELECT * FROM career_roles WHERE is_active = 1 LIMIT 1',
        roleId ? [roleId] : []
      );
      if (roles.length === 0) {
        return res.status(404).json({ success: false, message: 'No career roles configured.' });
      }
      role = roles[0];
    }

    const competencies = typeof role.required_competencies === 'string'
      ? JSON.parse(role.required_competencies)
      : role.required_competencies;

    // 2. Fetch student's academic marks (for course mapping)
    const [marks] = await db.query(
      `SELECT m.*, s.subject_name, s.subject_code 
       FROM marks m 
       JOIN subjects s ON s.id = m.subject_id 
       WHERE m.student_id = ?`,
      [studentId]
    );

    // 3. Fetch student's verified achievements
    const [achievements] = await db.query(
      `SELECT * FROM achievements WHERE student_id = ? AND status = 'Verified'`,
      [studentId]
    );

    // 4. Fetch student's verified skills & self-declared skills
    const [skills] = await db.query(
      `SELECT * FROM student_skills WHERE student_id = ?`,
      [studentId]
    );

    // 5. Evaluate each competency
    let totalWeight = 0;
    let earnedScore = 0;
    const evaluatedCompetencies = [];
    const missingCompetencies = [];
    const demonstratedCompetencies = [];

    for (const comp of competencies) {
      const weight = Number(comp.weight || 20);
      totalWeight += weight;

      const compNameLower = comp.name.toLowerCase();
      let matchScore = 0; // 0 to 100
      let evidenceType = 'None';
      let evidenceDetails = 'No verified academic records or certifications found for this competency.';
      let isVerified = false;

      // Check matching academic subject grade
      const matchedSubject = marks.find(m => {
        const subName = (m.subject_name || '').toLowerCase();
        const words = compNameLower.split(/\s+/).filter(w => w.length > 3);
        return words.some(w => subName.includes(w));
      });

      if (matchedSubject) {
        const tot = Number(matchedSubject.total_marks || 0);
        if (tot >= 80) matchScore = Math.max(matchScore, 95);
        else if (tot >= 70) matchScore = Math.max(matchScore, 80);
        else if (tot >= 60) matchScore = Math.max(matchScore, 65);
        else matchScore = Math.max(matchScore, 40);

        evidenceType = 'Academic Coursework';
        evidenceDetails = `Completed ${matchedSubject.subject_name} with Grade ${matchedSubject.grade} (${tot}/100).`;
        isVerified = true;
      }

      // Check matching verified achievements & certifications
      const matchedAch = achievements.find(a => {
        const title = (a.title || '').toLowerCase();
        const desc = (a.description || '').toLowerCase();
        const cat = (a.category || '').toLowerCase();
        const words = compNameLower.split(/\s+/).filter(w => w.length > 3);
        return words.some(w => title.includes(w) || desc.includes(w)) || 
               (compNameLower.includes('hackathon') && cat.includes('hackathon')) ||
               (compNameLower.includes('cert') && cat.includes('cert'));
      });

      if (matchedAch) {
        matchScore = Math.max(matchScore, 90);
        evidenceType = 'Verified Credential / Activity';
        evidenceDetails = `Verified Achievement: "${matchedAch.title}" (${matchedAch.category}, ${matchedAch.achievement_date}).`;
        isVerified = true;
      }

      // Check self-declared or explicitly listed skills
      const matchedSkill = skills.find(s => {
        const sName = (s.skill_name || '').toLowerCase();
        return compNameLower.includes(sName) || sName.includes(compNameLower);
      });

      if (matchedSkill) {
        if (matchedSkill.is_verified) {
          matchScore = Math.max(matchScore, 90);
          evidenceType = 'Verified Skill Assessment';
          evidenceDetails = `Skill verified by departmental mentor (${matchedSkill.proficiency_level}).`;
          isVerified = true;
        } else {
          // Self-declared carries capped weight (max 50% without proof)
          if (matchScore === 0) {
            matchScore = 50;
            evidenceType = 'Self-Declared Skill';
            evidenceDetails = `Self-declared competency (${matchedSkill.proficiency_level}); verification pending.`;
            isVerified = false;
          }
        }
      }

      // Compute weighted points
      earnedScore += (matchScore * (weight / 100));

      const evaluationItem = {
        name: comp.name,
        category: comp.category,
        requiredProficiency: comp.requiredProficiency || 'Intermediate',
        weight,
        scorePercentage: matchScore,
        status: matchScore >= 75 ? 'Demonstrated' : matchScore >= 45 ? 'Developing' : 'Missing',
        isVerified,
        evidenceType,
        evidenceDetails
      };

      evaluatedCompetencies.push(evaluationItem);

      if (evaluationItem.status === 'Demonstrated') {
        demonstratedCompetencies.push(evaluationItem);
      } else {
        missingCompetencies.push(evaluationItem);
      }
    }

    const readinessIndex = totalWeight > 0 ? Number(Math.min(100, (earnedScore / totalWeight) * 100).toFixed(1)) : 0;

    // 6. Generate Prioritized Learning Roadmap
    const milestones = missingCompetencies.map((gap, index) => {
      let priority = 'MEDIUM';
      let action = `Complete coursework or mini-project in ${gap.name}.`;
      let recommendedResource = 'Institutional library & faculty mentor consultation';

      if (gap.weight >= 25 || gap.status === 'Missing') {
        priority = 'HIGH';
        action = `Urgent skill acquisition: Build a focused demonstrable project and solve core exercises in ${gap.name}.`;
        recommendedResource = 'NPTEL Certification & Departmental Lab Workshops';
      }

      return {
        step: index + 1,
        title: gap.name,
        priority,
        competency: gap.name,
        category: gap.category,
        action,
        recommendedResource,
        status: 'Pending'
      };
    });

    // Curated project recommendations based on role
    const projectRecommendations = [
      {
        title: `Capstone Implementation for ${role.title}`,
        domain: role.title,
        difficulty: 'Intermediate',
        deliverable: 'GitHub Repository with full documentation and test suite'
      },
      {
        title: `Standardized Verification Benchmark in ${role.category}`,
        domain: role.category,
        difficulty: 'Advanced',
        deliverable: 'Technical report and demonstration to assigned faculty advisor'
      }
    ];

    // Interview Preparation Modules
    const interviewPrep = [
      {
        module: 'Core Technical Fundamentals & Architecture',
        focus: `Rigorous problem solving covering ${role.title} foundational principles.`,
        format: '30-minute structured mock interview with mentor'
      },
      {
        module: 'Practical Portfolio Defense',
        focus: 'Explain design tradeoffs and code architecture from your verified achievements.',
        format: 'Portfolio presentation'
      }
    ];

    // Save or update roadmap in database
    await db.query(
      `INSERT INTO career_roadmaps 
        (student_id, role_id, milestones, overall_progress, recommended_projects, interview_prep_modules)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
        milestones = VALUES(milestones),
        overall_progress = VALUES(overall_progress),
        recommended_projects = VALUES(recommended_projects),
        interview_prep_modules = VALUES(interview_prep_modules),
        last_evaluated_at = NOW()`,
      [
        studentId,
        role.id,
        JSON.stringify(milestones),
        readinessIndex,
        JSON.stringify(projectRecommendations),
        JSON.stringify(interviewPrep)
      ]
    );

    return res.status(200).json({
      success: true,
      role: {
        id: role.id,
        title: role.title,
        category: role.category,
        description: role.description
      },
      readinessIndex,
      competenciesCount: competencies.length,
      demonstratedCount: demonstratedCompetencies.length,
      missingCount: missingCompetencies.length,
      evaluatedCompetencies,
      roadmap: {
        milestones,
        recommendedProjects: projectRecommendations,
        interviewPreparation: interviewPrep
      },
      evidenceNotice: 'Readiness evaluation strictly separates verified credentials (course marks, accredited certifications, faculty approvals) from unverified self-declared tags.'
    });

  } catch (error) {
    console.error('[Career Evaluation Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/career/skills (Student adds self-declared skill)
 */
async function addStudentSkill(req, res) {
  try {
    const studentId = req.user.role === 'student' ? req.user.studentId : parseInt(req.body.student_id, 10);
    const { skill_name, proficiency_level = 'Intermediate' } = req.body;

    if (!studentId || !skill_name) {
      return res.status(400).json({ success: false, message: 'Valid skill_name is required.' });
    }

    await db.query(
      `INSERT INTO student_skills (student_id, skill_name, proficiency_level, is_verified, evidence_type)
       VALUES (?, ?, ?, 0, 'Self-Declared')
       ON DUPLICATE KEY UPDATE proficiency_level = VALUES(proficiency_level), updated_at = NOW()`,
      [studentId, skill_name.trim(), proficiency_level]
    );

    return res.status(201).json({
      success: true,
      message: `Skill "${skill_name}" added as Self-Declared. Request mentor verification to earn verified credit.`
    });
  } catch (error) {
    console.error('[Add Skill Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * PUT /api/career/skills/:id/verify (Faculty / Mentor verifies a student skill)
 */
async function verifyStudentSkill(req, res) {
  try {
    const skillId = parseInt(req.params.id, 10);
    const facultyId = req.user.id;

    if (!facultyId || req.user.role !== 'faculty') {
      return res.status(403).json({ success: false, message: 'Only authorized faculty mentors can verify student skills.' });
    }

    await db.query(
      `UPDATE student_skills 
       SET is_verified = 1, verified_by = ?, evidence_type = 'Activity', updated_at = NOW() 
       WHERE id = ?`,
      [facultyId, skillId]
    );

    return res.status(200).json({
      success: true,
      message: 'Student skill verified successfully.'
    });
  } catch (error) {
    console.error('[Verify Skill Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * PUT /api/career/roles/:id (Admin / Authorized Faculty updates role requirements)
 */
async function updateCareerRole(req, res) {
  try {
    if (req.user.role !== 'admin' && !(req.user.role === 'faculty' && req.user.isHOD)) {
      return res.status(403).json({ success: false, message: 'Access denied: Requires Administrator or HOD authority.' });
    }

    const id = parseInt(req.params.id, 10);
    const { title, description, required_competencies, is_active } = req.body;

    const [existing] = await db.query('SELECT * FROM career_roles WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Career role not found.' });
    }

    const updatedCompetencies = required_competencies 
      ? (typeof required_competencies === 'string' ? required_competencies : JSON.stringify(required_competencies))
      : existing[0].required_competencies;

    await db.query(
      `UPDATE career_roles 
       SET title = COALESCE(?, title), 
           description = COALESCE(?, description), 
           required_competencies = ?, 
           is_active = COALESCE(?, is_active), 
           updated_at = NOW() 
       WHERE id = ?`,
      [title, description, updatedCompetencies, is_active, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Career track requirements updated successfully.'
    });
  } catch (error) {
    console.error('[Update Career Role Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getCareerRoles,
  getCareerRoleById,
  setStudentCareerTarget,
  getCareerReadinessEvaluation,
  addStudentSkill,
  verifyStudentSkill,
  updateCareerRole
};
