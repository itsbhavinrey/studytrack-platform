/**
 * Project 6: validateSessionInput() is the one definition of a valid new
 * session. The API (server/api.mjs) and the study-log form
 * (web/js/study-log.mjs) both call it.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { validateSessionInput, SESSION_LIMITS, SESSION_FIELDS } = require('../src/calculation');

test('accepts the documented fields and trims the note', () => {
  const r = validateSessionInput({ minutes: 45, note: '  Node http module  ' });
  assert.deepStrictEqual(r, { ok: true, values: { minutes: 45, note: 'Node http module' }, errors: {} });
});

test('documents exactly two fields and the limits', () => {
  assert.deepStrictEqual([...SESSION_FIELDS], ['minutes', 'note']);
  assert.deepStrictEqual({ ...SESSION_LIMITS }, { maxMinutes: 1440, maxNoteLength: 200 });
});

test('boundaries: 1 and 1440 minutes, 200-character note are accepted', () => {
  assert.ok(validateSessionInput({ minutes: 1, note: 'x' }).ok);
  assert.ok(validateSessionInput({ minutes: 1440, note: 'x'.repeat(200) }).ok);
  assert.ok(validateSessionInput({ minutes: 30, note: ` ${'x'.repeat(200)} ` }).ok, 'length is counted after trimming');
});

test('rejects a body that is not a plain object', () => {
  for (const body of [null, [], 'text', 42, true]) {
    const r = validateSessionInput(body);
    assert.strictEqual(r.ok, false);
    assert.match(r.errors.body, /JSON object/);
  }
});

test('rejects unknown fields, naming them', () => {
  const r = validateSessionInput({ minutes: 30, note: 'ok', id: 7, timestamp: 'x' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.errors.body, 'Unknown field(s): id, timestamp. Allowed: minutes, note.');
});

test('minutes: missing, text, zero, negative, fraction, too large', () => {
  const cases = [
    [undefined, /Enter the minutes/],
    ['45', /positive whole number/],
    [0, /positive whole number/],
    [-5, /positive whole number/],
    [2.5, /positive whole number/],
    [Number.NaN, /positive whole number/],
    [1441, /at most 1440/],
  ];
  for (const [minutes, message] of cases) {
    const r = validateSessionInput({ minutes, note: 'ok' });
    assert.strictEqual(r.ok, false, `minutes=${String(minutes)}`);
    assert.match(r.errors.minutes, message);
  }
});

test('note: missing, empty, whitespace, not text, too long', () => {
  const cases = [
    [undefined, /Enter a note/],
    ['', /not empty/],
    ['   ', /not empty/],
    [12, /not empty/],
    ['x'.repeat(201), /at most 200/],
  ];
  for (const [note, message] of cases) {
    const r = validateSessionInput({ minutes: 30, note });
    assert.strictEqual(r.ok, false, `note=${JSON.stringify(note)}`);
    assert.match(r.errors.note, message);
  }
});

test('reports every problem at once', () => {
  const r = validateSessionInput({ minutes: 0, note: '', extra: 1 });
  assert.deepStrictEqual(Object.keys(r.errors).sort(), ['body', 'minutes', 'note']);
  assert.strictEqual(r.values, null);
});
