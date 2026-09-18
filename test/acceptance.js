/**
 * Acceptance Test Suite for Study-Time Calculator (planner.js)
 *
 * Verifies all 4 valid cases, 8 invalid cases, and stretch goals.
 */

const { execSync } = require('child_process');
const path = require('path');

const PLANNER_PATH = path.join(__dirname, '..', 'planner.js');

const VALID_CASES = [
  {
    args: '30 12',
    expectedWeeks: '3 weeks',
    expectedFinalHours: '6 hours',
  },
  {
    args: '24 12',
    expectedWeeks: '2 weeks',
    expectedFinalHours: '12 hours',
  },
  {
    args: '5 12',
    expectedWeeks: '1 week',
    expectedFinalHours: '5 hours',
  },
  {
    args: '1 1',
    expectedWeeks: '1 week',
    expectedFinalHours: '1 hour',
  },
];

const INVALID_CASES = [
  '0 12',
  '30 0',
  '-5 12',
  '30 2.5',
  '30 twelve',
  '30 12hours',
  '30',
  '30 12 4',
];

let passed = 0;
let total = 0;

console.log('Running Studytrack Acceptance Test Suite...\n');

// 1. Test Valid Cases
console.log('--- Testing Valid Cases ---');
for (const tc of VALID_CASES) {
  total++;
  try {
    const cmd = `node "${PLANNER_PATH}" ${tc.args}`;
    const output = execSync(cmd, { encoding: 'utf8' });

    const hasWeeks = output.includes(tc.expectedWeeks);
    const hasFinalHours = output.includes(tc.expectedFinalHours);

    if (hasWeeks && hasFinalHours) {
      console.log(`PASS: node planner.js ${tc.args}`);
      passed++;
    } else {
      console.error(`FAIL: node planner.js ${tc.args}`);
      console.error(`  Expected weeks: ${tc.expectedWeeks}, final hours: ${tc.expectedFinalHours}`);
      console.error(`  Got:\n${output}`);
    }
  } catch (err) {
    console.error(`FAIL: node planner.js ${tc.args} threw unexpected error:`, err.message);
  }
}

// 2. Test Invalid Cases
console.log('\n--- Testing Invalid Cases (Rejection Expected) ---');
for (const tc of INVALID_CASES) {
  total++;
  try {
    const cmd = `node "${PLANNER_PATH}" ${tc}`;
    execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.error(`FAIL: node planner.js ${tc} should have exited with code 1, but exited with 0.`);
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stdout = err.stdout ? err.stdout.toString() : '';
    const output = stderr + stdout;
    const hasUsage = output.includes('Usage: node planner.js');
    const status = err.status;

    if (status === 1 && hasUsage) {
      console.log(`PASS (Rejected correctly): node planner.js ${tc}`);
      passed++;
    } else {
      console.error(`FAIL: node planner.js ${tc}`);
      console.error(`  Status: ${status} (expected 1), Has Usage: ${hasUsage}`);
      console.error(`  Output:\n${output}`);
    }
  }
}

// 3. Test Stretch Goal: --help
console.log('\n--- Testing Stretch Goal: --help ---');
total++;
try {
  const output = execSync(`node "${PLANNER_PATH}" --help`, { encoding: 'utf8' });
  if (output.includes('Usage: node planner.js')) {
    console.log('PASS: node planner.js --help works as expected');
    passed++;
  } else {
    console.error('FAIL: --help did not display usage');
  }
} catch (err) {
  console.error('FAIL: --help exited with error:', err.message);
}

console.log(`\n================================`);
console.log(`Result: ${passed}/${total} tests passed.`);
console.log(`================================`);

if (passed !== total) {
  process.exit(1);
}
