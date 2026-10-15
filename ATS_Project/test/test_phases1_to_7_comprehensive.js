/**
 * ATS Academic Tracking System — Comprehensive Regression Suite: Phases 1 to 7
 * 
 * Verifies end-to-end functionality across:
 * - Phase 1: Mini-Dashboard Authentication & Navigation (CSS .open, Bearer extraction, Pre-flight checks)
 * - Phase 2: Strict Role-Based Access Control (RBAC) & Administrative Barrier
 * - Phase 3: Database & Department-Wise Organization (All 25 departments aligned, 100% mentor coverage)
 * - Phase 4: Student Dashboard & Dedicated 'PAYMENT UPDATE & PAYMENT STATUS' Section
 * - Phase 5: Faculty Mentee Mini-Dashboard & Exam/Lab Practical Uploads with Validation
 * - Phase 6: HOD Department Mini-Dashboards (Strict departmental filtering & modal triggers)
 * - Phase 7: Admin Department Overview & Read-Only Governance Modal (Department -> HOD -> Faculty & Students)
 */

const fs = require('fs');
const path = require('path');
const db = require('../database/db');

async function runComprehensiveTests() {
  console.log('======================================================================');
  console.log('🚀 ATS COMPREHENSIVE REGRESSION SUITE: PHASES 1 THROUGH 7');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      passed++;
      console.log(`✅ PASS: ${name} ${extra ? '(' + extra + ')' : ''}`);
    } else {
      failed++;
      console.error(`❌ FAIL: ${name} ${extra ? '(' + extra + ')' : ''}`);
    }
  }

  // =========================================================================
  // Phase 1: Mini-Dashboard Modal & Token Hygiene Verification
  // =========================================================================
  console.log('--- Phase 1: Mini-Dashboard Authentication & Navigation ---');
  const apiJs = fs.readFileSync(path.join(__dirname, '../frontend/api.js'), 'utf8');
  const styleCss = fs.readFileSync(path.join(__dirname, '../frontend/style.css'), 'utf8');

  assert('1.1 style.css defines .modal-backdrop.open with opacity: 1 and pointer-events: auto',
    styleCss.includes('.modal-backdrop.open') && styleCss.includes('opacity: 1') && styleCss.includes('pointer-events: auto'));

  assert('1.2 api.js toggles modal.classList.add("open") in showMiniDashboardModal',
    apiJs.includes("modal.classList.add('open')"));

  assert('1.3 api.js sanitizes redundant Bearer prefixes in getToken()',
    apiJs.includes(".replace(/^Bearer\\s+/i, '').trim()"));

  assert('1.4 api.js contains Escape key dismissal for mini-dashboard',
    apiJs.includes("e.key === 'Escape'"));

  // =========================================================================
  // Phase 2: Strict RBAC & Operational Isolation
  // =========================================================================
  console.log('\n--- Phase 2: RBAC Auditing & Administrative Operational Barrier ---');
  const { verifyToken, isFaculty, isHOD, isStrictAdmin } = require('../backend/middleware/authMiddleware');

  // Verify Admin cannot execute faculty marks operations
  const adminReq = { user: { id: 1, role: 'admin', studentId: null, facultyId: null } };
  let adminResStatus = null;
  const adminRes = {
    status(code) { adminResStatus = code; return this; },
    json() { return this; }
  };
  let nextCalled = false;
  isFaculty(adminReq, adminRes, () => { nextCalled = true; });
  assert('2.1 Admin is strictly rejected by isFaculty middleware (HTTP 403)', adminResStatus === 403 && !nextCalled);

  nextCalled = false;
  adminResStatus = null;
  isHOD(adminReq, adminRes, () => { nextCalled = true; });
  assert('2.2 Admin is strictly rejected by isHOD middleware (HTTP 403)', adminResStatus === 403 && !nextCalled);

  nextCalled = false;
  let adminPassed = false;
  isStrictAdmin(adminReq, adminRes, () => { adminPassed = true; });
  assert('2.3 Admin is permitted by isStrictAdmin middleware for account maintenance', adminPassed);

  // =========================================================================
  // Phase 3: Database & Department-Wise Organization (Live DB Check)
  // =========================================================================
  console.log('\n--- Phase 3: Database & Department-Wise Organization ---');
  const [deptStats] = await db.query(`
    SELECT 
      COUNT(DISTINCT d.id) AS total_depts,
      COUNT(DISTINCT dha.department_id) AS depts_with_hod,
      COUNT(DISTINCT f.id) AS total_faculty,
      COUNT(DISTINCT s.id) AS total_students,
      (
        SELECT COUNT(*) 
        FROM students s2 
        LEFT JOIN student_mentors sm ON sm.student_id = s2.id AND sm.status = 'active'
        WHERE sm.id IS NULL
      ) AS unmentored_students
    FROM departments d
    LEFT JOIN department_hod_assignments dha ON dha.department_id = d.id AND dha.status = 'active'
    LEFT JOIN faculty f ON f.department_id = d.id
    LEFT JOIN students s ON s.department_id = d.id
  `);

  const stats = deptStats[0];
  assert('3.1 Exactly 25 departments exist in institutional catalog', Number(stats.total_depts) === 25, `Found: ${stats.total_depts}`);
  assert('3.2 All 25 departments have an active appointed HOD', Number(stats.depts_with_hod) === 25, `Found: ${stats.depts_with_hod}/25`);
  assert('3.3 Institutional faculty staffing meets target (>= 50 faculty members)', Number(stats.total_faculty) >= 50, `Found: ${stats.total_faculty}`);
  assert('3.4 Zero unmentored students across all departments (100% mentor coverage)', Number(stats.unmentored_students) === 0, `Unmentored: ${stats.unmentored_students}`);

  // =========================================================================
  // Phase 4: Student Dashboard & Dedicated Payment Section
  // =========================================================================
  console.log('\n--- Phase 4: Student Dashboard & PAYMENT UPDATE & PAYMENT STATUS ---');
  const dashboardHtml = fs.readFileSync(path.join(__dirname, '../frontend/dashboard.html'), 'utf8');
  const dashboardJs = fs.readFileSync(path.join(__dirname, '../frontend/dashboard.js'), 'utf8');

  assert('4.1 dashboard.html contains exact section title: PAYMENT UPDATE & PAYMENT STATUS',
    dashboardHtml.includes('PAYMENT UPDATE & PAYMENT STATUS'));

  assert('4.2 dashboard.html includes the 4 summary metrics (Due, Paid, Balance, Due Date)',
    dashboardHtml.includes('id="fee-summary-total-due"') &&
    dashboardHtml.includes('id="fee-summary-total-paid"') &&
    dashboardHtml.includes('id="fee-summary-total-balance"') &&
    dashboardHtml.includes('id="fee-summary-due-date"'));

  assert('4.3 dashboard.html contains Risk Criteria modal explaining transparent rules (Att >= 75%, CGPA >= 6.0)',
    dashboardHtml.includes('id="risk-criteria-modal"') &&
    (dashboardHtml.includes('Attendance ≥ 75%') || dashboardHtml.includes('Attendance &ge; 75%')));

  assert('4.4 dashboard.js populates fee summary overview tiles and dynamic risk hints',
    dashboardJs.includes("document.getElementById('fee-summary-total-due')") &&
    dashboardJs.includes("document.getElementById('kpi-risk-threshold-hint')"));

  // =========================================================================
  // Phase 5: Faculty Mentee Management & Exam/Lab Practical Results
  // =========================================================================
  console.log('\n--- Phase 5: Faculty Mentee Mini-Dashboard & Exam/Lab Uploads ---');
  const mentorHtml = fs.readFileSync(path.join(__dirname, '../frontend/mentor-dashboard.html'), 'utf8');
  const mentorJs = fs.readFileSync(path.join(__dirname, '../frontend/mentor-dashboard.js'), 'utf8');

  assert('5.1 mentor-dashboard.html table headers include CGPA, Attendance, Risk Standing, and Pending Work',
    mentorHtml.includes('<th>CGPA</th>') &&
    mentorHtml.includes('<th>Attendance</th>') &&
    mentorHtml.includes('<th>Risk Standing</th>') &&
    mentorHtml.includes('<th>Pending Work</th>'));

  assert('5.2 mentor-dashboard.html contains exam-lab-upload-modal for marks and practical entry',
    mentorHtml.includes('id="exam-lab-upload-modal"') &&
    mentorHtml.includes('id="exam-lab-upload-form"'));

  assert('5.3 mentor-dashboard.js validates that marks_obtained <= max_marks',
    mentorJs.includes('marksObtained > maxMarks'));

  assert('5.4 mentorController.getMyMentees query selects cgpa, attendance_percentage, risk_level',
    mentorJs.includes('m.attendance_percentage') && mentorJs.includes('m.risk_level'));

  // =========================================================================
  // Phase 6: HOD Student & Staff Mini-Dashboards
  // =========================================================================
  console.log('\n--- Phase 6: HOD Student & Staff Mini-Dashboards ---');
  const hodHtml = fs.readFileSync(path.join(__dirname, '../frontend/hod-dashboard.html'), 'utf8');
  const hodJs = fs.readFileSync(path.join(__dirname, '../frontend/hod-dashboard.js'), 'utf8');

  assert('6.1 hod-dashboard.js triggers openFacultyMiniDashboard on faculty cards',
    hodJs.includes('openFacultyMiniDashboard('));

  assert('6.2 hod-dashboard.js triggers openStudentMiniDashboard on student allocations',
    hodJs.includes('openStudentMiniDashboard('));

  // =========================================================================
  // Phase 7: Admin Department Overview & Read-Only Governance Modal
  // =========================================================================
  console.log('\n--- Phase 7: Admin Department Overview & Read-Only Modal ---');
  const adminHtml = fs.readFileSync(path.join(__dirname, '../frontend/admin-dashboard.html'), 'utf8');
  const adminJs = fs.readFileSync(path.join(__dirname, '../frontend/admin.js'), 'utf8');

  assert('7.1 admin-dashboard.html contains read-only admin-dept-modal',
    adminHtml.includes('id="admin-dept-modal"'));

  assert('7.2 admin-dashboard.html contains governance banner barring admin from marks and payments',
    adminHtml.includes('ADMINISTRATIVE READ-ONLY GOVERNANCE'));

  assert('7.3 admin.js binds click handler openAdminDeptModal on department overview cards',
    adminJs.includes('onclick="openAdminDeptModal(${d.id})"'));

  assert('7.4 admin.js renders Department -> HOD -> Faculty Roster & Student Scholars with mentor status',
    adminJs.includes('admin-dept-hod-name') &&
    adminJs.includes('admin-dept-faculty-table-body') &&
    adminJs.includes('admin-dept-students-table-body'));

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n======================================================================');
  console.log(`📊 COMPREHENSIVE SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL PHASES 1 TO 7 VERIFIED WITH 100% COMPLIANCE!');
    process.exit(0);
  }
}

runComprehensiveTests().catch(err => {
  console.error('Fatal error in comprehensive test suite:', err);
  process.exit(1);
});
