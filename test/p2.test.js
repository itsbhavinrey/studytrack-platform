/**
 * Project 2 Integration & Acceptance Tests (test/p2.test.js)
 *
 * Uses Node's built-in test runner (node:test and node:assert).
 * Verifies multi-process persistence, commands (add, summary, log),
 * absent file behavior, corrupt file preservation drill, and input validations.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLANNER_PATH = path.join(__dirname, '..', 'planner.js');

function runCommand(args, env = {}) {
  const cmd = `node "${PLANNER_PATH}" ${args}`;
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: err.status,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
    };
  }
}

describe('Project 2 Integration Tests', () => {
  let tempDir;
  let testDataFile;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studytrack-p2-test-'));
    testDataFile = path.join(tempDir, 'sessions.json');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('Three-run persistence test: accumulates minutes accurately across separate process runs', () => {
    // Run 1: Add first session (45 minutes)
    const run1 = runCommand(`add 45 "First session: JavaScript modules" --file "${testDataFile}"`);
    assert.strictEqual(run1.status, 0);
    assert(run1.stdout.includes('Added session #1: 45 minutes - "First session: JavaScript modules"'));
    assert(run1.stdout.includes('Total study time logged: 45 minutes (0.75 hours across 1 session)'));

    // Run 2: Add second session (75 minutes)
    const run2 = runCommand(`add 75 "Second session: Node fs persistence" --file "${testDataFile}"`);
    assert.strictEqual(run2.status, 0);
    assert(run2.stdout.includes('Added session #2: 75 minutes - "Second session: Node fs persistence"'));
    assert(run2.stdout.includes('Total study time logged: 120 minutes (2 hours across 2 sessions)'));

    // Run 3: Summary across the two previous runs (goal: 10 hours, weekly: 4 hours)
    const run3 = runCommand(`summary 10 4 --file "${testDataFile}"`);
    assert.strictEqual(run3.status, 0);
    assert(run3.stdout.includes('Goal hours: 10 hours'));
    assert(run3.stdout.includes('Weekly hours: 4 hours'));
    assert(run3.stdout.includes('Logged sessions: 2 sessions'));
    assert(run3.stdout.includes('Completed time: 120 minutes (2 hours)'));
    assert(run3.stdout.includes('Remaining hours: 8 hours'));
    assert(run3.stdout.includes('Estimated weeks remaining: 2 weeks'));
    assert(run3.stdout.includes('Final-week hours: 4 hours'));
  });

  test('Stretch Goal: log command lists recent sessions', () => {
    runCommand(`add 30 "Session A" --file "${testDataFile}"`);
    runCommand(`add 60 "Session B" --file "${testDataFile}"`);

    const res = runCommand(`log --file "${testDataFile}"`);
    assert.strictEqual(res.status, 0);
    assert(res.stdout.includes('Recent study sessions (showing latest 2 of 2):'));
    assert(res.stdout.includes('30 min - "Session A"'));
    assert(res.stdout.includes('60 min - "Session B"'));
  });

  test('Absent data file handled as an empty log', () => {
    assert.strictEqual(fs.existsSync(testDataFile), false);

    const res = runCommand(`summary 30 12 --file "${testDataFile}"`);
    assert.strictEqual(res.status, 0);
    assert(res.stdout.includes('Logged sessions: 0 sessions'));
    assert(res.stdout.includes('Completed time: 0 minutes (0 hours)'));
    assert(res.stdout.includes('Remaining hours: 30 hours'));
    assert(res.stdout.includes('Estimated weeks remaining: 3 weeks'));
    assert(res.stdout.includes('Final-week hours: 6 hours'));

    const logRes = runCommand(`log --file "${testDataFile}"`);
    assert.strictEqual(logRes.status, 0);
    assert(logRes.stdout.includes('No study sessions logged yet.'));
  });

  test('Break it on purpose: corrupt file failure, preservation, and restore drill', () => {
    // 1. Create a known good file with 2 sessions
    runCommand(`add 40 "Good session 1" --file "${testDataFile}"`);
    runCommand(`add 50 "Good session 2" --file "${testDataFile}"`);

    // Backup the known good copy
    const backupData = fs.readFileSync(testDataFile, 'utf8');

    // 2. Corrupt a disposable copy
    const badJson = '{"corrupted": true, [syntax error!';
    fs.writeFileSync(testDataFile, badJson, 'utf8');

    // 3. Observe parse failure and visible error without overwriting
    const failRun = runCommand(`summary 30 12 --file "${testDataFile}"`);
    assert.strictEqual(failRun.status, 1);
    assert(failRun.stderr.includes('is corrupted or contains invalid JSON'));
    assert(failRun.stderr.includes('The corrupted file was preserved and not overwritten.'));

    // Verify bad file was NOT overwritten
    const preservedContent = fs.readFileSync(testDataFile, 'utf8');
    assert.strictEqual(preservedContent, badJson);

    // 4. Restore known good copy
    fs.writeFileSync(testDataFile, backupData, 'utf8');

    // 5. Verify original session count
    const restoreRun = runCommand(`summary 30 12 --file "${testDataFile}"`);
    assert.strictEqual(restoreRun.status, 0);
    assert(restoreRun.stdout.includes('Logged sessions: 2 sessions'));
    assert(restoreRun.stdout.includes('Completed time: 90 minutes (1.5 hours)'));
  });

  test('Completed goal summary displays completed status', () => {
    runCommand(`add 300 "Part 1" --file "${testDataFile}"`);
    runCommand(`add 300 "Part 2" --file "${testDataFile}"`);

    const res = runCommand(`summary 10 5 --file "${testDataFile}"`);
    assert.strictEqual(res.status, 0);
    assert(res.stdout.includes('Completed time: 600 minutes (10 hours)'));
    assert(res.stdout.includes('Remaining hours: 0 hours'));
    assert(res.stdout.includes('Status: Goal completed! 0 weeks remaining.'));
  });

  describe('Input validation failures', () => {
    test('add rejects missing arguments', () => {
      const res = runCommand('add');
      assert.strictEqual(res.status, 1);
      assert(res.stderr.includes('requires <minutes> and <note>'));
    });

    test('add rejects zero or negative minutes', () => {
      const zero = runCommand(`add 0 "Zero minutes" --file "${testDataFile}"`);
      assert.strictEqual(zero.status, 1);
      assert(zero.stderr.includes('Minutes must be a positive whole number'));

      const neg = runCommand(`add -15 "Negative" --file "${testDataFile}"`);
      assert.strictEqual(neg.status, 1);
      assert(neg.stderr.includes('Minutes must be a positive whole number'));
    });

    test('add rejects fractional or non-numeric minutes', () => {
      const frac = runCommand(`add 25.5 "Fractional" --file "${testDataFile}"`);
      assert.strictEqual(frac.status, 1);
      assert(frac.stderr.includes('Minutes must be a positive whole number'));

      const str = runCommand(`add fortyfive "Text" --file "${testDataFile}"`);
      assert.strictEqual(str.status, 1);
      assert(str.stderr.includes('Minutes must be a positive whole number'));
    });

    test('add rejects empty note', () => {
      const res = runCommand(`add 30 "" --file "${testDataFile}"`);
      assert.strictEqual(res.status, 1);
      assert(res.stderr.includes('Note cannot be empty'));
    });

    test('summary rejects missing arguments', () => {
      const res = runCommand('summary 30');
      assert.strictEqual(res.status, 1);
      assert(res.stderr.includes('requires <goal-hours> and <weekly-hours>'));
    });

    test('summary rejects zero, negative, or invalid hours', () => {
      const zeroGoal = runCommand(`summary 0 10 --file "${testDataFile}"`);
      assert.strictEqual(zeroGoal.status, 1);
      assert(zeroGoal.stderr.includes('Goal hours must be a positive whole number'));

      const zeroWeekly = runCommand(`summary 10 0 --file "${testDataFile}"`);
      assert.strictEqual(zeroWeekly.status, 1);
      assert(zeroWeekly.stderr.includes('Weekly hours must be a positive whole number'));
    });
  });
});
