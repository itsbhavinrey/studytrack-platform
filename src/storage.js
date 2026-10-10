/**
 * Storage Module (src/storage.js)
 *
 * Handles file persistence for study sessions in JSON format.
 * Satisfies:
 * - Absent data file handled as an empty log (returns []).
 * - Invalid or corrupted JSON handled as a visible error without overwriting.
 * - Single-writer file persistence.
 */

const fs = require('fs');
const path = require('path');

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

  const nextId = sessions.length > 0
    ? Math.max(...sessions.map((s) => (typeof s.id === 'number' ? s.id : 0))) + 1
    : 1;

  const newSession = {
    id: nextId,
    minutes: Number(minutes),
    note: String(note).trim(),
    timestamp: new Date().toISOString(),
  };

  sessions.push(newSession);
  saveSessions(filePath, sessions);

  return newSession;
}

module.exports = {
  DEFAULT_FILE_NAME,
  CorruptDataError,
  resolveDataFilePath,
  loadSessions,
  saveSessions,
  addSession,
};
