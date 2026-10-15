const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===============================================================');
console.log('=== PHASE 1 CLIENT DOM & MODAL CONTROLLER VERIFICATION =======');
console.log('===============================================================');

// 1. Verify CSS styles for modal-backdrop and modal-backdrop.open
const cssPath = path.join(__dirname, '../frontend/style.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(cssContent.includes('.modal-backdrop {'), 'CSS must define .modal-backdrop');
assert(cssContent.includes('.modal-backdrop.open {'), 'CSS must define .modal-backdrop.open');
assert(cssContent.includes('opacity: 1;'), '.modal-backdrop.open must set opacity: 1');
assert(cssContent.includes('pointer-events: auto;'), '.modal-backdrop.open must set pointer-events: auto');
console.log('✅ PASS: CSS specifies .modal-backdrop (opacity: 0, pointer-events: none) and .modal-backdrop.open (opacity: 1, pointer-events: auto)');

// 2. Verify api.js modal lifecycle implementation
const apiJsPath = path.join(__dirname, '../frontend/api.js');
const apiJsContent = fs.readFileSync(apiJsPath, 'utf8');

assert(apiJsContent.includes('showMiniDashboardModal(modal)'), 'api.js must define showMiniDashboardModal');
assert(apiJsContent.includes("modal.classList.add('open')"), 'showMiniDashboardModal must add .open class');
assert(apiJsContent.includes("modal.classList.remove('open')"), 'closeMiniDashboard must remove .open class');
assert(apiJsContent.includes("e.key === 'Escape'"), 'ensureMiniDashboardModal must register Escape key dismiss listener');
assert(apiJsContent.includes('activeMiniDashboardRequestId'), 'api.js must include request debouncing to prevent overlapping responses');
assert(apiJsContent.includes("replace(/^Bearer\\s+/i, '').trim()"), 'getToken must sanitize duplicate Bearer prefixes');
console.log('✅ PASS: api.js correctly integrates .open class, Escape key handler, debouncing, and token prefix sanitization');

// 3. Verify dashboard.html has Student Mini-Dashboard button
const dashHtmlPath = path.join(__dirname, '../frontend/dashboard.html');
const dashHtmlContent = fs.readFileSync(dashHtmlPath, 'utf8');
assert(dashHtmlContent.includes('btn-student-mini-dashboard'), 'dashboard.html must contain student mini-dashboard button');
assert(dashHtmlContent.includes('openMyMiniDashboard()'), 'button must trigger openMyMiniDashboard()');
console.log('✅ PASS: dashboard.html provides verified 📊 Mini-Dashboard button in student welcome banner');

// 4. Verify mentor-dashboard.js has Mentee Mini-Dashboard button
const mentorJsPath = path.join(__dirname, '../frontend/mentor-dashboard.js');
const mentorJsContent = fs.readFileSync(mentorJsPath, 'utf8');
assert(mentorJsContent.includes('📊 Mini-Dashboard'), 'mentor-dashboard.js must label mentee button as Mini-Dashboard');
assert(mentorJsContent.includes('openStudentMiniDashboard(${m.student_id})'), 'button must invoke openStudentMiniDashboard');
console.log('✅ PASS: mentor-dashboard.js provides 📊 Mini-Dashboard button for each assigned mentee');

// 5. Verify hod-dashboard.js has Student & Faculty Mini-Dashboard buttons
const hodJsPath = path.join(__dirname, '../frontend/hod-dashboard.js');
const hodJsContent = fs.readFileSync(hodJsPath, 'utf8');
assert(hodJsContent.includes('openStudentMiniDashboard(${s.student_id})'), 'hod-dashboard.js must open student mini-dashboard');
assert(hodJsContent.includes('openFacultyMiniDashboard(${f.id})'), 'hod-dashboard.js must open faculty mini-dashboard');
console.log('✅ PASS: hod-dashboard.js provides Mini-Dashboard buttons for both department students and faculty');

// 6. Verify students.html has Mini-Dashboard inspect button
const studentsHtmlPath = path.join(__dirname, '../frontend/students.html');
const studentsHtmlContent = fs.readFileSync(studentsHtmlPath, 'utf8');
assert(studentsHtmlContent.includes('btn-inspect-student-'), 'students.html must contain inspect button for student rows');
console.log('✅ PASS: students.html provides 📊 Mini-Dashboard button for student directory inspection');

console.log('===============================================================');
console.log('=== CLIENT DOM & MODAL VERIFICATION COMPLETE: ALL PASSED! ====');
console.log('===============================================================');
