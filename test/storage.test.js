/**
 * Unit Tests for Storage and Persistence (test/storage.test.js)
 *
 * Uses Node's built-in test runner (node:test and node:assert).
 * Verifies absent file handling, session creation, corrupt JSON detection,
 * and file preservation on error.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  CorruptDataError,
  loadSessions,
  saveSessions,
  addSession,
} = require('../src/storage');

describe('src/storage.js', () => {
  let tempDir;
  let testFilePath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studytrack-storage-test-'));
    testFilePath = path.join(tempDir, 'sessions.json');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadSessions()', () => {
    test('absent file returns empty array [] without error', () => {
      assert.strictEqual(fs.existsSync(testFilePath), false);
      const sessions = loadSessions(testFilePath);
      assert.deepStrictEqual(sessions, []);
    });

    test('valid file returns parsed array of sessions', () => {
      const mockSessions = [
        { id: 1, minutes: 45, note: 'Intro to modules', timestamp: '2026-09-18T20:00:00.000Z' },
      ];
      fs.writeFileSync(testFilePath, JSON.stringify(mockSessions), 'utf8');

      const loaded = loadSessions(testFilePath);
      assert.deepStrictEqual(loaded, mockSessions);
    });

    test('invalid JSON throws CorruptDataError and preserves the bad file intact', () => {
      const badContent = '{"corrupted": true, broken syntax [}';
      fs.writeFileSync(testFilePath, badContent, 'utf8');

      assert.throws(
        () => loadSessions(testFilePath),
        (err) => {
          assert(err instanceof CorruptDataError);
          assert.strictEqual(err.filePath, testFilePath);
          return true;
        }
      );

      // Verify file was NOT overwritten or wiped
      const contentAfterError = fs.readFileSync(testFilePath, 'utf8');
      assert.strictEqual(contentAfterError, badContent);
    });

    test('non-array JSON root throws CorruptDataError', () => {
      fs.writeFileSync(testFilePath, JSON.stringify({ notAnArray: true }), 'utf8');

      assert.throws(
        () => loadSessions(testFilePath),
        (err) => {
          assert(err instanceof CorruptDataError);
          assert(err.message.includes('Data root must be an array'));
          return true;
        }
      );
    });
  });

  describe('saveSessions()', () => {
    test('creates file and directories, formatting with indentation', () => {
      const deepPath = path.join(tempDir, 'nested', 'dir', 'data.json');
      const sessions = [{ id: 1, minutes: 30, note: 'Test note', timestamp: '2026-09-18T00:00:00.000Z' }];

      saveSessions(deepPath, sessions);

      assert.strictEqual(fs.existsSync(deepPath), true);
      const fileContent = fs.readFileSync(deepPath, 'utf8');
      assert(fileContent.includes('\n  ')); // Formatted with 2-space indentation
      assert.deepStrictEqual(JSON.parse(fileContent), sessions);
    });

    test('rejects non-array sessions input', () => {
      assert.throws(() => saveSessions(testFilePath, 'invalid'), TypeError);
    });
  });

  describe('addSession()', () => {
    test('creates file and adds first session with id 1', () => {
      const session = addSession(testFilePath, { minutes: 45, note: 'First study session' });

      assert.strictEqual(session.id, 1);
      assert.strictEqual(session.minutes, 45);
      assert.strictEqual(session.note, 'First study session');
      assert(typeof session.timestamp === 'string');

      const saved = loadSessions(testFilePath);
      assert.strictEqual(saved.length, 1);
      assert.deepStrictEqual(saved[0], session);
    });

    test('increments sequential IDs and appends without data loss', () => {
      const s1 = addSession(testFilePath, { minutes: 30, note: 'Session 1' });
      const s2 = addSession(testFilePath, { minutes: 60, note: 'Session 2' });
      const s3 = addSession(testFilePath, { minutes: 90, note: 'Session 3' });

      assert.strictEqual(s1.id, 1);
      assert.strictEqual(s2.id, 2);
      assert.strictEqual(s3.id, 3);

      const saved = loadSessions(testFilePath);
      assert.strictEqual(saved.length, 3);
      assert.strictEqual(saved[0].minutes, 30);
      assert.strictEqual(saved[1].minutes, 60);
      assert.strictEqual(saved[2].minutes, 90);
    });

    test('refuses to add to a corrupted file and leaves file untouched', () => {
      const badContent = 'corrupt content';
      fs.writeFileSync(testFilePath, badContent, 'utf8');

      assert.throws(() => {
        addSession(testFilePath, { minutes: 30, note: 'Attempting to add' });
      }, CorruptDataError);

      assert.strictEqual(fs.readFileSync(testFilePath, 'utf8'), badContent);
    });
  });
});
