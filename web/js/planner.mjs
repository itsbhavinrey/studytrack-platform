/**
 * Weekly planner (web/js/planner.mjs) - Project 5.
 *
 * Connects the form in index.html to the shared Project 1 calculation module.
 * Browser primitives only: addEventListener, preventDefault, textContent,
 * createElement. No framework, no innerHTML, no browser storage.
 *
 * Lifecycle: index.html loads this file once with <script type="module">.
 * A module runs once per document, and wirePlanner() is called once at the
 * bottom, so the form gets exactly one "submit" and one "reset" listener.
 */

import {
  pluralize,
  validatePlanInput,
  calculateStudyPlan,
  weeklyBreakdown,
} from './calculation.mjs';

// Plans longer than a year get a sentence instead of hundreds of table rows.
const MAX_TABLE_WEEKS = 52;

// validatePlanInput() keys -> ids of the input and its error message.
const FIELDS = [
  { key: 'goalName', inputId: 'goal-name', errorId: 'goal-name-error' },
  { key: 'totalHours', inputId: 'total-hours', errorId: 'total-hours-error' },
  { key: 'weeklyHours', inputId: 'weekly-hours', errorId: 'weekly-hours-error' },
];

// Counts how many times wirePlanner() has run in this document. It should be
// 1; the number appears in every log line so a duplicate registration shows
// up as two different handler numbers for one submit.
let handlersCreated = 0;

/**
 * Shows or clears one field's inline error.
 * The error is tied to its input with aria-describedby (listed before any
 * hint, so it is read first) and the input is marked aria-invalid.
 */
function setFieldError(field, message) {
  field.error.textContent = message || '';
  const describedBy = message ? [field.error.id, ...field.hintIds] : field.hintIds;
  if (describedBy.length > 0) {
    field.input.setAttribute('aria-describedby', describedBy.join(' '));
  } else {
    field.input.removeAttribute('aria-describedby');
  }
  if (message) {
    field.input.setAttribute('aria-invalid', 'true');
  } else {
    field.input.removeAttribute('aria-invalid');
  }
}

/** One sentence that describes the plan; read out by the live region. */
function describePlan(goalName, plan) {
  return (
    `Plan for "${goalName}": ${pluralize(plan.totalHours, 'hour')} at ` +
    `${pluralize(plan.weeklyHours, 'hour')} per week takes ` +
    `${pluralize(plan.totalWeeks, 'week')}, with ` +
    `${pluralize(plan.finalWeekHours, 'hour')} in the final week.`
  );
}

/** Small helper: an element whose content is plain text, never HTML. */
function textElement(tag, text, attributes = {}) {
  const el = document.createElement(tag);
  el.textContent = text;
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  return el;
}

/** Builds the week-by-week table (or a sentence for very long plans). */
function buildPlanTable(goalName, plan) {
  if (plan.totalWeeks > MAX_TABLE_WEEKS) {
    return textElement(
      'p',
      `The week-by-week table is shown for plans of up to ${MAX_TABLE_WEEKS} weeks; ` +
        `this plan has ${plan.totalWeeks}.`,
    );
  }

  const table = document.createElement('table');
  table.className = 'plan';
  table.append(textElement('caption', `Week-by-week plan for "${goalName}"`));

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.append(
    textElement('th', 'Week', { scope: 'col' }),
    textElement('th', 'Hours', { scope: 'col' }),
  );
  head.append(headRow);

  const body = document.createElement('tbody');
  weeklyBreakdown(plan).forEach((hours, index) => {
    const row = document.createElement('tr');
    row.append(textElement('th', String(index + 1), { scope: 'row' }), textElement('td', String(hours)));
    body.append(row);
  });

  const foot = document.createElement('tfoot');
  const footRow = document.createElement('tr');
  footRow.append(
    textElement('th', 'Total', { scope: 'row' }),
    textElement('td', `${plan.totalHours} in ${pluralize(plan.totalWeeks, 'week')}`),
  );
  foot.append(footRow);

  table.append(head, body, foot);
  return table;
}

/**
 * Registers the planner's event listeners on a form: one per action.
 *
 * The two handlers defined inside are closures: they keep using `fields`,
 * `status`, `result`, `handlerNumber` and `runs` after wirePlanner() has
 * returned. The element lookups happen once here, not on every event, and
 * `runs` is private state that only these handlers can change.
 *
 * @param {HTMLFormElement} form - The planner form
 */
export function wirePlanner(form) {
  const fields = FIELDS.map(({ key, inputId, errorId }) => {
    const input = form.querySelector(`#${inputId}`);
    // Hints present in the HTML (e.g. "Whole hours, for example 30.").
    const hintIds = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    return { key, input, error: form.querySelector(`#${errorId}`), hintIds };
  });
  const status = document.getElementById('plan-status');
  const result = document.getElementById('plan-result');
  const handlerNumber = ++handlersCreated;
  let runs = 0;

  function clearResult() {
    result.replaceChildren();
    result.hidden = true;
  }

  function onSubmit(event) {
    // Stop the browser's default action: a GET request that reloads the page
    // with the field values in the query string.
    event.preventDefault();
    runs += 1;
    console.info(`[planner] submit handled by handler #${handlerNumber} (run ${runs})`);

    const raw = Object.fromEntries(fields.map((f) => [f.key, f.input.value]));
    const check = validatePlanInput(raw);
    for (const field of fields) setFieldError(field, check.errors[field.key]);

    if (!check.ok) {
      clearResult();
      const invalid = fields.filter((f) => check.errors[f.key]);
      status.textContent =
        `Plan not updated: ${pluralize(invalid.length, 'field')} ` +
        `${invalid.length === 1 ? 'needs' : 'need'} correcting.`;
      // Moving focus makes a screen reader read the field's label, its
      // "invalid" state and the error message tied to it.
      invalid[0].input.focus();
      return;
    }

    const { goalName, totalHours, weeklyHours } = check.values;
    const plan = calculateStudyPlan(totalHours, weeklyHours);
    status.textContent = describePlan(goalName, plan);
    result.replaceChildren(buildPlanTable(goalName, plan));
    result.hidden = false;
  }

  // The "reset" event fires before the browser empties the inputs, and the
  // native reset does the emptying, so this handler only clears what the
  // planner itself added.
  function onReset() {
    console.info(`[planner] reset handled by handler #${handlerNumber}`);
    for (const field of fields) setFieldError(field, '');
    clearResult();
    status.textContent = '';
    fields[0].input.focus();
  }

  form.addEventListener('submit', onSubmit);
  form.addEventListener('reset', onReset);
}

wirePlanner(document.getElementById('planner-form'));
