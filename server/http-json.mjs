// JSON over HTTP, by hand (Project 6). No framework: the request is a stream
// of bytes (an IncomingMessage) and the response is written with writeHead()
// and end(). This module holds the parts every JSON endpoint needs.

/** Largest request body the API reads. A valid session is under 300 bytes. */
export const MAX_BODY_BYTES = 4096;

export const JSON_TYPE = 'application/json; charset=utf-8';

/**
 * An error that already knows its HTTP response. Handlers throw it; the app
 * catches it in one place and sends the documented error body:
 *   { "error": { "code", "message", "retryable", "details"? } }
 */
export class HttpError extends Error {
  /**
   * @param {number} status - HTTP status code
   * @param {string} code - Stable, machine-readable error code
   * @param {string} message - Human-readable explanation
   * @param {{ retryable?: boolean, details?: object, headers?: object }} [extra]
   */
  constructor(status, code, message, { retryable = false, details, headers = {} } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
    this.headers = headers;
  }
}

/**
 * Sends a JSON response. HEAD requests get the same headers and no body.
 * Content-Length is the size in bytes (UTF-8), not in characters.
 */
export function sendJson(req, res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': JSON_TYPE,
    'Content-Length': Buffer.byteLength(text),
    // API data changes with every write; never let a cache answer for us.
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(req.method === 'HEAD' ? undefined : text);
}

/** Sends an HttpError as the documented JSON error body. */
export function sendError(req, res, err) {
  const error = { code: err.code, message: err.message, retryable: err.retryable };
  if (err.details) error.details = err.details;
  sendJson(req, res, err.status, { error }, err.headers);
}

/** The media type without parameters: "application/json; charset=utf-8" -> "application/json". */
function mediaType(header) {
  return (header || '').split(';')[0].trim().toLowerCase();
}

/**
 * Reads and parses a JSON request body, enforcing the contract:
 *   415 unless Content-Type is application/json,
 *   413 if Content-Length or the bytes actually received exceed `limit`,
 *   400 if the bytes are not UTF-8 or not JSON (including an empty body).
 *
 * The body arrives in chunks; `for await` pulls them from the stream without
 * blocking. Counting the received bytes matters: Content-Length may be absent
 * (chunked transfer encoding) or wrong.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {{ limit?: number }} [options]
 * @returns {Promise<*>} The parsed JSON value (any type)
 */
export async function readJsonBody(req, { limit = MAX_BODY_BYTES } = {}) {
  if (mediaType(req.headers['content-type']) !== 'application/json') {
    throw new HttpError(415, 'unsupported_media_type', 'Send the body as Content-Type: application/json.');
  }

  const tooLarge = () =>
    new HttpError(413, 'body_too_large', `The body is larger than ${limit} bytes.`, {
      // We stop reading early, so the rest of the body is still on the
      // connection; closing it is simpler and safer than draining it.
      headers: { Connection: 'close' },
    });

  const declared = req.headers['content-length'];
  if (declared !== undefined && Number(declared) > limit) throw tooLarge();

  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    received += chunk.length;
    if (received > limit) throw tooLarge();
    chunks.push(chunk);
  }

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new HttpError(400, 'invalid_json', 'The body is not valid UTF-8 text.');
  }
  if (text.trim() === '') {
    throw new HttpError(400, 'invalid_json', 'The body is empty; send a JSON object.');
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new HttpError(400, 'invalid_json', `The body is not valid JSON: ${err.message}`);
  }
}
