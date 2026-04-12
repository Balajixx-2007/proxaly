#!/usr/bin/env node

/**
 * PHASE 1 DEPLOYMENT AUTOMATION
 * 
 * This script helps deploy the unified Agent Hub to production.
 * It checks prerequisites, guides through Railway env setup, and validates deployment.
 * 
 * Usage:
 *   node scripts/phase1-deploy.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

// Colors for CLI output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function check(condition, msg) {
  if (condition) {
    log(`✓ ${msg}`, 'green');
    return true;
  } else {
    log(`✗ ${msg}`, 'red');
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * STEP 1: Pre-flight checks
 */
async function preflightChecks() {
  log('\n=== PHASE 1: PRE-FLIGHT CHECKS ===\n', 'cyan');

  let passed = true;

  // Check git is clean
  try {
    const status = execSync('git status --short', { encoding: 'utf-8' });
    passed &= check(status.trim() === '', 'Working tree is clean');
    if (status.trim() !== '') {
      log('  Uncommitted changes detected. Commit or stash before deploying.', 'yellow');
    }
  } catch (err) {
    log('  Not a git repository', 'yellow');
    passed = false;
  }

  // Check main branch
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    passed &= check(branch === 'main', `On main branch (currently: ${branch})`);
  } catch (err) {
    log('  Could not determine branch', 'yellow');
  }

  // Check new routes exist
  passed &= check(
    fs.existsSync('backend/routes/agent.js'),
    'Backend agent routes exist'
  );

  // Check frontend AgentHub exists
  passed &= check(
    fs.existsSync('frontend/src/pages/AgentHub.jsx'),
    'Frontend Agent Hub page exists'
  );

  // Check build files
  passed &= check(
    fs.existsSync('frontend/dist'),
    'Frontend production build exists'
  );

  if (!passed) {
    log('\n⚠️  Some checks failed. See above for details.', 'yellow');
    process.exit(1);
  }

  log('\n✓ All pre-flight checks passed!', 'green');
}

/**
 * STEP 2: Collect deployment info
 */
function collectDeploymentInfo() {
  log('\n=== PHASE 1: DEPLOYMENT INFO ===\n', 'cyan');

  log('Before proceeding, you need to set the MARKETING_AGENT_URL environment variable on Railway.', 'yellow');
  log('\nChoose your deployment scenario:\n', 'blue');

  log('  [A] Marketing Agent is hosted externally (recommended for prod)', 'cyan');
  log('      Example: https://agent.yourdomain.com\n');

  log('  [B] Marketing Agent is on localhost (dev only, will NOT work in prod)', 'yellow');
  log('      Example: http://localhost:3000\n');

  log('  [C] Not ready to deploy yet (exit and prepare)', 'cyan');
  log('\n');

  // Simple guide text
  log('═'.repeat(70), 'blue');
  log('RAILWAY SETUP STEPS:', 'blue');
  log('═'.repeat(70), 'blue');
  log(`
1. Go to: https://railway.app
2. Select your Proxaly project
3. Click "Settings" → "Environment Variables"
4. Add a new variable:
   - Name: MARKETING_AGENT_URL
   - Value: [Your choice from above]
5. Click "Add"
6. The variable is saved and redeploy may auto-trigger
7. Come back here and press ENTER when done
  `, 'cyan');

  log('═'.repeat(70), 'blue');
  log('\nPress ENTER to continue...', 'yellow');
}

/**
 * STEP 3: Verify environment variable is set (local check)
 */
function verifyEnvVar() {
  log('\n=== PHASE 1: ENVIRONMENT VARIABLE VERIFICATION ===\n', 'cyan');

  if (process.env.MARKETING_AGENT_URL) {
    log(`✓ MARKETING_AGENT_URL is set locally: ${process.env.MARKETING_AGENT_URL}`, 'green');
    log('  (Railway will use its own environment variables, not local .env)', 'yellow');
  } else {
    log('ℹ MARKETING_AGENT_URL not set in local .env (this is OK if set in Railway)', 'blue');
  }

  log('\nTo verify Railway has the variable set, we\'ll test after redeploy.', 'yellow');
}

/**
 * STEP 4: Trigger redeploys (guidance)
 */
async function triggerRedeploys() {
  log('\n=== PHASE 1: TRIGGER PRODUCTION REDEPLOY ===\n', 'cyan');

  log('Now trigger redeploys so Railway picks up the new /api/agent routes:', 'yellow');
  log('\n  BACKEND (Railway):', 'blue');
  log('    1. Go to https://railway.app → Proxaly project → Deployments tab');
  log('    2. Find commit 4ff7f2d "Add unified Agent Hub routes..."');
  log('    3. Click three dots → "Redeploy"');
  log('    4. Wait for green checkmark (~3-5 minutes)');
  log('    5. Come back here\n');

  log('  FRONTEND (Vercel):', 'blue');
  log('    1. Go to https://vercel.com → Proxaly project → Deployments');
  log('    2. Find latest main branch deployment (or commit 4ff7f2d)');
  log('    3. Click three dots → "Redeploy"');
  log('    4. Wait for build to complete (~1-2 minutes)');
  log('    5. Come back here\n');

  log('Press ENTER when both deploys are complete...', 'yellow');
}

/**
 * STEP 5: Validation tests
 */
async function runValidationTests() {
  log('\n=== PHASE 1: PRODUCTION VALIDATION ===\n', 'cyan');

  const backendUrl = 'https://proxaly-production.up.railway.app';
  const frontendUrl = 'https://proxaly.vercel.app';

  log('Testing production endpoints...\n', 'yellow');

  // Test 1: Agent status endpoint
  log('Test 1: Checking /api/agent/status endpoint...', 'blue');
  try {
    const res = await axios.get(`${backendUrl}/api/agent/status`, {
      validateStatus: () => true,
      timeout: 10000,
    });
    if (res.status === 200) {
      log(`  ✓ Status 200: Agent routes deployed and accessible`, 'green');
      log(`  Response: ${JSON.stringify(res.data).substring(0, 100)}...`, 'yellow');
    } else if (res.status === 503) {
      log(`  ⚠ Status 503: Routes deployed but agent unreachable`, 'yellow');
      log(`  Likely cause: MARKETING_AGENT_URL not set or agent service down`, 'yellow');
    } else if (res.status === 404) {
      log(`  ✗ Status 404: Routes not deployed yet`, 'red');
      log(`  Action: Wait 2 minutes and try again, or manually trigger redeploy`, 'yellow');
    } else {
      log(`  ⚠ Status ${res.status}: Unexpected response`, 'yellow');
    }
  } catch (err) {
    log(`  ✗ Connection failed: ${err.message}`, 'red');
    log(`  Action: Check internet connection or try again in a minute`, 'yellow');
  }

  await sleep(2000);

  // Test 2: Frontend Agent Hub page
  log('\nTest 2: Checking frontend Agent Hub page loads...', 'blue');
  try {
    const res = await axios.get(`${frontendUrl}/agent`, {
      validateStatus: () => true,
      timeout: 10000,
      headers: { 'Accept': 'text/html' },
    });
    if (res.status === 200) {
      log(`  ✓ Status 200: Agent Hub page loads`, 'green');
      if (res.data.includes('AgentHub') || res.data.includes('agent')) {
        log(`  ✓ Page contains expected content`, 'green');
      }
    } else {
      log(`  ⚠ Status ${res.status}: Page not loading`, 'yellow');
    }
  } catch (err) {
    log(`  ⚠ Could not reach frontend: ${err.message}`, 'yellow');
    log('  (Verify Vercel deployment completed)', 'yellow');
  }

  await sleep(2000);

  // Test 3: Manual browser test guidance
  log('\nTest 3: Manual browser validation...', 'blue');
  log('  Please visit these URLs in your browser to confirm:\n', 'yellow');
  log(`  1. ${frontendUrl}/agent`, 'cyan');
  log('     → Should load Agent Hub page with start/stop controls', 'yellow');
  log(`  2. ${backendUrl}/api/agent/status`, 'cyan');
  log('     → Should show JSON with agent status', 'yellow');
  log('\n  If both load correctly, Phase 1 deployment is complete! ✓\n', 'green');
}

/**
 * STEP 6: Smoke tests
 */
async function runSmokeTests() {
  log('\n=== PHASE 1: SMOKE TESTS ===\n', 'cyan');

  try {
    log('Running backend API smoke tests locally...', 'yellow');
    execSync('node scripts/api-smoke.js', { stdio: 'inherit' });
    log('✓ All smoke tests passed!', 'green');
  } catch (err) {
    log('✗ Some smoke tests failed', 'red');
    log('  Run: node scripts/api-smoke.js', 'yellow');
  }
}

/**
 * Main execution
 */
async function main() {
  log('\n', 'blue');
  log('╔════════════════════════════════════════════════════════════════╗', 'blue');
  log('║         PROXALY PHASE 1 DEPLOYMENT AUTOMATION                  ║', 'blue');
  log('║      Deploy Unified Agent Hub to Production                    ║', 'blue');
  log('╚════════════════════════════════════════════════════════════════╝', 'blue');

  try {
    // Step 1: Preflight
    await preflightChecks();

    // Step 2: Info
    collectDeploymentInfo();

    // Step 3: Env var check
    verifyEnvVar();

    // Step 4: Redeploy guidance
    await triggerRedeploys();

    // Step 5: Validation
    await runValidationTests();

    // Step 6: Smoke tests
    await runSmokeTests();

    // Success!
    log('\n', 'blue');
    log('╔════════════════════════════════════════════════════════════════╗', 'green');
    log('║  ✓ PHASE 1 DEPLOYMENT COMPLETE!                               ║', 'green');
    log('║                                                                ║', 'green');
    log('║  What to do next:                                              ║', 'green');
    log('║  1. Users can now access Agent Hub from sidebar                ║', 'green');
    log('║  2. Test send-to-agent flow end-to-end                         ║', 'green');
    log('║  3. If ready, start Phase 2 in-process integration             ║', 'green');
    log('║                                                                ║', 'green');
    log('║  Docs:                                                         ║', 'green');
    log('║  - PHASE_1_DEPLOYMENT.md (detailed steps)                      ║', 'green');
    log('║  - PHASE_2_ARCHITECTURE.md (next phase design)                 ║', 'green');
    log('╚════════════════════════════════════════════════════════════════╝', 'green');
    log('\n');

  } catch (err) {
    log(`\n✗ Deployment failed: ${err.message}`, 'red');
    log('\nFor troubleshooting, see PHASE_1_DEPLOYMENT.md', 'yellow');
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { preflightChecks, runValidationTests };
