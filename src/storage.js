/**
 * Storage Module (src/storage.js)
 *
 * Handles file persistence for study sessions in JSON format.
 * Satisfies:
 * - Absent data file handled as an empty log (returns []).
 * - Invalid or corrupted JSON handled as a visible error without overwriting.
 * - Single-writer file persistence.
 *
 * Two APIs over one file format (Project 6):
 * - Synchronous (loadSessions, saveSessions, addSession): used by the P2 CLI,
 *   a short-lived process where blocking is harmless.
 * - Promise-based (readSessionsAsync, writeSessionsAsync, createSessionStore):
 *   used by the HTTP server, where a blocking call would stall every other
 *   request on the event loop. Parsing, IDs and record shape are shared.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const DEFAULT_FILE_NAME = 'studytrack-data.json';

/**
 * Custom error thrown when the data file exists but cannot be parsed as valid JSON
 * or does not contain a valid session list.
 */
class CorruptDataError extends Error {
  constructor(filePath, originalError) {
    super(`Data file at "${filePath}" is corrupted or contains invalid JSON: ${originalError.message}`);
    this.name = 'CorruptDataError';
    this.filePath = filePath;
    this.originalError = originalError;
  }
}

/**
 * Resolves the target data file path from an explicit path, environment variable,
 * or default filename.
 *
 * Priority:
 * 1. Explicit path parameter (e.g. from --file flag)
 * 2. STUDYTRACK_DATA_FILE environment variable
 * 3. Default: studytrack-data.json in process.cwd()
 *
 * @param {string} [customPath] - Optional user-specified path
 * @returns {string} Absolute path to the data file
 */
function resolveDataFilePath(customPath) {
  if (customPath && typeof customPath === 'string' && customPath.trim() !== '') {
    return path.resolve(process.cwd(), customPath.trim());
  }

  if (process.env.STUDYTRACK_DATA_FILE && process.env.STUDYTRACK_DATA_FILE.trim() !== '') {
    return path.resolve(process.cwd(), process.env.STUDYTRACK_DATA_FILE.trim());
  }

  return path.resolve(process.cwd(), DEFAULT_FILE_NAME);
}

/**
 * Loads study sessions from the specified JSON file.
 *
 * Requirements:
 * - If the file does not exist (absent), returns an empty array [].
 * - If the file exists but contains invalid JSON (or is not an array),
 *   throws a CorruptDataError. Does NOT overwrite or delete the bad file.
 *
 * @param {string} filePath - Absolute or relative file path
 * @returns {Array<object>} Array of session objects
 * @throws {CorruptDataError} If JSON parsing fails
 */
function loadSessions(filePath) {
  const resolvedPath = resolveDataFilePath(filePath);

  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  let content;
  try {
    content = fs.readFileSync(resolvedPath, 'utf8');
  } catch (readErr) {
    if (readErr.code === 'ENOENT') {
      return [];
    }
    throw readErr;
  }

  return parseSessions(content, resolvedPath);
}

/**
 * Parses the data file's text. Shared by the synchronous and async readers so
 * both apply the same corrupt-file rule.
 *
 * @param {string} content - File contents
 * @param {string} resolvedPath - Path, for the error message
 * @returns {Array<object>} Session records
 * @throws {CorruptDataError} If the text is not JSON or not an array
 */
function parseSessions(content, resolvedPath) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (parseErr) {
    // Preserve the bad file untouched and raise a visible error
    throw new CorruptDataError(resolvedPath, parseErr);
  }

  if (!Array.isArray(parsed)) {
    throw new CorruptDataError(
      resolvedPath,
      new Error('Data root must be an array of session records.')
    );
  }

  return parsed;
}

/**
 * Builds the next session record: id = highest existing numeric id + 1.
 *
 * @param {Array<object>} sessions - Existing records
 * @param {{ minutes: number, note: string }} details - Validated details
 * @param {string} [requestId] - Idempotency key sent by an HTTP client (P6)
 * @returns {object} The new record (not yet saved)
 */
function newSessionRecord(sessions, { minutes, note }, requestId) {
  const nextId = sessions.length > 0
    ? Math.max(...sessions.map((s) => (typeof s.id === 'number' ? s.id : 0))) + 1
    : 1;

  const record = {
    id: nextId,
    minutes: Number(minutes),
    note: String(note).trim(),
    timestamp: new Date().toISOString(),
  };
  if (requestId) record.requestId = requestId;
  return record;
}

/**
 * Saves study sessions to the specified JSON file.
 * Formats JSON with 2-space indentation for human readability.
 *
 * @param {string} filePath - Target file path
 * @param {Array<object>} sessions - Array of session objects to save
 */
function saveSessions(filePath, sessions) {
  if (!Array.isArray(sessions)) {
    throw new TypeError('Sessions to save must be an array.');
  }

  const resolvedPath = resolveDataFilePath(filePath);
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const jsonContent = JSON.stringify(sessions, null, 2) + '\n';
  fs.writeFileSync(resolvedPath, jsonContent, 'utf8');
}

/**
 * Adds a new study session to the data file.
 *
 * Generates an incrementing numeric ID, records duration in minutes,
 * note text, and an ISO 8601 timestamp.
 *
 * @param {string} filePath - Target data file path
 * @param {object} param1 - Session details
 * @param {number} param1.minutes - Study duration in minutes (> 0)
 * @param {string} param1.note - Non-empty session note
 * @returns {object} The created session record
 */
function addSession(filePath, { minutes, note }) {
  const sessions = loadSessions(filePath);
  const newSession = newSessionRecord(sessions, { minutes, note });

  sessions.push(newSession);
  saveSessions(filePath, sessions);

  return newSession;
}

// ---------------------------------------------------------------------------
// Promise-based API (Project 6). No *Sync calls below this line.
// ---------------------------------------------------------------------------

/**
 * Thrown when a mutation is attempted while another one is still in progress.
 * The HTTP layer turns it into 409 write_conflict with Retry-After.
 */
class StoreBusyError extends Error {
  constructor(filePath) {
    super(`Another write to "${filePath}" is in progress. Retry shortly.`);
    this.name = 'StoreBusyError';
    this.filePath = filePath;
  }
}

/**
 * Reads the sessions without blocking the event loop.
 * Absent file -> []; corrupt file -> CorruptDataError (file left untouched).
 *
 * @param {string} filePath - Data file path
 * @returns {Promise<Array<object>>} Session records
 */
async function readSessionsAsync(filePath) {
  const resolvedPath = resolveDataFilePath(filePath);
  let content;
  try {
    content = await fsp.readFile(resolvedPath, 'utf8');
  } catch (readErr) {
    if (readErr.code === 'ENOENT') return [];
    throw readErr;
  }
  return parseSessions(content, resolvedPath);
}

/**
 * Replaces the data file durably and atomically:
 *   1. write the whole list to a temporary file in the same directory,
 *   2. fsync it (ask the OS to put the bytes on disk, not just in its cache),
 *   3. rename it over the data file.
 * rename() within one directory is atomic on POSIX file systems, so a reader
 * or a crash sees either the old complete file or the new complete file.
 *
 * @param {string} filePath - Data file path
 * @param {Array<object>} sessions - Complete list to store
 * @returns {Promise<void>} Resolves once the new file is in place
 */
async function writeSessionsAsync(filePath, sessions) {
  if (!Array.isArray(sessions)) {
    throw new TypeError('Sessions to save must be an array.');
  }
  const resolvedPath = resolveDataFilePath(filePath);
  const dir = path.dirname(resolvedPath);
  await fsp.mkdir(dir, { recursive: true });

  const tempPath = path.join(dir, `.${path.basename(resolvedPath)}.${randomUUID()}.tmp`);
  const handle = await fsp.open(tempPath, 'w');
  try {
    await handle.writeFile(JSON.stringify(sessions, null, 2) + '\n', 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fsp.rename(tempPath, resolvedPath);
  } catch (err) {
    await fsp.rm(tempPath, { force: true });
    throw err;
  }
}

/**
 * A single-process, single-writer session store for the HTTP server.
 *
 * add() is a read-modify-write: read the file, append, write it back. Two of
 * those running at the same time would both read N records and both write
 * N + 1, losing one record (a "lost update"). The store therefore allows one
 * add() at a time and REJECTS an overlapping one with StoreBusyError instead
 * of queueing it or silently losing it.
 *
 * The `busy` check and `busy = true` run with no `await` in between, so no
 * other callback can run between them: JavaScript runs one callback at a
 * time on the event loop. This guard works for one process only; a second
 * process (or the CLI writing the same file) is not protected.
 *
 * @param {string} filePath - Data file path
 * @param {{ writeDelayMs?: number }} [options] - writeDelayMs widens the gap
 *   between read and write, for demonstrating overlap (tests, drills)
 */
function createSessionStore(filePath, { writeDelayMs = 0 } = {}) {
  const file = resolveDataFilePath(filePath);
  let busy = false;

  return {
    file,

    /** True while an add() is between its read and its rename. */
    get writing() {
      return busy;
    },

    /** @returns {Promise<Array<object>>} All records, oldest first */
    list() {
      return readSessionsAsync(file);
    },

    /**
     * Appends one validated session. Resolves only after the file is durable.
     * With a requestId that is already stored, returns that record instead of
     * adding a duplicate (created: false).
     *
     * @param {{ minutes: number, note: string }} details
     * @param {{ requestId?: string }} [options]
     * @returns {Promise<{ session: object, created: boolean }>}
     * @throws {StoreBusyError} If another add() is in progress
     * @throws {CorruptDataError} If the data file is corrupt (left untouched)
     */
    async add(details, { requestId } = {}) {
      if (busy) throw new StoreBusyError(file);
      busy = true;
      try {
        const sessions = await readSessionsAsync(file);
        if (requestId) {
          const existing = sessions.find((s) => s.requestId === requestId);
          if (existing) return { session: existing, created: false };
        }
        const session = newSessionRecord(sessions, details, requestId);
        if (writeDelayMs > 0) await new Promise((r) => setTimeout(r, writeDelayMs));
        await writeSessionsAsync(file, [...sessions, session]);
        return { session, created: true };
      } finally {
        busy = false;
      }
    },
  };
}

module.exports = {
  DEFAULT_FILE_NAME,
  CorruptDataError,
  StoreBusyError,
  resolveDataFilePath,
  loadSessions,
  saveSessions,
  addSession,
  readSessionsAsync,
  writeSessionsAsync,
  createSessionStore,
};
