/**
 * Project 6: the HTTP contract, tested against a real server.
 *
 * Each test starts server/app.mjs on a free port (port 0) with its own
 * temporary data file, talks to it with fetch() or node:http, and stops it.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

let startApp;
before(async () => {
  ({ startApp } = await import('../server/app.mjs'));
});

let tmpRoot;
before(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'studytrack-api-test-'));
});
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

let counter = 0;
function freshFile() {
  counter += 1;
  return path.join(tmpRoot, `sessions-${counter}.json`);
}

/** Starts a server for one test and always stops it. */
async function withServer(options, fn) {
  const app = await startApp({ port: 0, log: false, dataFile: freshFile(), ...options });
  try {
    await fn(app);
  } finally {
    await app.close();
  }
}

function postJson(url, body, headers = {}) {
  return fetch(`${url}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** A raw request, for bodies fetch() will not send (chunked, bad bytes). */
function rawRequest(url, { method = 'POST', path: p = '/api/sessions', headers = {}, chunks = [] }) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${url}${p}`, { method, headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    for (const c of chunks) req.write(c);
    req.end();
  });
}

async function expectError(res, status, code) {
  assert.strictEqual(res.status, status);
  assert.strictEqual(res.headers.get('content-type'), 'application/json; charset=utf-8');
  const body = await res.json();
  assert.deepStrictEqual(Object.keys(body), ['error']);
  assert.strictEqual(body.error.code, code);
  assert.strictEqual(typeof body.error.message, 'string');
  assert.strictEqual(typeof body.error.retryable, 'boolean');
  return body.error;
}

describe('GET /health', () => {
  test('200 with status and storage ok', () =>
    withServer({}, async ({ url }) => {
      const res = await fetch(`${url}/health`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'application/json; charset=utf-8');
      const body = await res.json();
      assert.strictEqual(body.status, 'ok');
      assert.strictEqual(body.storage, 'ok');
      assert.strictEqual(body.sessions, 0);
      assert.strictEqual(typeof body.uptimeSeconds, 'number');
    }));

  test('503 when the data file is corrupt', () =>
    withServer({}, async ({ url, store }) => {
      fs.writeFileSync(store.file, '{oops');
      const res = await fetch(`${url}/health`);
      assert.strictEqual(res.status, 503);
      assert.deepStrictEqual({ ...(await res.json()), uptimeSeconds: 0 }, { status: 'error', storage: 'corrupt', uptimeSeconds: 0 });
    }));

  test('405 for POST, with Allow', () =>
    withServer({}, async ({ url }) => {
      const res = await fetch(`${url}/health`, { method: 'POST' });
      await expectError(res, 405, 'method_not_allowed');
      assert.strictEqual(res.headers.get('allow'), 'GET, HEAD');
    }));
});

describe('GET /api/sessions', () => {
  test('empty log: 200 with an empty list', () =>
    withServer({}, async ({ url }) => {
      const res = await fetch(`${url}/api/sessions`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');
      assert.deepStrictEqual(await res.json(), { sessions: [], count: 0, totalMinutes: 0 });
    }));

  test('lists records written by the P2 CLI format, without internal fields', () =>
    withServer({}, async ({ url, store }) => {
      fs.writeFileSync(
        store.file,
        JSON.stringify([
          { id: 1, minutes: 45, note: 'from the CLI', timestamp: '2026-10-01T10:00:00.000Z' },
          { id: 2, minutes: 15, note: 'from the API', timestamp: '2026-10-01T11:00:00.000Z', requestId: 'abcdefgh-1' },
        ]),
      );
      const body = await (await fetch(`${url}/api/sessions`)).json();
      assert.strictEqual(body.count, 2);
      assert.strictEqual(body.totalMinutes, 60);
      assert.deepStrictEqual(Object.keys(body.sessions[1]), ['id', 'minutes', 'note', 'timestamp']);
    }));

  test('500 storage_corrupt for a corrupt file, which is left untouched', () =>
    withServer({}, async ({ url, store }) => {
      fs.writeFileSync(store.file, 'not json');
      const error = await expectError(await fetch(`${url}/api/sessions`), 500, 'storage_corrupt');
      assert.doesNotMatch(error.message, /\//, 'no server path in the message');
      assert.strictEqual(fs.readFileSync(store.file, 'utf8'), 'not json');
    }));
});

describe('POST /api/sessions', () => {
  test('201 with the record and Location; the record is on disk when the response arrives', () =>
    withServer({}, async ({ url, store }) => {
      const res = await postJson(url, { minutes: 45, note: '  Node http  ' });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.headers.get('location'), '/api/sessions/1');
      const { session } = await res.json();
      assert.deepStrictEqual({ ...session, timestamp: 'T' }, { id: 1, minutes: 45, note: 'Node http', timestamp: 'T' });
      assert.match(session.timestamp, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
      const onDisk = JSON.parse(fs.readFileSync(store.file, 'utf8'));
      assert.deepStrictEqual(onDisk, [session]);

      const one = await fetch(`${url}/api/sessions/1`);
      assert.strictEqual(one.status, 200);
      assert.deepStrictEqual(await one.json(), { session });
    }));

  test('400 invalid_json for malformed JSON, nothing stored', () =>
    withServer({}, async ({ url, store }) => {
      const error = await expectError(await postJson(url, '{"minutes": 45,'), 400, 'invalid_json');
      assert.strictEqual(error.retryable, false);
      assert.strictEqual(fs.existsSync(store.file), false);
    }));

  test('400 invalid_json for an empty body and for bytes that are not UTF-8', () =>
    withServer({}, async ({ url }) => {
      await expectError(await postJson(url, ''), 400, 'invalid_json');
      const res = await rawRequest(url, {
        headers: { 'Content-Type': 'application/json' },
        chunks: [Buffer.from([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d])],
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'invalid_json');
    }));

  test('400 invalid_body when the JSON is not an object', () =>
    withServer({}, async ({ url }) => {
      for (const body of ['[]', 'null', '42', '"text"']) {
        await expectError(await postJson(url, body), 400, 'invalid_body');
      }
    }));

  test('422 validation_failed with per-field details', () =>
    withServer({}, async ({ url, store }) => {
      const error = await expectError(await postJson(url, { minutes: '45', note: '', id: 9 }), 422, 'validation_failed');
      assert.deepStrictEqual(Object.keys(error.details).sort(), ['body', 'minutes', 'note']);
      assert.match(error.details.body, /Unknown field\(s\): id/);
      await expectError(await postJson(url, { minutes: 1441, note: 'x' }), 422, 'validation_failed');
      await expectError(await postJson(url, { minutes: 30, note: 'x'.repeat(201) }), 422, 'validation_failed');
      assert.strictEqual(fs.existsSync(store.file), false);
    }));

  test('415 unsupported_media_type unless Content-Type is application/json', () =>
    withServer({}, async ({ url }) => {
      const res = await fetch(`${url}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: '{"minutes":5,"note":"x"}',
      });
      await expectError(res, 415, 'unsupported_media_type');
      const form = await fetch(`${url}/api/sessions`, { method: 'POST', body: new URLSearchParams({ minutes: '5', note: 'x' }) });
      await expectError(form, 415, 'unsupported_media_type');
    }));

  test('413 body_too_large by Content-Length and by counting a chunked body', () =>
    withServer({ bodyLimit: 4096 }, async ({ url, store }) => {
      const big = JSON.stringify({ minutes: 5, note: 'x'.repeat(5000) });
      const declared = await postJson(url, big);
      await expectError(declared, 413, 'body_too_large');
      assert.strictEqual(declared.headers.get('connection'), 'close');

      // No Content-Length: Transfer-Encoding: chunked, 3 x 2000 bytes.
      const chunked = await rawRequest(url, {
        headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
        chunks: ['{"minutes":5,"note":"', 'y'.repeat(2000), 'y'.repeat(2000), 'y'.repeat(2000) + '"}'],
      });
      assert.strictEqual(chunked.status, 413);
      assert.strictEqual(chunked.body.error.code, 'body_too_large');
      assert.strictEqual(fs.existsSync(store.file), false);
    }));

  test('409 write_conflict, retryable with Retry-After, for an overlapping write; no record lost', () =>
    withServer({ writeDelayMs: 150 }, async ({ url, store }) => {
      const [a, b] = await Promise.all([
        postJson(url, { minutes: 10, note: 'tab A' }),
        postJson(url, { minutes: 20, note: 'tab B' }),
      ]);
      assert.deepStrictEqual([a.status, b.status], [201, 409]);
      assert.strictEqual(b.headers.get('retry-after'), '1');
      const error = await expectError(b, 409, 'write_conflict');
      assert.strictEqual(error.retryable, true);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(store.file, 'utf8')).map((s) => s.note), ['tab A']);

      const retry = await postJson(url, { minutes: 20, note: 'tab B' });
      assert.strictEqual(retry.status, 201);
      const list = await (await fetch(`${url}/api/sessions`)).json();
      assert.deepStrictEqual(list.sessions.map((s) => s.note), ['tab A', 'tab B']);
    }));

  test('a GET during a slow write sees the old complete list, never a partial file', () =>
    withServer({ writeDelayMs: 150 }, async ({ url }) => {
      const posting = postJson(url, { minutes: 10, note: 'slow' });
      await new Promise((r) => setTimeout(r, 50));
      const during = await (await fetch(`${url}/api/sessions`)).json();
      assert.strictEqual(during.count, 0);
      assert.strictEqual((await posting).status, 201);
    }));

  test('the same Idempotency-Key twice: 201 then 200 with the same record', () =>
    withServer({}, async ({ url }) => {
      const key = 'b6f1c0de-0000-4000-8000-000000000001';
      const first = await postJson(url, { minutes: 30, note: 'retry me' }, { 'Idempotency-Key': key });
      const again = await postJson(url, { minutes: 30, note: 'retry me' }, { 'Idempotency-Key': key });
      assert.deepStrictEqual([first.status, again.status], [201, 200]);
      assert.strictEqual(again.headers.get('idempotent-replayed'), 'true');
      assert.deepStrictEqual(await again.json(), await first.json());
      assert.strictEqual((await (await fetch(`${url}/api/sessions`)).json()).count, 1);
      await expectError(await postJson(url, { minutes: 1, note: 'x' }, { 'Idempotency-Key': 'bad key!' }), 400, 'invalid_idempotency_key');
    }));
});

describe('routing', () => {
  test('405 with Allow for an unsupported method on a resource', () =>
    withServer({}, async ({ url }) => {
      const res = await fetch(`${url}/api/sessions`, { method: 'DELETE' });
      await expectError(res, 405, 'method_not_allowed');
      assert.strictEqual(res.headers.get('allow'), 'GET, HEAD, POST');
    }));

  test('404 not_found as JSON for unknown API paths and unknown ids', () =>
    withServer({}, async ({ url }) => {
      await expectError(await fetch(`${url}/api/nothing`), 404, 'not_found');
      await expectError(await fetch(`${url}/api/sessions/99`), 404, 'not_found');
      await expectError(await fetch(`${url}/api/sessions/abc`), 404, 'not_found');
    }));

  test('the UI is served from the same origin: / redirects to the study log page', () =>
    withServer({}, async ({ url }) => {
      const res = await fetch(`${url}/`, { redirect: 'manual' });
      assert.strictEqual(res.status, 302);
      assert.strictEqual(res.headers.get('location'), '/studytrack-platform/log.html');
      const index = await fetch(`${url}/studytrack-platform/`);
      assert.strictEqual(index.status, 200);
      assert.match(index.headers.get('content-type'), /^text\/html/);
      const missing = await fetch(`${url}/studytrack-platform/nope.html`);
      assert.strictEqual(missing.status, 404);
    }));
});

describe('restart', () => {
  test('records survive stopping the server and starting a new one on the same file', async () => {
    const dataFile = freshFile();
    const first = await startApp({ port: 0, log: false, dataFile });
    await postJson(first.url, { minutes: 50, note: 'before restart' });
    await first.close();

    const second = await startApp({ port: 0, log: false, dataFile });
    try {
      const body = await (await fetch(`${second.url}/api/sessions`)).json();
      assert.deepStrictEqual(body.sessions.map((s) => s.note), ['before restart']);
      const next = await postJson(second.url, { minutes: 10, note: 'after restart' });
      assert.strictEqual((await next.json()).session.id, 2);
    } finally {
      await second.close();
    }
  });
});
