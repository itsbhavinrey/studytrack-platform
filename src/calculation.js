/**
 * Calculation and Validation Module (src/calculation.js)
 *
 * Pure functions for calculation, unit conversions, rounding, and input validation.
 * Does not perform I/O or terminal output.
 */

/**
 * Returns a correctly pluralized string based on the count.
 * E.g., pluralize(1, 'week') -> '1 week', pluralize(3, 'week') -> '3 weeks',
 * pluralize(0.5, 'hour') -> '0.5 hours'.
 *
 * @param {number|string} count - The quantity
 * @param {string} singular - The singular word
 * @param {string} [plural] - The plural word (defaults to singular + 's')
 * @returns {string} Pluralized phrase
 */
function pluralize(count, singular, plural = singular + 's') {
  const num = Number(count);
  return `${count} ${num === 1 ? singular : plural}`;
}

/**
 * Validates whether a raw value represents a positive whole integer.
 * Rejects non-numeric text, decimals/fractions, negatives, zero, and extraneous characters.
 *
 * @param {*} value - Value to validate
 * @returns {boolean} True if value is a positive whole integer
 */
function isPositiveInteger(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0;
  }
  if (typeof value !== 'string') return false;
  // Ensure the string consists solely of digits (rejects signs, decimals, whitespace, letters)
  if (!/^\d+$/.test(value)) return false;

  const num = Number(value);
  return Number.isInteger(num) && num > 0 && String(num) === value;
}

/**
 * Validates whether a study note is a non-empty string after trimming whitespace.
 *
 * @param {*} note - Study note to validate
 * @returns {boolean} True if note is a valid non-empty string
 */
function isValidNote(note) {
  return typeof note === 'string' && note.trim().length > 0;
}

/**
 * Converts minutes to hours.
 *
 * @param {number} minutes - Duration in minutes
 * @returns {number} Exact duration in hours
 */
function minutesToHours(minutes) {
  return minutes / 60;
}

/**
 * Rounds a number to a specified number of decimal places (default 2).
 * Returns clean numeric output (e.g. 2.5 instead of 2.5000000001).
 *
 * @param {number} value - Number to round
 * @param {number} [decimals=2] - Decimal places
 * @returns {number} Rounded number
 */
function roundHours(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Calculates the required study duration in weeks and final-week hours
 * for a study goal (Project 1 calculator contract).
 *
 * @param {number} totalHours - Total required study hours (> 0)
 * @param {number} weeklyHours - Available study hours per week (> 0)
 * @returns {object} Study plan containing totalHours, weeklyHours, totalWeeks, and finalWeekHours
 */
function calculateStudyPlan(totalHours, weeklyHours) {
  // Partial weeks count as a whole required week (round up)
  const totalWeeks = Math.ceil(totalHours / weeklyHours);

  // Exact multiples must not show zero final-week hours
  const remainder = totalHours % weeklyHours;
  const finalWeekHours = remainder === 0 ? weeklyHours : remainder;

  return {
    totalHours,
    weeklyHours,
    totalWeeks,
    finalWeekHours,
  };
}

/**
 * Calculates total accumulated minutes across an array of study sessions.
 *
 * @param {Array<{minutes: number}>} sessions - List of sessions
 * @returns {number} Sum of minutes (0 if empty)
 */
function calculateAccumulatedMinutes(sessions) {
  if (!Array.isArray(sessions)) return 0;
  return sessions.reduce((total, session) => total + (session.minutes || 0), 0);
}

/**
 * Calculates summary metrics given existing study sessions and goal parameters.
 *
 * Display Rounding Rule:
 * - Completed and remaining hours are rounded to 2 decimal places for display.
 * - Remaining weeks are rounded up to the next whole week if remaining hours > 0.
 * - If completed hours >= goal hours, remaining hours and weeks are 0 (completed goal).
 *
 * @param {Array<{minutes: number}>} sessions - Logged study sessions
 * @param {number} goalHours - Target study hours (> 0)
 * @param {number} weeklyHours - Target study hours per week (> 0)
 * @returns {object} Summary calculation result
 */
function calculateSummary(sessions, goalHours, weeklyHours) {
  const accumulatedMinutes = calculateAccumulatedMinutes(sessions);
  const rawCompletedHours = minutesToHours(accumulatedMinutes);
  const rawRemainingHours = Math.max(0, goalHours - rawCompletedHours);

  const completedHours = roundHours(rawCompletedHours, 2);
  const remainingHours = roundHours(rawRemainingHours, 2);
  const isCompleted = remainingHours === 0;

  let remainingWeeks = 0;
  let finalWeekHours = 0;

  if (!isCompleted) {
    remainingWeeks = Math.ceil(remainingHours / weeklyHours);
    const remainder = remainingHours % weeklyHours;
    // Exact multiples show full weekly capacity; otherwise remainder rounded to 2 decimals
    const rawFinalWeek = remainder === 0 ? weeklyHours : remainder;
    finalWeekHours = roundHours(rawFinalWeek, 2);
  }

  return {
    goalHours,
    weeklyHours,
    sessionCount: Array.isArray(sessions) ? sessions.length : 0,
    accumulatedMinutes,
    completedHours,
    remainingHours,
    remainingWeeks,
    finalWeekHours,
    isCompleted,
  };
}

module.exports = {
  pluralize,
  isPositiveInteger,
  isValidNote,
  minutesToHours,
  roundHours,
  calculateStudyPlan,
  calculateAccumulatedMinutes,
  calculateSummary,
};
