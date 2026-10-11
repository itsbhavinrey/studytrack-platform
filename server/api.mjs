// The REST API for study sessions (Project 6).
//
// Resources and methods (the full contract is in README.md, "Shared study log"):
//   /api/sessions        GET (list), HEAD, POST (create)
//   /api/sessions/{id}   GET (one), HEAD
// Every response, success or error, is application/json.
//
// This file knows HTTP; it does not know files. Storage is the store passed
// in (src/storage.js createSessionStore), so the two can change separately.

import { createRequire } from 'node:module';
import { calculateAccumulatedMinutes, validateSessionInput } from '../web/js/calculation.mjs';
import { HttpError, readJsonBody, sendJson } from './http-json.mjs';

const require = createRequire(import.meta.url);
const { CorruptDataError, IdempotencyKeyMismatchError, StoreBusyError } = require('../src/storage.js');

/** How long a client should wait before retrying a 409 write_conflict. */
export const RETRY_AFTER_SECONDS = 1;

// Idempotency keys: what crypto.randomUUID() produces, or similar tokens.
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

/** The public representation of a record: internal fields stay internal. */
function toResource({ id, minutes, note, timestamp }) {
  return { id, minutes, note, timestamp };
}

function methodNotAllowed(allow) {
  return new HttpError(405, 'method_not_allowed', `Use one of: ${allow}.`, { headers: { Allow: allow } });
}

/** Translates storage failures into documented HTTP errors. */
function storageError(err) {
  if (err instanceof StoreBusyError) {
    return new HttpError(409, 'write_conflict', 'Another write is in progress. Retry the same request shortly.', {
      retryable: true,
      headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
    });
  }
  if (err instanceof IdempotencyKeyMismatchError) {
    // draft-ietf-httpapi-idempotency-key-header: a reused key with a different
    // payload is a client error, not a replay. Nothing new was stored.
    return new HttpError(
      422,
      'idempotency_key_mismatch',
      'This Idempotency-Key was already used for a session with different minutes or note. Use a new key for a new entry.'
    );
  }
  if (err instanceof CorruptDataError) {
    // The server log has the file path and parser message; the client gets
    // no server paths.
    console.error(`[store] ${err.message}`);
    return new HttpError(500, 'storage_corrupt', 'The data file is corrupt. It was left untouched; see the server log.');
  }
  return err;
}

/**
 * @param {ReturnType<import('../src/storage.js').createSessionStore>} store
 * @param {{ bodyLimit?: number }} [options]
 * @returns {(req, res, pathname: string) => Promise<void>}
 */
export function createApi(store, { bodyLimit } = {}) {
  async function listSessions(req, res) {
    const sessions = await store.list().catch((err) => Promise.reject(storageError(err)));
    sendJson(req, res, 200, {
      sessions: sessions.map(toResource),
      count: sessions.length,
      totalMinutes: calculateAccumulatedMinutes(sessions),
    });
  }

  async function getSession(req, res, id) {
    const sessions = await store.list().catch((err) => Promise.reject(storageError(err)));
    const session = sessions.find((s) => s.id === id);
    if (!session) throw new HttpError(404, 'not_found', `There is no session ${id}.`);
    sendJson(req, res, 200, { session: toResource(session) });
  }

  async function createSession(req, res) {
    const key = req.headers['idempotency-key'];
    if (key !== undefined && !IDEMPOTENCY_KEY.test(key)) {
      throw new HttpError(400, 'invalid_idempotency_key', 'Idempotency-Key must be 8-100 letters, digits, "-" or "_".');
    }

    const body = await readJsonBody(req, { limit: bodyLimit });
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'invalid_body', 'The body must be a JSON object with "minutes" and "note".');
    }
    const check = validateSessionInput(body);
    if (!check.ok) {
      throw new HttpError(422, 'validation_failed', 'The session was not saved; see details.', { details: check.errors });
    }

    let result;
    try {
      result = await store.add(check.values, { requestId: key });
    } catch (err) {
      throw storageError(err);
    }
    // The store resolved, so the record is on disk. Only now do we say so.
    const session = toResource(result.session);
    if (result.created) {
      sendJson(req, res, 201, { session }, { Location: `/api/sessions/${session.id}` });
    } else {
      // Same Idempotency-Key as an earlier, successful request: no new record.
      sendJson(req, res, 200, { session }, { 'Idempotent-Replayed': 'true' });
    }
  }

  return async function handleApi(req, res, pathname) {
    if (pathname === '/api/sessions') {
      if (req.method === 'GET' || req.method === 'HEAD') return listSessions(req, res);
      if (req.method === 'POST') return createSession(req, res);
      throw methodNotAllowed('GET, HEAD, POST');
    }
    const one = pathname.match(/^\/api\/sessions\/([1-9]\d{0,9})$/);
    if (one) {
      if (req.method === 'GET' || req.method === 'HEAD') return getSession(req, res, Number(one[1]));
      throw methodNotAllowed('GET, HEAD');
    }
    throw new HttpError(404, 'not_found', `No API resource at ${pathname}.`);
  };
}
