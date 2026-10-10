/**
 * Unit Tests for Pure Calculation and Validation (test/calculation.test.js)
 *
 * Uses Node's built-in test runner (node:test and node:assert).
 * Covers boundary cases, minute totals, conversions, empty history,
 * partial goals, and completed goals.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  pluralize,
  isPositiveInteger,
  isValidNote,
  minutesToHours,
  roundHours,
  calculateStudyPlan,
  calculateAccumulatedMinutes,
  calculateSummary,
} = require('../src/calculation');

describe('src/calculation.js', () => {
  describe('pluralize()', () => {
    test('handles singular counts', () => {
      assert.strictEqual(pluralize(1, 'week'), '1 week');
      assert.strictEqual(pluralize(1, 'hour'), '1 hour');
      assert.strictEqual(pluralize(1, 'session'), '1 session');
    });

    test('handles plural counts', () => {
      assert.strictEqual(pluralize(0, 'week'), '0 weeks');
      assert.strictEqual(pluralize(2, 'week'), '2 weeks');
      assert.strictEqual(pluralize(3.5, 'hour'), '3.5 hours');
      assert.strictEqual(pluralize(10, 'session'), '10 sessions');
    });
  });

  describe('isPositiveInteger() validation', () => {
    test('accepts valid positive integers', () => {
      assert.strictEqual(isPositiveInteger('1'), true);
      assert.strictEqual(isPositiveInteger('30'), true);
      assert.strictEqual(isPositiveInteger(12), true);
      assert.strictEqual(isPositiveInteger('100'), true);
    });

    test('rejects zero and negatives', () => {
      assert.strictEqual(isPositiveInteger('0'), false);
      assert.strictEqual(isPositiveInteger(0), false);
      assert.strictEqual(isPositiveInteger('-5'), false);
      assert.strictEqual(isPositiveInteger(-12), false);
    });

    test('rejects fractional and decimal numbers', () => {
      assert.strictEqual(isPositiveInteger('2.5'), false);
      assert.strictEqual(isPositiveInteger('0.1'), false);
      assert.strictEqual(isPositiveInteger(3.14), false);
    });

    test('rejects non-numeric and mixed text', () => {
      assert.strictEqual(isPositiveInteger('twelve'), false);
      assert.strictEqual(isPositiveInteger('12hours'), false);
      assert.strictEqual(isPositiveInteger(''), false);
      assert.strictEqual(isPositiveInteger('   '), false);
      assert.strictEqual(isPositiveInteger(null), false);
      assert.strictEqual(isPositiveInteger(undefined), false);
      assert.strictEqual(isPositiveInteger({}), false);
    });
  });

  describe('isValidNote() validation', () => {
    test('accepts non-empty strings', () => {
      assert.strictEqual(isValidNote('Studied Node.js modules'), true);
      assert.strictEqual(isValidNote('A'), true);
      assert.strictEqual(isValidNote('   trim me   '), true);
    });

    test('rejects empty, whitespace-only, or non-string notes', () => {
      assert.strictEqual(isValidNote(''), false);
      assert.strictEqual(isValidNote('     '), false);
      assert.strictEqual(isValidNote(null), false);
      assert.strictEqual(isValidNote(undefined), false);
      assert.strictEqual(isValidNote(123), false);
    });
  });

  describe('minutesToHours() and roundHours()', () => {
    test('converts minutes accurately', () => {
      assert.strictEqual(minutesToHours(60), 1);
      assert.strictEqual(minutesToHours(120), 2);
      assert.strictEqual(minutesToHours(45), 0.75);
      assert.strictEqual(minutesToHours(30), 0.5);
      assert.strictEqual(minutesToHours(15), 0.25);
    });

    test('rounds display hours to 2 decimal places', () => {
      assert.strictEqual(roundHours(1), 1);
      assert.strictEqual(roundHours(0.75), 0.75);
      assert.strictEqual(roundHours(10 / 60), 0.17); // 0.16666... -> 0.17
      assert.strictEqual(roundHours(2.50001), 2.5);
    });
  });

  describe('calculateStudyPlan() - Project 1 Boundary Cases', () => {
    test('case: 30 12 -> 3 weeks, 6 final-week hours', () => {
      const plan = calculateStudyPlan(30, 12);
      assert.deepStrictEqual(plan, {
        totalHours: 30,
        weeklyHours: 12,
        totalWeeks: 3,
        finalWeekHours: 6,
      });
    });

    test('case: 24 12 (exact multiple) -> 2 weeks, 12 final-week hours', () => {
      const plan = calculateStudyPlan(24, 12);
      assert.deepStrictEqual(plan, {
        totalHours: 24,
        weeklyHours: 12,
        totalWeeks: 2,
        finalWeekHours: 12, // Must not be 0
      });
    });

    test('case: 5 12 (less than 1 week) -> 1 week, 5 final-week hours', () => {
      const plan = calculateStudyPlan(5, 12);
      assert.deepStrictEqual(plan, {
        totalHours: 5,
        weeklyHours: 12,
        totalWeeks: 1,
        finalWeekHours: 5,
      });
    });

    test('case: 1 1 -> 1 week, 1 final-week hour', () => {
      const plan = calculateStudyPlan(1, 1);
      assert.deepStrictEqual(plan, {
        totalHours: 1,
        weeklyHours: 1,
        totalWeeks: 1,
        finalWeekHours: 1,
      });
    });
  });

  describe('calculateAccumulatedMinutes()', () => {
    test('returns 0 for empty or invalid sessions', () => {
      assert.strictEqual(calculateAccumulatedMinutes([]), 0);
      assert.strictEqual(calculateAccumulatedMinutes(null), 0);
      assert.strictEqual(calculateAccumulatedMinutes(undefined), 0);
    });

    test('sums minutes across single and multiple sessions', () => {
      assert.strictEqual(calculateAccumulatedMinutes([{ minutes: 45 }]), 45);
      assert.strictEqual(
        calculateAccumulatedMinutes([
          { minutes: 45 },
          { minutes: 75 },
          { minutes: 30 },
        ]),
        150
      );
    });
  });

  describe('calculateSummary()', () => {
    test('empty history: 0 sessions completed', () => {
      const summary = calculateSummary([], 30, 12);
      assert.strictEqual(summary.sessionCount, 0);
      assert.strictEqual(summary.accumulatedMinutes, 0);
      assert.strictEqual(summary.completedHours, 0);
      assert.strictEqual(summary.remainingHours, 30);
      assert.strictEqual(summary.remainingWeeks, 3);
      assert.strictEqual(summary.finalWeekHours, 6);
      assert.strictEqual(summary.isCompleted, false);
    });

    test('partial goal: partial hours logged', () => {
      const sessions = [
        { minutes: 60 },
        { minutes: 60 },
      ]; // 2 hours completed
      const summary = calculateSummary(sessions, 30, 12);
      assert.strictEqual(summary.sessionCount, 2);
      assert.strictEqual(summary.accumulatedMinutes, 120);
      assert.strictEqual(summary.completedHours, 2);
      assert.strictEqual(summary.remainingHours, 28);
      assert.strictEqual(summary.remainingWeeks, 3); // ceil(28 / 12) = 3
      assert.strictEqual(summary.finalWeekHours, 4); // 28 % 12 = 4
      assert.strictEqual(summary.isCompleted, false);
    });

    test('partial goal with fractional remaining hours', () => {
      const sessions = [{ minutes: 45 }]; // 0.75 hours completed
      const summary = calculateSummary(sessions, 30, 12);
      assert.strictEqual(summary.completedHours, 0.75);
      assert.strictEqual(summary.remainingHours, 29.25);
      assert.strictEqual(summary.remainingWeeks, 3); // ceil(29.25 / 12) = 3
      assert.strictEqual(summary.finalWeekHours, 5.25); // 29.25 % 12 = 5.25
      assert.strictEqual(summary.isCompleted, false);
    });

    test('exact completed goal: completed equals goal', () => {
      const sessions = [{ minutes: 600 }]; // 10 hours completed
      const summary = calculateSummary(sessions, 10, 5);
      assert.strictEqual(summary.completedHours, 10);
      assert.strictEqual(summary.remainingHours, 0);
      assert.strictEqual(summary.remainingWeeks, 0);
      assert.strictEqual(summary.finalWeekHours, 0);
      assert.strictEqual(summary.isCompleted, true);
    });

    test('overcompleted goal: completed exceeds goal', () => {
      const sessions = [{ minutes: 750 }]; // 12.5 hours completed
      const summary = calculateSummary(sessions, 10, 5);
      assert.strictEqual(summary.completedHours, 12.5);
      assert.strictEqual(summary.remainingHours, 0);
      assert.strictEqual(summary.remainingWeeks, 0);
      assert.strictEqual(summary.finalWeekHours, 0);
      assert.strictEqual(summary.isCompleted, true);
    });
  });
});
