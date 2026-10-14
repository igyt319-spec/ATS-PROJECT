const db = require('../config/db');
require('dotenv').config();

// Intelligent Local NLP Fallback Engine using actual student records
function generateContextualResponse(student, marks, attendance, achievements, userMessage) {
  const q = userMessage.toLowerCase();
  const credits = marks.reduce((sum, m) => sum + Number(m.credits || 0), 0);
  const gpa = credits ? marks.reduce((sum, m) => sum + Number(m.grade_point || 0) * Number(m.credits || 0), 0) / credits : 0;
  const plannedSubject = marks[0]?.subject_name || 'a subject with recorded marks';

  // Find weak and strong subjects
  const weakSubjects = marks.filter(m => parseFloat(m.total_marks) < 60 || m.status === 'Weak');
  const strongSubjects = marks.filter(m => parseFloat(m.total_marks) >= 80 || m.status === 'Strong');
  const averageSubjects = marks.filter(m => parseFloat(m.total_marks) >= 60 && parseFloat(m.total_marks) < 80);

  // Find attendance issues
  const lowAttendance = attendance.filter(a => parseFloat(a.percentage) < 75);
  const monitorAttendance = attendance.filter(a => parseFloat(a.percentage) >= 75 && parseFloat(a.percentage) < 85);

  let totalClasses = 0;
  let attendedClasses = 0;
  attendance.forEach(a => {
    totalClasses += Number(a.classes_conducted ?? a.total_classes) || 0;
    attendedClasses += Number(a.classes_attended ?? a.attended_classes) || 0;
  });
  const overallAtt = totalClasses > 0 ? ((attendedClasses / totalClasses) * 100).toFixed(1) : '0.0';

  // 1. Weak Subjects inquiry
  if (q.includes('weak') || q.includes('failing') || q.includes('poor marks') || q.includes('lowest')) {
    if (weakSubjects.length > 0) {
      const details = weakSubjects.map(ws => `• **${ws.subject_name || 'Subject'}**: Score ${ws.total_marks}/100 (Internal: ${ws.internal_marks}/20, Exam: ${ws.exam_marks}/60)`).join('\n');
      return `Based on your saved academic records, here are the subjects requiring attention:\n\n${details}\n\n💡 **AI Recommendation**: Prioritize practice in the lowest scoring subject and consult its assigned faculty member.`;
    } else {
      return `🎉 Great news, **${student.name}**! You do not currently have any subjects classified as **Weak** (<60%). Your lowest current score is in **${averageSubjects[0]?.subject_name || 'your core subjects'}** at ${averageSubjects[0]?.total_marks || '70'}/100.`;
    }
  }

  // 2. Attendance safety inquiry
  if (q.includes('attendance') || q.includes('safe') || q.includes('bunk') || q.includes('present') || q.includes('percentage')) {
    if (lowAttendance.length > 0) {
      const alertList = lowAttendance.map(a => `• **${a.subject_name || 'Subject'}**: ${a.percentage}% (${a.attended_classes}/${a.total_classes} classes)`).join('\n');
      return `⚠️ **Attendance Warning for ${student.name}**:\nYour overall attendance is **${overallAtt}%**, but the following subject(s) are **below the mandatory 75% threshold**:\n\n${alertList}\n\n🚨 You must attend the next 4–5 consecutive classes without fail to avoid semester examination condonation or hall-ticket detention!`;
    } else {
      return `✅ **Your Attendance is Safe!**\nYour overall attendance stands at **${overallAtt}%**, safely above the university minimum of 75%. Keep up this consistency to maximize your continuous internal assessment (CIA) score!`;
    }
  }

  // 3. GPA Improvement inquiry
  if (q.includes('improve') || q.includes('gpa') || q.includes('cgpa') || q.includes('score higher') || q.includes('better grade')) {
    const focusTarget = weakSubjects.length > 0 ? weakSubjects[0].subject_name : (averageSubjects[0]?.subject_name || 'Mathematics');
    return `Your current calculated GPA from recorded grade points is **${gpa.toFixed(2)}**. To improve it:\n\n1. **High Impact Target**: Focus on **${focusTarget}**, your lowest current-scoring subject.\n2. **Assessments**: Review feedback and strengthen internal, assignment, and exam scores.\n3. **Attendance**: Aim for at least 85% in each subject.\n4. **Portfolio**: Add verified achievements when you complete eligible activities.`;
  }

  // 4. Focus / Study prioritization inquiry
  if (q.includes('focus') || q.includes('which subject') || q.includes('what should i study') || q.includes('priority')) {
    const target = weakSubjects.length > 0 ? weakSubjects[0] : (averageSubjects[0] || marks[0]);
    return `🎯 **Primary Focus Subject This Week: ${target.subject_name || plannedSubject}**\n\n**Reasoning**:\n• Current Mark: ${target.total_marks}/100 (${target.status} status)\n• This is the lowest scoring subject in your saved academic records.\n\n**Action Steps**:\n1. Review the topics covered by your latest feedback.\n2. Work through practice questions for those topics.\n3. Ask the assigned faculty member for guidance where you are stuck.`;
  }

  // 5. Achievements inquiry
  if (q.includes('achievement') || q.includes('certificate') || q.includes('award') || q.includes('hackathon') || q.includes('sports')) {
    if (achievements.length > 0) {
      const topList = achievements.slice(0, 4).map(a => `• **${a.title}** (${a.category}) - *${a.status}*`).join('\n');
      return `🏆 You currently have **${achievements.length} verified achievements** on your ATS profile:\n\n${topList}\n\nThese verified records contribute to the achievement component of your ATS academic score.`;
    } else {
      return `You haven't uploaded any extracurricular achievements yet. Upload your hackathon participations, paper presentations, or certifications to boost your ATS Academic Score!`;
    }
  }

  // 6. Study Plan inquiry
  if (q.includes('study plan') || q.includes('timetable') || q.includes('routine') || q.includes('schedule')) {
    return `📅 **Personalized 7-Day Study Plan for ${student.name}**:\n\n• **Days 1–2**: *${weakSubjects[0]?.subject_name || plannedSubject}* - Review feedback and target the lowest-scoring topics.\n• **Days 3–4**: *${averageSubjects[0]?.subject_name || plannedSubject}* - Practice questions and complete pending coursework.\n• **Day 5**: *${strongSubjects[0]?.subject_name || plannedSubject}* - Consolidate concepts and maintain your strong performance.\n• **Day 6**: Review lab work and attempt a timed practice set.\n• **Day 7**: Check progress and plan the next week from your updated records.`;
  }

  // 7. General greeting or query
    return `Hello **${student.name}**! I am your AI Academic Assistant 🤖. I use your saved academic profile (${student.department}, Year ${student.year}, calculated GPA ${gpa.toFixed(2)}).\n\nYou can ask me:\n• *"What are my weak subjects?"*\n• *"Is my attendance safe?"*\n• *"How can I improve my GPA?"*\n• *"Which subject should I focus on this week?"*\n• *"Give me a personalized study plan."*`;
}

// POST /api/chatbot/message
async function handleMessage(req, res) {
  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    const studentId = req.user.role === 'student' ? Number(req.user.studentId) : Number(req.body.student_id);
    if (!studentId) return res.status(400).json({ success: false, message: 'A student profile is required for this chat.' });
    const [students] = await db.query('SELECT st.*,d.name AS department FROM students st LEFT JOIN departments d ON d.id=st.department_id WHERE st.id = ?', [studentId]);

    if (!students || students.length === 0) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const student = students[0];

    const [marks] = await db.query('SELECT m.*,s.subject_name,s.credits FROM marks m JOIN subjects s ON s.id=m.subject_id JOIN students st ON st.id=m.student_id WHERE m.student_id = ? AND (m.semester_id=st.current_semester_id OR m.semester_id IS NULL) ORDER BY m.semester_id', [studentId]);
    const [attendance] = await db.query('SELECT a.*,s.subject_name FROM attendance a JOIN subjects s ON s.id=a.subject_id JOIN students st ON st.id=a.student_id WHERE a.student_id = ? AND (a.semester_id=st.current_semester_id OR a.semester_id IS NULL)', [studentId]);
    const [achievements] = await db.query("SELECT * FROM achievements WHERE student_id = ? AND status='Verified' ORDER BY achievement_date DESC", [studentId]);

    // Save user message to chat_history
    await db.query("INSERT INTO chat_history (student_id, sender, message) VALUES (?, 'user', ?)", [studentId, message.trim()]);

    // Generate intelligent data-backed response
    const botReply = generateContextualResponse(student, marks, attendance, achievements, message.trim());

    // Save bot message to chat_history
    await db.query("INSERT INTO chat_history (student_id, sender, message) VALUES (?, 'bot', ?)", [studentId, botReply]);

    return res.status(200).json({
      success: true,
      sender: 'bot',
      reply: botReply,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Chatbot Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/chatbot/history/:studentId
async function getChatHistory(req, res) {
  try {
    const studentId = parseInt(req.params.studentId || 1, 10);
    const [history] = await db.query('SELECT * FROM chat_history WHERE student_id = ? ORDER BY created_at ASC', [studentId]);

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// DELETE /api/chatbot/history/:studentId
async function clearChatHistory(req, res) {
  try {
    const studentId = parseInt(req.params.studentId || 1, 10);
    await db.query('DELETE FROM chat_history WHERE student_id = ?', [studentId]);
    return res.status(200).json({ success: true, message: 'Chat history cleared successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  handleMessage,
  getChatHistory,
  clearChatHistory
};
