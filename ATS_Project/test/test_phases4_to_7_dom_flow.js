/**
 * ATS Academic Tracking System — DOM & Interactive Flow Verification: Phases 4 to 7
 */

const fs = require('fs');
const path = require('path');

function runDomTests() {
  console.log('===============================================================');
  console.log('=== PHASES 4 TO 7 CLIENT DOM & INTERACTION VERIFICATION =======');
  console.log('===============================================================\n');

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

  // Phase 4: Student Dashboard
  const dashHtml = fs.readFileSync(path.join(__dirname, '../frontend/dashboard.html'), 'utf8');
  const dashJs = fs.readFileSync(path.join(__dirname, '../frontend/dashboard.js'), 'utf8');

  assert('P4.1 Exact Section Title: PAYMENT UPDATE & PAYMENT STATUS in dashboard.html',
    dashHtml.includes('PAYMENT UPDATE & PAYMENT STATUS'));
  assert('P4.2 Payment overview tiles (Due, Paid, Balance, Due Date) present in dashboard.html',
    dashHtml.includes('id="fee-summary-total-due"') &&
    dashHtml.includes('id="fee-summary-total-paid"') &&
    dashHtml.includes('id="fee-summary-total-balance"') &&
    dashHtml.includes('id="fee-summary-due-date"'));
  assert('P4.3 Transparent Risk Standing criteria modal present in dashboard.html',
    dashHtml.includes('id="risk-criteria-modal"') &&
    dashHtml.includes('Academic Risk Standing Criteria'));
  assert('P4.4 dashboard.js populates overview tiles and dynamic risk indicators',
    dashJs.includes("document.getElementById('fee-summary-total-due')") &&
    dashJs.includes("document.getElementById('risk-modal-att-val')"));

  // Phase 5: Faculty Mentee Console & Exam/Lab Entry
  const mentorHtml = fs.readFileSync(path.join(__dirname, '../frontend/mentor-dashboard.html'), 'utf8');
  const mentorJs = fs.readFileSync(path.join(__dirname, '../frontend/mentor-dashboard.js'), 'utf8');

  assert('P5.1 Mentee management table headers include CGPA, Attendance, Risk Standing, Pending Work',
    mentorHtml.includes('<th>CGPA</th>') &&
    mentorHtml.includes('<th>Attendance</th>') &&
    mentorHtml.includes('<th>Risk Standing</th>') &&
    mentorHtml.includes('<th>Pending Work</th>'));
  assert('P5.2 Exam & Lab Practical upload modal is present in mentor-dashboard.html',
    mentorHtml.includes('id="exam-lab-upload-modal"') &&
    mentorHtml.includes('id="exam-lab-upload-form"'));
  assert('P5.3 mentor-dashboard.js exposes openExamLabModal and handleAssessmentTypeChange globally',
    mentorJs.includes('window.openExamLabModal =') &&
    mentorJs.includes('window.handleAssessmentTypeChange ='));
  assert('P5.4 Form submission validates marks obtained <= max marks with feedback',
    mentorJs.includes('marksObtained > maxMarks'));

  // Phase 6: HOD Department Mini-Dashboards
  const hodJs = fs.readFileSync(path.join(__dirname, '../frontend/hod-dashboard.js'), 'utf8');

  assert('P6.1 hod-dashboard.js binds openFacultyMiniDashboard on department faculty cards',
    hodJs.includes('openFacultyMiniDashboard(${f.id})'));
  assert('P6.2 hod-dashboard.js binds openStudentMiniDashboard on student allocations',
    hodJs.includes('openStudentMiniDashboard(${s.student_id})'));

  // Phase 7: Admin Department Overview & Read-Only Governance Modal
  const adminHtml = fs.readFileSync(path.join(__dirname, '../frontend/admin-dashboard.html'), 'utf8');
  const adminJs = fs.readFileSync(path.join(__dirname, '../frontend/admin.js'), 'utf8');

  assert('P7.1 Read-Only Department Modal present in admin-dashboard.html',
    adminHtml.includes('id="admin-dept-modal"'));
  assert('P7.2 Administrative segregation banner present barring operational edits',
    adminHtml.includes('ADMINISTRATIVE READ-ONLY GOVERNANCE'));
  assert('P7.3 Department overview cards bind openAdminDeptModal click event',
    adminJs.includes('onclick="openAdminDeptModal(${d.id})"'));
  assert('P7.4 openAdminDeptModal and closeAdminDeptModal are globally available',
    adminJs.includes('window.openAdminDeptModal =') &&
    adminJs.includes('window.closeAdminDeptModal ='));

  console.log('\n===============================================================');
  console.log(`=== DOM FLOW RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runDomTests();
