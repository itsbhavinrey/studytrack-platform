/**
 * Project 6: the promise-based half of src/storage.js, used by the server.
 * Every test works in its own temporary directory, never on personal data.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const {
  CorruptDataError,
  StoreBusyError,
  IdempotencyKeyMismatchError,
  loadSessions,
  readSessionsAsync,
  writeSessionsAsync,
  createSessionStore,
} = require('../src/storage');

describe('src/storage.js promise API', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studytrack-store-test-'));
    file = path.join(dir, 'sessions.json');
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('readSessionsAsync returns a promise and [] for an absent file', async () => {
    const pending = readSessionsAsync(file);
    assert.ok(pending instanceof Promise);
    assert.deepStrictEqual(await pending, []);
  });

  test('readSessionsAsync rejects with CorruptDataError and leaves the file as it was', async () => {
    fs.writeFileSync(file, '{"broken": [');
    await assert.rejects(readSessionsAsync(file), CorruptDataError);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"broken": [');
  });

  test('writeSessionsAsync writes the P2 format and leaves no temporary file', async () => {
    await writeSessionsAsync(file, [{ id: 1, minutes: 5, note: 'a', timestamp: 't' }]);
    assert.deepStrictEqual(loadSessions(file), [{ id: 1, minutes: 5, note: 'a', timestamp: 't' }]);
    assert.deepStrictEqual(fs.readdirSync(dir), ['sessions.json']);
  });

  test('store.add resolves after the record is on disk, with P2 ids', async () => {
    const store = createSessionStore(file);
    const first = await store.add({ minutes: 30, note: 'one' });
    assert.strictEqual(first.created, true);
    assert.strictEqual(first.session.id, 1);
    // Read with the synchronous P2 reader: the CLI sees what the server wrote.
    assert.deepStrictEqual(loadSessions(file), [first.session]);
    const second = await store.add({ minutes: 15, note: 'two' });
    assert.strictEqual(second.session.id, 2);
    assert.strictEqual((await store.list()).length, 2);
  });

  test('an overlapping add is rejected with StoreBusyError and nothing is lost', async () => {
    const store = createSessionStore(file, { writeDelayMs: 50 });
    const results = await Promise.allSettled([
      store.add({ minutes: 10, note: 'first' }),
      store.add({ minutes: 20, note: 'second' }),
    ]);
    assert.strictEqual(results[0].status, 'fulfilled');
    assert.strictEqual(results[1].status, 'rejected');
    assert.ok(results[1].reason instanceof StoreBusyError);
    assert.deepStrictEqual((await store.list()).map((s) => s.note), ['first']);
    // The lock is released afterwards: a retry succeeds.
    const retry = await store.add({ minutes: 20, note: 'second' });
    assert.strictEqual(retry.session.id, 2);
  });

  test('ten concurrent adds: every success is stored, every failure is a StoreBusyError', async () => {
    const store = createSessionStore(file);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => store.add({ minutes: i + 1, note: `n${i}` })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const busy = results.filter((r) => r.status === 'rejected');
    assert.ok(busy.every((r) => r.reason instanceof StoreBusyError));
    assert.strictEqual(ok.length + busy.length, 10);
    assert.strictEqual((await store.list()).length, ok.length, 'no acknowledged write was lost');
  });

  test('the same requestId twice adds one record and returns it again', async () => {
    const store = createSessionStore(file);
    const a = await store.add({ minutes: 25, note: 'once' }, { requestId: 'k-1' });
    const b = await store.add({ minutes: 25, note: 'once' }, { requestId: 'k-1' });
    assert.strictEqual(a.created, true);
    assert.strictEqual(b.created, false);
    assert.deepStrictEqual(b.session, a.session);
    assert.strictEqual((await store.list()).length, 1);
  });

  test('the same requestId with different details is rejected and stores nothing', async () => {
    const store = createSessionStore(file);
    await store.add({ minutes: 25, note: 'once' }, { requestId: 'k-1' });
    // Trimming is part of the stored note, so whitespace alone is still a match.
    const same = await store.add({ minutes: 25, note: '  once ' }, { requestId: 'k-1' });
    assert.strictEqual(same.created, false);
    await assert.rejects(store.add({ minutes: 30, note: 'once' }, { requestId: 'k-1' }), IdempotencyKeyMismatchError);
    await assert.rejects(store.add({ minutes: 25, note: 'twice' }, { requestId: 'k-1' }), IdempotencyKeyMismatchError);
    assert.strictEqual((await store.list()).length, 1);
    assert.strictEqual(store.writing, false);
  });

  test('add on a corrupt file rejects and does not overwrite it', async () => {
    fs.writeFileSync(file, 'not json');
    const store = createSessionStore(file);
    await assert.rejects(store.add({ minutes: 5, note: 'x' }), CorruptDataError);
    assert.strictEqual(await fsp.readFile(file, 'utf8'), 'not json');
    assert.strictEqual(store.writing, false, 'the lock is released after a failure');
  });
});
