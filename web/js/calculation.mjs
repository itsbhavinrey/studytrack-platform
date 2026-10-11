/**
 * Calculation and Validation Module (web/js/calculation.mjs)
 *
 * Pure functions for calculation, unit conversions, rounding, and input validation.
 * Does not perform I/O or terminal output.
 *
 * Shared by two runtimes since Project 5:
 *   - the browser loads it as an ES module (web/js/planner.mjs imports it), and
 *   - Node loads it through src/calculation.js (require(esm), Node 22.12+).
 * So it must stay environment-neutral: no require(), no node: imports, no
 * process, no document/window. It lives in web/ because only web/ is published.
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
export function pluralize(count, singular, plural = singular + 's') {
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
export function isPositiveInteger(value) {
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
export function isValidNote(note) {
  return typeof note === 'string' && note.trim().length > 0;
}

/**
 * Converts minutes to hours.
 *
 * @param {number} minutes - Duration in minutes
 * @returns {number} Exact duration in hours
 */
export function minutesToHours(minutes) {
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
export function roundHours(value, decimals = 2) {
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
export function calculateStudyPlan(totalHours, weeklyHours) {
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
export function calculateAccumulatedMinutes(sessions) {
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
export function calculateSummary(sessions, goalHours, weeklyHours) {
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


/**
 * Lists the hours to study in each week of a plan (Project 5 week table).
 * Every week gets the weekly hours except the last, which gets finalWeekHours.
 * E.g. a 30-hour goal at 12 hours per week -> [12, 12, 6].
 *
 * @param {{ weeklyHours: number, totalWeeks: number, finalWeekHours: number }} plan
 *   - Result of calculateStudyPlan()
 * @returns {number[]} Hours per week, one entry per week
 */
export function weeklyBreakdown(plan) {
  const weeks = [];
  for (let week = 1; week <= plan.totalWeeks; week++) {
    weeks.push(week === plan.totalWeeks ? plan.finalWeekHours : plan.weeklyHours);
  }
  return weeks;
}

/**
 * Validates the planner form's raw text values with Project 1's input rules
 * (Project 5). Values are trimmed first: the shell strips the whitespace
 * between command-line arguments before Node sees them, so P1 never received
 * surrounding spaces either. Inner text such as "12 4" is still rejected.
 *
 * Returns every field's error at once, so the form can mark all of them.
 *
 * @param {{ goalName: string, totalHours: string, weeklyHours: string }} raw
 *   - Raw input values as typed
 * @returns {{ ok: boolean,
 *             values: { goalName: string, totalHours: number, weeklyHours: number } | null,
 *             errors: { goalName?: string, totalHours?: string, weeklyHours?: string } }}
 */
export function validatePlanInput(raw) {
  const goalName = String(raw.goalName ?? '').trim();
  const totalHours = String(raw.totalHours ?? '').trim();
  const weeklyHours = String(raw.weeklyHours ?? '').trim();
  const errors = {};

  if (!isValidNote(goalName)) {
    errors.goalName = 'Enter a name for your study goal.';
  }

  if (totalHours === '') {
    errors.totalHours = 'Enter the total hours needed.';
  } else if (!isPositiveInteger(totalHours)) {
    errors.totalHours = 'Total hours must be a positive whole number, for example 30.';
  }

  if (weeklyHours === '') {
    errors.weeklyHours = 'Enter the hours available per week.';
  } else if (!isPositiveInteger(weeklyHours)) {
    errors.weeklyHours = 'Weekly hours must be a positive whole number, for example 12.';
  }

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    values: ok
      ? { goalName, totalHours: Number(totalHours), weeklyHours: Number(weeklyHours) }
      : null,
    errors,
  };
}
