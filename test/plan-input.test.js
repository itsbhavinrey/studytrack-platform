/**
 * Project 5: the planner form applies Project 1's input rules.
 *
 * The cases mirror test/acceptance.js: each P1 command-line argument becomes a
 * form field, a missing argument becomes an empty field and an extra argument
 * becomes extra text inside the field.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { validatePlanInput, calculateStudyPlan, weeklyBreakdown } = require('../src/calculation');

const form = (totalHours, weeklyHours, goalName = 'Learn the DOM') => ({ goalName, totalHours, weeklyHours });

describe('validatePlanInput() with the P1 cases', () => {
  const valid = [
    ['30', '12', 3, 6],
    ['24', '12', 2, 12],
    ['5', '12', 1, 5],
    ['1', '1', 1, 1],
  ];
  for (const [total, weekly, weeks, finalWeek] of valid) {
    test(`accepts ${total} / ${weekly} -> ${weeks} weeks, final week ${finalWeek}`, () => {
      const result = validatePlanInput(form(total, weekly));
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.errors, {});
      const plan = calculateStudyPlan(result.values.totalHours, result.values.weeklyHours);
      assert.strictEqual(plan.totalWeeks, weeks);
      assert.strictEqual(plan.finalWeekHours, finalWeek);
    });
  }

  const invalid = [
    // [P1 command line, total field, weekly field, field that must be in error]
    ['0 12', '0', '12', 'totalHours'],
    ['30 0', '30', '0', 'weeklyHours'],
    ['-5 12', '-5', '12', 'totalHours'],
    ['30 2.5', '30', '2.5', 'weeklyHours'],
    ['30 twelve', '30', 'twelve', 'weeklyHours'],
    ['30 12hours', '30', '12hours', 'weeklyHours'],
    ['30 (missing)', '30', '', 'weeklyHours'],
    ['30 12 4 (extra)', '30', '12 4', 'weeklyHours'],
  ];
  for (const [p1, total, weekly, field] of invalid) {
    test(`rejects P1 case "${p1}" on ${field} only`, () => {
      const result = validatePlanInput(form(total, weekly));
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.values, null);
      assert.deepStrictEqual(Object.keys(result.errors), [field]);
    });
  }
});

describe('validatePlanInput() form-specific rules', () => {
  test('trims surrounding whitespace like the shell does', () => {
    const result = validatePlanInput(form(' 30 ', '\t12\n', '  Learn the DOM  '));
    assert.deepStrictEqual(result.values, { goalName: 'Learn the DOM', totalHours: 30, weeklyHours: 12 });
  });

  test('requires a goal name that is not just spaces', () => {
    assert.deepStrictEqual(Object.keys(validatePlanInput(form('30', '12', '   ')).errors), ['goalName']);
  });

  test('reports every invalid field at once', () => {
    const result = validatePlanInput({ goalName: '', totalHours: 'abc', weeklyHours: '' });
    assert.deepStrictEqual(Object.keys(result.errors).sort(), ['goalName', 'totalHours', 'weeklyHours']);
  });

  test('distinguishes an empty field from an invalid one', () => {
    assert.match(validatePlanInput(form('', '12')).errors.totalHours, /^Enter the total hours/);
    assert.match(validatePlanInput(form('1e2', '12')).errors.totalHours, /positive whole number/);
  });

  test('keeps markup in the goal name as plain text (escaping is the DOM\'s job)', () => {
    const name = '<img src=x onerror=alert(1)>';
    assert.strictEqual(validatePlanInput(form('30', '12', name)).values.goalName, name);
  });
});

describe('weeklyBreakdown()', () => {
  test('gives the weekly hours to every week but the last', () => {
    assert.deepStrictEqual(weeklyBreakdown(calculateStudyPlan(30, 12)), [12, 12, 6]);
  });
  test('exact multiples end on a full week', () => {
    assert.deepStrictEqual(weeklyBreakdown(calculateStudyPlan(24, 12)), [12, 12]);
  });
  test('the weeks add up to the total hours', () => {
    const weeks = weeklyBreakdown(calculateStudyPlan(1000, 7));
    assert.strictEqual(weeks.length, 143);
    assert.strictEqual(weeks.reduce((a, b) => a + b, 0), 1000);
  });
});
