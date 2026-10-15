/**
 * ATS Academic Tracking System — Master Regression Test Runner
 * Executes Phases 2 through 6 unit and regression test suites.
 */

const { execSync } = require('child_process');
const path = require('path');

const testSuites = [
  { name: 'Phase 1: Mini-Dashboard Authentication & Navigation', script: 'test_phase1_mini_dashboard.js' },
  { name: 'Phase 2: Authentication & Strict RBAC', script: 'test_phase2_auth.js' },
  { name: 'Phase 3: Faculty Console & Mentee Isolation', script: 'test_phase3_faculty.js' },
  { name: 'Phase 4: Database Safety & Demo Accounts', script: 'test_phase4_demo_seed.js' },
  { name: 'Phase 5: Avatar Upload & Image Storage', script: 'test_phase5_upload.js' },
  { name: 'Phase 5 (Database): DB Configuration & Migration Safety', script: 'test_phase5_db_config.js' },
  { name: 'Phase 6: Simulated Payment Gateway Engine', script: 'test_phase6_payment.js' },
  { name: 'Phases 1-7: Comprehensive Multi-Role Regression Suite', script: 'test_phases1_to_7_comprehensive.js' },
  { name: 'Phases 8-12: Advanced AI Chatbot, MCDA Heuristics, Attendance Recovery, Portfolio & Notifications', script: 'test_phases8_to_12_comprehensive.js' }
];

console.log('======================================================================');
console.log('🚀 ATS MASTER REGRESSION TEST RUNNER — ALL PHASES (2 TO 6)');
console.log('======================================================================\n');

let totalPassedSuites = 0;
let totalFailedSuites = 0;
const results = [];

const startTime = Date.now();

for (const suite of testSuites) {
  const scriptPath = path.join(__dirname, suite.script);
  console.log(`\n▶️ RUNNING: ${suite.name} (${suite.script})...`);
  try {
    const output = execSync(`node "${scriptPath}"`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    console.log(output.trim());
    totalPassedSuites++;
    results.push({ name: suite.name, status: 'PASSED' });
  } catch (err) {
    console.error(`❌ SUITE FAILED: ${suite.name}`);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    totalFailedSuites++;
    results.push({ name: suite.name, status: 'FAILED' });
  }
}

const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n======================================================================');
console.log('📊 MASTER REGRESSION SUMMARY');
console.log('======================================================================');
results.forEach(r => {
  const icon = r.status === 'PASSED' ? '✅' : '❌';
  console.log(`${icon} ${r.status}: ${r.name}`);
});
console.log(`\nTotal Suites: ${testSuites.length} | Passed: ${totalPassedSuites} | Failed: ${totalFailedSuites} | Duration: ${elapsedSec}s`);
console.log('======================================================================\n');

if (totalFailedSuites > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL REGRESSION SUITES PASSED CLEANLY! DEPLOYMENT READY.');
  process.exit(0);
}
