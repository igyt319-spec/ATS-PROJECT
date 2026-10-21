/**
 * ATS Academic Tracking System — Master Regression Test Runner
 * Executes all 10 unit, integration, and security regression test suites across the platform.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const net = require('net');

const testSuites = [
  { name: 'Phase 1: Mini-Dashboard Authentication & Navigation', script: 'test_phase1_mini_dashboard.js' },
  { name: 'Phase 2: Authentication & Strict RBAC', script: 'test_phase2_auth.js' },
  { name: 'Phase 3: Faculty Console & Mentee Isolation', script: 'test_phase3_faculty.js' },
  { name: 'Phase 4: Database Safety & Demo Accounts', script: 'test_phase4_demo_seed.js' },
  { name: 'Phase 5: Avatar Upload & Image Storage', script: 'test_phase5_upload.js' },
  { name: 'Phase 5 (Database): DB Configuration & Migration Safety', script: 'test_phase5_db_config.js' },
  { name: 'Phase 6: Simulated Payment Gateway Engine', script: 'test_phase6_payment.js' },
  { name: 'Phases 1-7: Comprehensive Multi-Role Regression Suite', script: 'test_phases1_to_7_comprehensive.js' },
  { name: 'Phases 8-12: Advanced AI Chatbot, MCDA Heuristics, Attendance Recovery, Portfolio & Notifications', script: 'test_phases8_to_12_comprehensive.js' },
  { name: 'Seven Master Features: Digital Twin, Career Readiness, Achievement Passport, College Twin, Mentor 2.0, Simulator, Audit Trail & OpenAPI', script: 'test_seven_features.js' },
  { name: 'ATS Impact Loop & Explainable Decision Trace Engine', script: 'test_impact_loop_and_decision_trace.js' },
  { name: 'Mentor API Repair & Cross-Mentor Data Isolation', script: 'test_mentor_api_repair.js' },
  { name: 'Role-Aware Sidebars & ChatGPT-Style Navigation', script: 'test_role_navigation_and_sidebar.js' },
  { name: 'Phase 1-10 Master Product: Advanced Modules, Admin Dashboards & Demo Payments', script: 'test_final_master_product.js' }
];

function checkPortListening(port = 5000) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(600);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.connect(port, '127.0.0.1');
  });
}

async function runAllSuites() {
  console.log('======================================================================');
  console.log('🚀 ATS MASTER REGRESSION TEST RUNNER — ALL PHASES & SEVEN FEATURES');
  console.log('======================================================================\n');

  let spawnedServer = null;

  try {
    const isRunning = await checkPortListening(5000);
    if (!isRunning) {
      console.log('⚡ Starting background ATS server for full integration test execution...');
      const serverPath = path.join(__dirname, '../backend/server.js');
      spawnedServer = spawn(process.execPath, [serverPath], {
        cwd: path.join(__dirname, '..'),
        stdio: 'ignore'
      });

      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 500));
        const ready = await checkPortListening(5000);
        if (ready) {
          console.log(`⚡ Background ATS server ready on port 5000 (${(i + 1) * 0.5}s).\n`);
          break;
        }
      }
    }

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
      console.log('🎉 ALL 10 MASTER REGRESSION SUITES PASSED CLEANLY! PLATFORM DEPLOYMENT READY.');
      process.exit(0);
    }

  } finally {
    if (spawnedServer) {
      try { spawnedServer.kill(); } catch (_) {}
    }
  }
}

runAllSuites().catch(err => {
  console.error('[Master Test Runner Fatal Error]', err);
  process.exit(1);
});
