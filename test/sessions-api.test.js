// Project 6: which failed saves the study log page offers to retry.
// web/js/sessions-api.mjs is a browser module; Node can import it because it
// touches fetch() only when a request is made.

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'web', 'js', 'sessions-api.mjs')).href);

const errorBody = (code, retryable) => ({ error: { code, message: code, retryable } });

test('canRetry: yes for a network failure and for a retryable answer', async () => {
  const { ApiError, NetworkError, canRetry } = await load();
  assert.strictEqual(canRetry(new NetworkError('The StudyTrack server could not be reached.')), true);
  assert.strictEqual(canRetry(new ApiError(409, errorBody('write_conflict', true), 1)), true);
});

test('canRetry: no when the same values would be refused again', async () => {
  const { ApiError, canRetry } = await load();
  assert.strictEqual(canRetry(new ApiError(422, errorBody('validation_failed', false))), false);
  assert.strictEqual(canRetry(new ApiError(422, errorBody('idempotency_key_mismatch', false))), false);
  assert.strictEqual(canRetry(new ApiError(500, errorBody('storage_corrupt', false))), false);
  assert.strictEqual(canRetry(new ApiError(404, null)), false); // no StudyTrack API at this address
  assert.strictEqual(canRetry(new TypeError('a bug in the page')), false);
});
