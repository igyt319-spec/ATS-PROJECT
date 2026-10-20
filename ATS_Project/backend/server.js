const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
  const origLookup = dns.lookup;
  dns.lookup = function(hostname, options, callback) {
    if (typeof options === 'function') { callback = options; options = {}; }
    const opts = Object.assign({}, typeof options === 'object' ? options : { hints: options }, { family: 4 });
    return origLookup.call(this, hostname, opts, callback);
  };
} catch (e) {}

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./config/db');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const performanceRoutes = require('./routes/performanceRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const achievementRoutes = require('./routes/achievementRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const aiRoutes = require('./routes/aiRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const academicResultsRoutes = require('./routes/academicResultsRoutes');
const activityRoutes = require('./routes/activityRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const feeRoutes = require('./routes/feeRoutes');
const mentorRoutes = require('./routes/mentorRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const auditRoutes = require('./routes/auditRoutes');
const digitalTwinRoutes = require('./routes/digitalTwinRoutes');
const careerRoutes = require('./routes/careerRoutes');
const simulatorRoutes = require('./routes/simulatorRoutes');
const collegeTwinRoutes = require('./routes/collegeTwinRoutes');
const docsRoutes = require('./routes/docsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve Frontend Static Files & Uploads
const frontendPath = path.join(__dirname, '../frontend');
const uploadsPath = path.join(__dirname, '../uploads');
app.use(express.static(frontendPath));
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/digital-twin', digitalTwinRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/college-twin', collegeTwinRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/results', academicResultsRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', catalogRoutes);

// Health check endpoint (both /api/health and /health supported for Render)
app.get(['/api/health', '/health'], async (req, res) => {
  const dbStatus = db.getDbStatus();
  let dataSummary = { provenance: 'Legacy in-memory sample data; not persistent and not the 100-student MySQL seed.' };
  if (dbStatus.isMySQL) {
    try {
      const [[students]] = await db.query("SELECT COUNT(*) AS total FROM students WHERE register_number LIKE 'BITD%'");
      const [[departments]] = await db.query('SELECT COUNT(*) AS total FROM departments');
      const [[subjects]] = await db.query('SELECT COUNT(*) AS total FROM subjects');
      dataSummary = { provenance: 'Seed records are synthetic; college structure is based on public official information.', syntheticStudents: Number(students.total), departments: Number(departments.total), subjects: Number(subjects.total) };
    } catch (error) {
      dataSummary = { provenance: 'MySQL connected, but dataset summary could not be queried.', error: error.message };
    }
  }
  res.status(200).json({
    status: 'online',
    appName: 'AI-Based Academic Progress and Achievement Tracking System (ATS)',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    data: dataSummary,
    endpoints: [
      '/api/auth',
      '/api/students',
      '/api/performance',
      '/api/attendance',
      '/api/achievements',
      '/api/recommendations',
      '/api/notifications',
      '/api/dashboard',
      '/api/chatbot',
      '/api/ai',
      '/api/digital-twin',
      '/api/career',
      '/api/simulator',
      '/api/college-twin',
      '/api/docs',
      '/api/departments',
      '/api/audit-logs'
    ]
  });
});

// Friendly 404 Route for unhandled APIs
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found on this ATS server.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[ATS Server Error]', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred. Please try again later.'
  });
});

// Initialize database and start HTTP server
async function startServer() {
  try {
    await db.initDB();
  } catch (dbErr) {
    console.warn('[Server Startup Warning] DB Init notice:', dbErr.message);
  }

  app.listen(PORT, () => {
    console.log('================================================================');
    console.log(`🚀 ATS Server is running on: http://localhost:${PORT}`);
    console.log(`📱 Portal UI: http://localhost:${PORT}/index.html`);
    console.log(`🔐 Login Page: http://localhost:${PORT}/login.html`);
    console.log(`📊 Student Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`🛠️ Admin Dashboard: http://localhost:${PORT}/admin-dashboard.html`);
    console.log('================================================================');
  });
}

startServer();

module.exports = app;
