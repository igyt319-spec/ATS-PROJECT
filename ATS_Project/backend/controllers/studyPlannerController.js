const db = require('../../database/db');

/**
 * GET /api/study-planner/:studentId
 * Returns the student's active study plan, tasks, and progress statistics.
 */
async function getStudyPlan(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required.' });
    }

    // 1. Fetch or automatically initialize active study plan
    let [plans] = await db.query(
      "SELECT * FROM student_study_plans WHERE student_id = ? AND status = 'Active' ORDER BY created_at DESC LIMIT 1",
      [studentId]
    );

    let plan = null;
    if (plans.length === 0) {
      // Auto-initialize default adaptive plan
      const [insertRes] = await db.query(
        `INSERT INTO student_study_plans (student_id, title, weekly_goal_hours, preferred_days, status)
         VALUES (?, 'Personalized Adaptive Revision Plan', 12.0, 'Monday, Tuesday, Wednesday, Thursday, Friday, Saturday', 'Active')`,
        [studentId]
      );
      const [newPlans] = await db.query('SELECT * FROM student_study_plans WHERE id = ?', [insertRes.insertId]);
      plan = newPlans[0];
    } else {
      plan = plans[0];
    }

    // 2. Fetch tasks under this plan
    const [tasks] = await db.query(
      "SELECT * FROM student_study_tasks WHERE plan_id = ? ORDER BY FIELD(priority, 'High', 'Medium', 'Low'), target_date ASC, id ASC",
      [plan.id]
    );

    // 3. If tasks are empty, auto-generate priority tasks from student's real weak subjects
    if (tasks.length === 0) {
      const [weakMarks] = await db.query(`
        SELECT m.*, s.subject_name, s.subject_code, s.credits
        FROM marks m
        JOIN subjects s ON s.id = m.subject_id
        WHERE m.student_id = ? AND (m.total_marks < 70 OR m.status IN ('Weak', 'Average'))
        ORDER BY m.total_marks ASC
        LIMIT 4
      `, [studentId]);

      for (const wm of weakMarks) {
        const priority = Number(wm.total_marks) < 60 ? 'High' : 'Medium';
        await db.query(`
          INSERT INTO student_study_tasks 
          (plan_id, student_id, subject_id, subject_name, topic_name, prerequisite_topics, priority, estimated_hours, completed_hours, status, target_date, resource_recommendation)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.0, 'Not Started', DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY), ?)
        `, [
          plan.id,
          studentId,
          wm.subject_id,
          wm.subject_name,
          `Remedial Review & Problem Solving: ${wm.subject_name}`,
          `Foundational concepts in ${wm.subject_code}`,
          priority,
          priority === 'High' ? 4.0 : 2.5,
          `Recommended by ATS: Focus on previous semester CIA feedback and past 3 years' question papers for ${wm.subject_code}.`
        ]);
      }
    }

    // Re-fetch tasks after potential initial generation
    const [finalTasks] = await db.query(
      "SELECT * FROM student_study_tasks WHERE plan_id = ? ORDER BY FIELD(priority, 'High', 'Medium', 'Low'), target_date ASC, id ASC",
      [plan.id]
    );

    // Calculate plan progress metrics
    const totalTasks = finalTasks.length;
    const completedTasks = finalTasks.filter(t => t.status === 'Completed').length;
    const inProgressTasks = finalTasks.filter(t => t.status === 'In Progress').length;
    const totalEstimatedHours = finalTasks.reduce((sum, t) => sum + Number(t.estimated_hours || 0), 0);
    const totalCompletedHours = finalTasks.reduce((sum, t) => sum + Number(t.completed_hours || 0), 0);
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        plan,
        tasks: finalTasks,
        stats: {
          totalTasks,
          completedTasks,
          inProgressTasks,
          pendingTasks: totalTasks - completedTasks,
          totalEstimatedHours,
          totalCompletedHours,
          progressPercentage,
          weeklyGoalHours: Number(plan.weekly_goal_hours || 12.0)
        }
      }
    });

  } catch (err) {
    console.error('[getStudyPlan Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/study-planner
 * Updates or creates study plan settings (weekly goal hours, preferred days, target date)
 */
async function updateStudyPlanSettings(req, res) {
  try {
    const { student_id, weekly_goal_hours, preferred_days, target_date, title } = req.body;
    const studentId = parseInt(student_id, 10);

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ success: false, message: 'Valid student_id is required.' });
    }

    const goalHours = Math.max(1, Math.min(80, parseFloat(weekly_goal_hours) || 12.0));
    const prefDays = preferred_days || 'Monday, Tuesday, Wednesday, Thursday, Friday, Saturday';

    const [existing] = await db.query(
      "SELECT id FROM student_study_plans WHERE student_id = ? AND status = 'Active' LIMIT 1",
      [studentId]
    );

    if (existing.length > 0) {
      await db.query(`
        UPDATE student_study_plans 
        SET weekly_goal_hours = ?, preferred_days = ?, target_date = ?, title = COALESCE(?, title), updated_at = NOW()
        WHERE id = ?
      `, [goalHours, prefDays, target_date || null, title || null, existing[0].id]);
    } else {
      await db.query(`
        INSERT INTO student_study_plans (student_id, title, weekly_goal_hours, preferred_days, target_date, status)
        VALUES (?, COALESCE(?, 'Personalized Adaptive Revision Plan'), ?, ?, ?, 'Active')
      `, [studentId, title || null, goalHours, prefDays, target_date || null]);
    }

    return res.status(200).json({
      success: true,
      message: 'Study planner settings updated successfully.'
    });

  } catch (err) {
    console.error('[updateStudyPlanSettings Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/study-planner/task
 * Adds a new task to the student's study plan
 */
async function addStudyTask(req, res) {
  try {
    const { student_id, plan_id, subject_id, subject_name, topic_name, prerequisite_topics, priority, estimated_hours, target_date, resource_recommendation } = req.body;
    const studentId = parseInt(student_id, 10);

    if (!studentId || isNaN(studentId) || !topic_name) {
      return res.status(400).json({ success: false, message: 'student_id and topic_name are required.' });
    }

    const resolvedSubjName = (subject_name && subject_name.trim()) || 'Core Engineering Subject';

    // Resolve plan ID
    let resolvedPlanId = plan_id ? parseInt(plan_id, 10) : null;
    if (!resolvedPlanId) {
      const [plans] = await db.query("SELECT id FROM student_study_plans WHERE student_id = ? AND status = 'Active' LIMIT 1", [studentId]);
      if (plans.length > 0) resolvedPlanId = plans[0].id;
      else {
        const [newPlan] = await db.query("INSERT INTO student_study_plans (student_id, title, weekly_goal_hours, status) VALUES (?, 'Personalized Adaptive Revision Plan', 12.0, 'Active')", [studentId]);
        resolvedPlanId = newPlan.insertId;
      }
    }

    const [result] = await db.query(`
      INSERT INTO student_study_tasks 
      (plan_id, student_id, subject_id, subject_name, topic_name, prerequisite_topics, priority, estimated_hours, status, target_date, resource_recommendation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Not Started', ?, ?)
    `, [
      resolvedPlanId,
      studentId,
      subject_id ? parseInt(subject_id, 10) : null,
      resolvedSubjName,
      topic_name.trim(),
      prerequisite_topics || null,
      ['High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium',
      parseFloat(estimated_hours) || 2.0,
      target_date || null,
      resource_recommendation || null
    ]);

    return res.status(201).json({
      success: true,
      message: 'Study task added successfully.',
      taskId: result.insertId
    });

  } catch (err) {
    console.error('[addStudyTask Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/study-planner/task/:taskId
 * Updates task status, completed hours, or priority
 */
async function updateStudyTask(req, res) {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Valid taskId is required.' });
    }

    const { status, completed_hours, priority, target_date } = req.body;

    const [tasks] = await db.query('SELECT * FROM student_study_tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Study task not found.' });
    }

    const task = tasks[0];

    // Ownership check: Student can only edit own task
    if (req.user?.role === 'student' && task.student_id !== req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only edit your own tasks.' });
    }

    const newStatus = ['Not Started', 'In Progress', 'Completed'].includes(status) ? status : task.status;
    const newCompleted = completed_hours !== undefined ? parseFloat(completed_hours) : task.completed_hours;
    const newPriority = ['High', 'Medium', 'Low'].includes(priority) ? priority : task.priority;
    const newTargetDate = target_date !== undefined ? target_date : task.target_date;

    await db.query(`
      UPDATE student_study_tasks 
      SET status = ?, completed_hours = ?, priority = ?, target_date = ?, updated_at = NOW()
      WHERE id = ?
    `, [newStatus, newCompleted, newPriority, newTargetDate, taskId]);

    return res.status(200).json({
      success: true,
      message: 'Study task updated successfully.'
    });

  } catch (err) {
    console.error('[updateStudyTask Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/study-planner/task/:taskId
 * Removes a study task
 */
async function deleteStudyTask(req, res) {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Valid taskId is required.' });
    }

    const [tasks] = await db.query('SELECT * FROM student_study_tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Study task not found.' });
    }

    const task = tasks[0];
    if (req.user?.role === 'student' && task.student_id !== req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await db.query('DELETE FROM student_study_tasks WHERE id = ?', [taskId]);
    return res.status(200).json({ success: true, message: 'Task deleted successfully.' });

  } catch (err) {
    console.error('[deleteStudyTask Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getStudyPlan,
  updateStudyPlanSettings,
  addStudyTask,
  updateStudyTask,
  deleteStudyTask
};
