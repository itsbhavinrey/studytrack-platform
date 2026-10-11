#!/usr/bin/env node
// Project 5 browser checks for the weekly planner, in real headless Chrome.
//
// Usage:
//   node scripts/check-planner.mjs [<url>] [--screenshots <dir>]
//   Without a URL it starts scripts/serve.mjs on a free port and checks the
//   local copy of web/ (this is npm run test:browser).
//
// What it does, through the Chrome DevTools Protocol (CDP):
//   1. Every Project 1 input case (4 valid, 8 invalid) typed into the form and
//      submitted with a real mouse click: result or the right inline error,
//      no page reload, exactly one "[planner] submit" log line per submit.
//   2. Markup in the goal name is shown as text, never parsed as HTML.
//   3. Five submit/reset cycles: values, errors and results all clear.
//   4. Keyboard only: Tab order, Enter submits, focus moves to the first
//      invalid field, Space on Reset clears and refocuses the first field.
//   5. Accessibility tree: each invalid input is "invalid" and its computed
//      description is the error text; the result region is a polite status.
//   6. The form has exactly one submit and one reset listener
//      (DOMDebugger.getEventListeners) and no inline on* attributes.
// It prints one JSON report and exits 1 if any check fails.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome, openPage, closeChrome } from './lib/cdp.mjs';
import { startServer } from './serve.mjs';

const shotsAt = process.argv.indexOf('--screenshots');
const screenshotDir = shotsAt > -1 ? process.argv[shotsAt + 1] : null;
const urlArg = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--screenshots');
const local = urlArg ? null : await startServer({ port: 0, log: false });
const url = urlArg || local.url;

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
}

const KEYS = {
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
  Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
  Backspace: { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 },
};

function browser(page) {
  const logs = [];
  let navigations = 0;
  page.on('Runtime.consoleAPICalled', (p) => {
    logs.push(p.args.map((a) => a.value ?? a.description).join(' '));
  });
  page.on('Page.frameNavigated', (p) => {
    if (!p.frame.parentId) navigations += 1;
  });

  const b = {
    logs,
    get navigations() {
      return navigations;
    },
    async eval(expression) {
      const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || expression);
      return r.result.value;
    },
    async key(name, modifiers = 0) {
      const k = KEYS[name];
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, ...k });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, ...k, text: undefined });
    },
    async click(selector) {
      const box = await b.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await page.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
      }
    },
    // Select the field's current text, then type over it (or delete it).
    async fill(selector, text) {
      await b.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select(); })()`);
      if (text === '') await b.key('Backspace');
      else await page.send('Input.insertText', { text });
    },
    async typeHere(text) {
      await page.send('Input.insertText', { text });
    },
    async settle() {
      await b.eval('new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))');
    },
    state() {
      return b.eval(`(() => {
        const field = (id) => {
          const el = document.getElementById(id);
          return {
            value: el.value,
            invalid: el.getAttribute('aria-invalid'),
            describedby: el.getAttribute('aria-describedby'),
            error: document.getElementById(id + '-error').textContent,
          };
        };
        const result = document.getElementById('plan-result');
        return {
          sameDocument: window.__plannerCheck === true,
          status: document.getElementById('plan-status').textContent,
          resultHidden: result.hidden,
          resultRows: [...result.querySelectorAll('tbody tr')].map((tr) => [...tr.cells].map((c) => c.textContent).join(' ')),
          resultElements: result.querySelectorAll('*').length,
          active: document.activeElement.id || document.activeElement.tagName.toLowerCase() + ':' + document.activeElement.textContent.replace(/\s+/g, ' ').trim(),
          fields: { 'goal-name': field('goal-name'), 'total-hours': field('total-hours'), 'weekly-hours': field('weekly-hours') },
        };
      })()`);
    },
    async ax(selector) {
      const { root } = await page.send('DOM.getDocument', { depth: 0 });
      const { nodeId } = await page.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      const { nodes } = await page.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
      const n = nodes[0];
      const props = Object.fromEntries((n.properties || []).map((p) => [p.name, p.value.value]));
      return { role: n.role?.value, name: n.name?.value, description: n.description?.value, ...props };
    },
  };
  return b;
}

async function load(page, b, width = 1280) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url });
  await loaded;
  await b.eval('window.__plannerCheck = true');
  b.logs.length = 0;
}

async function submitCase(b, goal, total, weekly) {
  await b.fill('#goal-name', goal);
  await b.fill('#total-hours', total);
  await b.fill('#weekly-hours', weekly);
  const before = b.logs.length;
  await b.click('#planner-form button[type="submit"]');
  await b.settle();
  const submitLogs = b.logs.slice(before).filter((l) => l.startsWith('[planner] submit'));
  return { state: await b.state(), submitLogs };
}

async function screenshot(page, b, file, width) {
  const rect = await b.eval(`(() => {
    const r = document.getElementById('planner').getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, height: r.height };
  })()`);
  const shot = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: Math.max(0, rect.y - 16), width, height: Math.ceil(rect.height + 32), scale: 1 },
  });
  mkdirSync(screenshotDir, { recursive: true });
  writeFileSync(join(screenshotDir, file), Buffer.from(shot.data, 'base64'));
}

const VALID = [
  ['30', '12', '3 weeks', '6 hours', ['1 12', '2 12', '3 6']],
  ['24', '12', '2 weeks', '12 hours', ['1 12', '2 12']],
  ['5', '12', '1 week', '5 hours', ['1 5']],
  ['1', '1', '1 week', '1 hour', ['1 1']],
];
const INVALID = [
  ['0 12', '0', '12', 'total-hours'],
  ['30 0', '30', '0', 'weekly-hours'],
  ['-5 12', '-5', '12', 'total-hours'],
  ['30 2.5', '30', '2.5', 'weekly-hours'],
  ['30 twelve', '30', 'twelve', 'weekly-hours'],
  ['30 12hours', '30', '12hours', 'weekly-hours'],
  ['30 (missing)', '30', '', 'weekly-hours'],
  ['30 12 4 (extra)', '30', '12 4', 'weekly-hours'],
];

const chrome = await launchChrome();
const report = { url, checkedAt: new Date().toISOString() };
try {
  const page = await openPage(chrome.port);
  const b = browser(page);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('DOM.enable');
  await page.send('Accessibility.enable');
  await load(page, b);

  // 6. Listener inventory and inline handlers.
  const { result: formObj } = await page.send('Runtime.evaluate', { expression: "document.getElementById('planner-form')" });
  const { listeners } = await page.send('DOMDebugger.getEventListeners', { objectId: formObj.objectId });
  const types = listeners.map((l) => l.type).sort();
  check('form has exactly one submit and one reset listener', types.join(',') === 'reset,submit', types);
  const inline = await b.eval(`[...document.querySelectorAll('*')].flatMap((el) =>
    [...el.attributes].filter((a) => /^on/i.test(a.name)).map((a) => el.tagName + '@' + a.name))`);
  check('no inline on* event attributes in the page', inline.length === 0, inline);

  // 1a. Valid P1 cases.
  for (const [total, weekly, weeks, finalWeek, rows] of VALID) {
    const { state, submitLogs } = await submitCase(b, 'Learn the DOM', total, weekly);
    check(
      `valid ${total} / ${weekly}: ${weeks}, final week ${finalWeek}`,
      state.sameDocument &&
        state.status.includes(`takes ${weeks}`) &&
        state.status.includes(`with ${finalWeek} in the final week`) &&
        !state.resultHidden &&
        JSON.stringify(state.resultRows) === JSON.stringify(rows) &&
        Object.values(state.fields).every((f) => f.invalid === null && f.error === '') &&
        submitLogs.length === 1,
      { status: state.status, rows: state.resultRows, submitLogs },
    );
  }

  // 1b. Invalid P1 cases.
  for (const [p1, total, weekly, field] of INVALID) {
    const { state, submitLogs } = await submitCase(b, 'Learn the DOM', total, weekly);
    const f = state.fields[field];
    const others = Object.entries(state.fields).filter(([id]) => id !== field);
    check(
      `invalid P1 "${p1}": error on ${field} only, focus moved there`,
      state.sameDocument &&
        f.invalid === 'true' &&
        f.error.length > 0 &&
        f.describedby.split(' ')[0] === `${field}-error` &&
        others.every(([, o]) => o.invalid === null && o.error === '') &&
        state.active === field &&
        state.resultHidden &&
        state.status === 'Plan not updated: 1 field needs correcting.' &&
        submitLogs.length === 1,
      { error: f.error, status: state.status, active: state.active, submitLogs },
    );
  }

  // 2. User input is text, not HTML.
  const markup = '<img src=x onerror="window.__xss=1"><b>bold</b>';
  const xss = await submitCase(b, markup, '30', '12');
  const injected = await b.eval(
    "({ xss: window.__xss === 1, img: document.querySelectorAll('#planner img, #planner b').length })",
  );
  check(
    'markup in the goal name is displayed as text',
    xss.state.status.startsWith(`Plan for "${markup}"`) && !injected.xss && injected.img === 0,
    { status: xss.state.status, ...injected },
  );

  // 5. Accessibility tree for an error and for the status region.
  await submitCase(b, '', 'abc', '12');
  const goalAx = await b.ax('#goal-name');
  const totalAx = await b.ax('#total-hours');
  const statusAx = await b.ax('#plan-status');
  const s = await b.state();
  check(
    'invalid inputs are exposed as invalid with the error as their description',
    goalAx.invalid === 'true' &&
      goalAx.description === s.fields['goal-name'].error &&
      totalAx.invalid === 'true' &&
      totalAx.description.startsWith(s.fields['total-hours'].error) &&
      s.active === 'goal-name' &&
      s.status === 'Plan not updated: 2 fields need correcting.',
    { goalAx, totalAx },
  );
  check(
    'result region is a polite live region (role status)',
    statusAx.role === 'status' && statusAx.live === 'polite',
    statusAx,
  );
  if (screenshotDir) await screenshot(page, b, 'planner-invalid-1280.png', 1280);

  // 3. Five submit/reset cycles.
  const cycles = [];
  const plans = [['30', '12'], ['24', '12'], ['5', '12'], ['1', '1'], ['100', '7']];
  for (let i = 0; i < 5; i++) {
    const [total, weekly] = plans[i];
    const valid = await submitCase(b, `Cycle ${i + 1}`, total, weekly);
    const invalid = await submitCase(b, `Cycle ${i + 1}`, total, 'x');
    const before = b.logs.length;
    await b.click('#planner-form button[type="reset"]');
    await b.settle();
    const after = await b.state();
    const resetLogs = b.logs.slice(before).filter((l) => l.startsWith('[planner] reset'));
    const ok =
      valid.state.status.startsWith(`Plan for "Cycle ${i + 1}"`) &&
      !valid.state.resultHidden &&
      invalid.state.fields['weekly-hours'].invalid === 'true' &&
      invalid.state.resultHidden &&
      after.sameDocument &&
      after.status === '' &&
      after.resultHidden &&
      after.resultElements === 0 &&
      Object.values(after.fields).every((f) => f.value === '' && f.invalid === null && f.error === '') &&
      after.fields['total-hours'].describedby === 'total-hours-hint' &&
      after.active === 'goal-name' &&
      valid.submitLogs.length === 1 &&
      invalid.submitLogs.length === 1 &&
      resetLogs.length === 1;
    cycles.push({ cycle: i + 1, plan: `${total}/${weekly}`, validStatus: valid.state.status, ok });
  }
  check('five submit/reset cycles stay correct', cycles.every((c) => c.ok), cycles);

  // 1c. A plan longer than the table limit.
  const long = await submitCase(b, 'Long goal', '10000', '1');
  check(
    'a 10000-week plan gives a sentence instead of 10000 rows',
    long.state.status.includes('takes 10000 weeks') && long.state.resultRows.length === 0 && long.state.resultElements === 1,
    long.state.status,
  );

  // 4. Keyboard only, from a fresh load.
  await load(page, b);
  const order = [];
  for (let i = 0; i < 30 && !order.includes('goal-name'); i++) {
    await b.key('Tab');
    order.push(await b.eval("document.activeElement.id || document.activeElement.textContent.replace(/\\s+/g, ' ').trim()"));
  }
  await b.typeHere('Keyboard goal');
  await b.key('Tab');
  await b.typeHere('30');
  await b.key('Tab');
  await b.typeHere('12');
  await b.key('Enter'); // implicit submission from a text field
  await b.settle();
  const kbValid = await b.state();
  await b.eval("document.getElementById('total-hours').focus(); document.getElementById('total-hours').select()");
  await b.key('Backspace');
  await b.key('Tab');
  await b.key('Enter');
  await b.settle();
  const kbInvalid = await b.state();
  // From the invalid field: Tab to weekly hours, Plan my weeks, Reset.
  const route = [];
  for (let i = 0; i < 3; i++) {
    await b.key('Tab');
    route.push(await b.eval("document.activeElement.id || document.activeElement.textContent.replace(/\\s+/g, ' ').trim()"));
  }
  await b.key('Space');
  await b.settle();
  const kbReset = await b.state();
  check(
    'keyboard: Tab reaches the form, Enter submits, focus goes to the invalid field, Space on Reset clears',
    kbValid.status.includes('takes 3 weeks') &&
      kbInvalid.active === 'total-hours' &&
      kbInvalid.fields['total-hours'].error === 'Enter the total hours needed.' &&
      JSON.stringify(route) === JSON.stringify(['weekly-hours', 'Plan my weeks', 'Reset']) &&
      kbReset.active === 'goal-name' &&
      kbReset.status === '' &&
      Object.values(kbReset.fields).every((f) => f.value === '') &&
      kbReset.sameDocument,
    { tabsToGoalName: order.length, tabOrder: order, afterEnter: kbValid.status, invalidFocus: kbInvalid.active, route, afterReset: kbReset.active },
  );

  check('the page never reloaded (one navigation per load)', b.navigations === 2, { navigations: b.navigations });

  if (screenshotDir) {
    for (const width of [360, 1280]) {
      await load(page, b, width);
      await submitCase(b, 'Learn the DOM', '30', '12');
      await screenshot(page, b, `planner-valid-${width}.png`, width);
      if (width === 360) {
        await submitCase(b, '', '2.5', 'twelve');
        await screenshot(page, b, 'planner-invalid-360.png', width);
      }
      const overflow = await b.eval('document.documentElement.scrollWidth > document.documentElement.clientWidth');
      check(`no horizontal scroll at ${width}px with result/errors shown`, !overflow);
    }
  }
  page.close();
} finally {
  await closeChrome(chrome);
  local?.server.close();
}

report.checks = checks;
report.passed = checks.filter((c) => c.ok).length;
report.failed = checks.filter((c) => !c.ok).length;
report.ok = report.failed === 0;
console.log(JSON.stringify(report, null, 2));
for (const c of checks) console.error(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`);
console.error(`\n${report.passed}/${checks.length} browser checks passed`);
process.exit(report.ok ? 0 : 1);
