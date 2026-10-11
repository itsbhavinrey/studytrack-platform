/**
 * Browser client for the StudyTrack session API (web/js/sessions-api.mjs) - Project 6.
 *
 * The only file in web/ that calls fetch(). It turns every outcome into one
 * of three things the page can act on:
 *
 *   - a resolved value: the server answered 2xx with JSON;
 *   - NetworkError: the fetch() promise REJECTED (or timed out). No HTTP
 *     response exists: the server is stopped, the connection was refused or
 *     dropped, or nothing answered within TIMEOUT_MS;
 *   - ApiError: the fetch() promise RESOLVED with a Response whose status is
 *     4xx/5xx. The server is up and said no, usually with a JSON error body.
 *
 * fetch() does not reject for 404 or 500: those are successful *transport*
 * of an unsuccessful *answer*, so this module checks response.ok itself.
 */

/** No request may leave the page waiting forever. */
export const TIMEOUT_MS = 8000;

/** How many times a 409 write_conflict is retried before it is shown. */
export const CONFLICT_RETRIES = 3;

/** The request never produced an HTTP response. */
export class NetworkError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/** The server answered with a 4xx/5xx status (or an unexpected body). */
export class ApiError extends Error {
  constructor(status, body, retryAfterSeconds = 0) {
    const error = body?.error;
    super(error?.message || `The server answered HTTP ${status} without a StudyTrack JSON error.`);
    this.name = 'ApiError';
    this.status = status;
    this.code = error?.code || 'unexpected_response';
    this.retryable = error?.retryable === true;
    this.details = error?.details || {};
    /** From the Retry-After header, in seconds (0 when absent). */
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One request. Resolves with { status, headers, body } for 2xx JSON;
 * rejects with NetworkError or ApiError otherwise.
 */
async function request(path, { method = 'GET', body, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: { Accept: 'application/json', ...headers },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // TypeError ("Failed to fetch") for a refused or dropped connection;
    // DOMException "TimeoutError" when AbortSignal.timeout fires.
    const message =
      err.name === 'TimeoutError'
        ? `The server did not answer within ${TIMEOUT_MS / 1000} seconds.`
        : 'The StudyTrack server could not be reached.';
    throw new NetworkError(message, err);
  }

  let data = null;
  if ((response.headers.get('content-type') || '').startsWith('application/json')) {
    try {
      data = await response.json();
    } catch (err) {
      // The headers arrived but the body did not (connection dropped) or
      // was not JSON. Without a complete answer, treat it as a network fault.
      throw new NetworkError('The server response was cut off.', err);
    }
  }
  if (!response.ok || data === null) {
    throw new ApiError(response.status, data, Number(response.headers.get('retry-after')) || 0);
  }
  return { status: response.status, headers: response.headers, body: data };
}

/** @returns {Promise<{ sessions: object[], count: number, totalMinutes: number }>} */
export async function listSessions() {
  return (await request('/api/sessions')).body;
}

/**
 * Saves one session. The idempotency key identifies this entry: sending the
 * same key again (after a lost response) returns the stored record instead
 * of creating a second one. A 409 write_conflict is retried after the
 * server's Retry-After delay, up to CONFLICT_RETRIES times.
 *
 * @param {{ minutes: number, note: string }} session - Validated values
 * @param {{ idempotencyKey: string, onRetry?: (attempt: number) => void }} options
 * @returns {Promise<{ session: object, created: boolean }>}
 */
export async function addSession(session, { idempotencyKey, onRetry } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const { status, body } = await request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(session),
      });
      return { session: body.session, created: status === 201 };
    } catch (err) {
      const conflict = err instanceof ApiError && err.code === 'write_conflict';
      if (!conflict || attempt >= CONFLICT_RETRIES) throw err;
      onRetry?.(attempt + 1);
      await wait((err.retryAfterSeconds || 1) * 1000);
    }
  }
}
