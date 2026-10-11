#!/usr/bin/env node
// Project 6 browser checks for the shared study log, in real headless Chrome
// against a real server process (node server/main.mjs).
//
// Usage: node scripts/check-study-log.mjs [--screenshots <dir>] [--keep-data]
//        (npm run test:browser:log)
//
// It starts the server as a child process on a free port with a temporary
// data file and --write-delay-ms 400 (so a save stays "pending" long enough
// to click twice, and two tabs can overlap), opens two tabs, and checks:
//   1. empty and loading states;
//   2. tab A saves, tab B sees the record after a reload and after Refresh;
//   3. double click + Enter while a save is pending -> one record;
//   4. two tabs saving at once -> one 409, the client retries, both stored;
//   5. server restart -> both tabs still see every record;
//   6. outage drill: stop the server (SIGINT), submit -> a recoverable
//      message, no endless "Saving..."; restart; Try again -> exactly one
//      new record;
//   7. lost response: the server saves but the browser never gets the
//      answer (CDP Fetch.failRequest); Try again -> "Already saved", no
//      duplicate;
//   8. hung server: the request never completes -> after 8 s a timeout
//      message, button usable again.
// Prints one JSON report on stdout, PASS/FAIL lines on stderr, exits 1 on
// any failure.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage, closeChrome } from './lib/cdp.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const shotsAt = process.argv.indexOf('--screenshots');
const screenshotDir = shotsAt > -1 ? process.argv[shotsAt + 1] : null;
const WRITE_DELAY_MS = 400;

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
  process.stderr.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}\n`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

// ---- the server as a real child process ---------------------------------

const dataDir = mkdtempSync(join(tmpdir(), 'studytrack-log-check-'));
const dataFile = join(dataDir, 'sessions.json');
const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const serverLog = [];
let server = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      ['server/main.mjs', '--port', String(port), '--data', dataFile, '--write-delay-ms', String(WRITE_DELAY_MS)],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let buf = '';
    const onData = (chunk) => {
      for (const line of String(chunk).split('\n').filter(Boolean)) serverLog.push(line.replace(dataDir, '<tmp>'));
      buf += chunk;
      if (buf.includes('listening on')) resolve(proc);
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', reject);
    setTimeout(() => reject(new Error('server did not start')), 10000);
  });
}

function stopServer() {
  const proc = server;
  server = null;
  return new Promise((resolve) => {
    proc.on('exit', (code, signal) => resolve({ code, signal }));
    proc.kill('SIGINT');
  });
}

const stored = () => JSON.parse(readFileSync(dataFile, 'utf8'));

// ---- a tab -----------------------------------------------------------------

async function tab(chrome, name) {
  const page = await openPage(chrome.port);
  const logs = [];
  page.on('Runtime.consoleAPICalled', (p) => {
    logs.push(p.args.map((a) => a.value ?? a.description).join(' '));
  });
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

  const t = {
    name,
    page,
    logs,
    async eval(expression) {
      const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || expression);
      return r.result.value;
    },
    async waitFor(expression, timeout = 5000) {
      const end = Date.now() + timeout;
      for (;;) {
        if (await t.eval(expression)) return true;
        if (Date.now() > end) return false;
        await sleep(50);
      }
    },
    async open() {
      const loaded = page.once('Page.loadEventFired');
      await page.send('Page.navigate', { url: `${origin}/studytrack-platform/log.html` });
      await loaded;
      await t.waitFor(`!document.getElementById('sessions-state').textContent.startsWith('Loading')`);
    },
    async reload() {
      const loaded = page.once('Page.loadEventFired');
      await page.send('Page.reload', { ignoreCache: true });
      await loaded;
      await t.waitFor(`!document.getElementById('sessions-state').textContent.startsWith('Loading')`);
    },
    async type(selector, text) {
      await t.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select(); })()`);
      await page.send('Input.insertText', { text });
    },
    async click(selector) {
      const box = await t.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await page.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
      }
    },
    async enter() {
      const k = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 };
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...k, text: '\r' });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
    },
    state() {
      return t.eval(`({
        save: document.getElementById('save-status').textContent,
        list: document.getElementById('sessions-state').textContent,
        ids: [...document.querySelectorAll('#sessions-list li')].map((li) => Number(li.dataset.id)),
        notes: [...document.querySelectorAll('#sessions-list .session-note')].map((p) => p.textContent),
        saveDisabled: document.getElementById('save-button').disabled,
        saveLabel: document.getElementById('save-button').textContent,
        retryVisible: !document.getElementById('retry-save').hidden,
        minutes: document.getElementById('session-minutes').value,
        note: document.getElementById('session-note').value,
      })`);
    },
    async shot(file, width = 1280) {
      if (!screenshotDir) return;
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(screenshotDir, file), Buffer.from(data, 'base64'));
      await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    },
  };
  return t;
}

async function save(t, minutes, note) {
  await t.type('#session-minutes', String(minutes));
  await t.type('#session-note', note);
  await t.click('#save-button');
}

// Saved (or replayed) AND the list reload that follows has finished.
const savedText = `(() => {
  const save = document.getElementById('save-status').textContent;
  const list = document.getElementById('sessions-state').textContent;
  return (save.startsWith('Saved') || save.startsWith('Already')) && !list.startsWith('Loading');
})()`;

// ---- run ---------------------------------------------------------------------

if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
server = await startServer();
const chrome = await launchChrome();
const report = { origin, writeDelayMs: WRITE_DELAY_MS };

try {
  const A = await tab(chrome, 'A');
  const B = await tab(chrome, 'B');

  // 1. Loading and empty states.
  await A.page.send('Network.enable');
  await A.page.send('Network.emulateNetworkConditions', { offline: false, latency: 800, downloadThroughput: -1, uploadThroughput: -1 });
  await A.page.send('Page.navigate', { url: `${origin}/studytrack-platform/log.html` });
  const sawLoading = await A.waitFor(`document.getElementById('sessions-state')?.textContent === 'Loading sessions...'`, 8000);
  await A.shot('log-loading-1280.png');
  check('list shows a loading state while GET /api/sessions is pending', sawLoading);
  await A.page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await A.waitFor(`document.getElementById('sessions-state').textContent.startsWith('No sessions')`, 8000);
  await B.open();
  const empty = await B.state();
  check('empty log shows the empty state', empty.list.startsWith('No sessions logged yet') && empty.ids.length === 0, empty.list);
  await B.shot('log-empty-1280.png');

  // 2. Two tabs share one log.
  await save(A, 45, 'Node http module');
  await A.waitFor(savedText);
  const afterSave = await A.state();
  check('tab A: save shows success and lists the record', afterSave.save === 'Saved session #1: 45 minutes.' && afterSave.ids.join() === '1', afterSave);
  check('tab A: the form is cleared after success', afterSave.minutes === '' && afterSave.note === '');
  const bBefore = await B.state();
  check('tab B: does not change by itself (no polling)', bBefore.ids.length === 0);
  await B.reload();
  const bReloaded = await B.state();
  check('tab B: after a reload shows the record saved in tab A', bReloaded.ids.join() === '1' && bReloaded.notes[0] === 'Node http module', bReloaded);

  await save(B, 30, 'REST status codes');
  await B.waitFor(savedText);
  await A.click('#refresh-sessions');
  await A.waitFor(`document.querySelectorAll('#sessions-list li').length === 2`);
  const [a2, b2] = [await A.state(), await B.state()];
  check('both tabs show the same records after refresh', a2.ids.join() === '2,1' && b2.ids.join() === '2,1' && a2.notes.join() === b2.notes.join(), { A: a2.ids, B: b2.ids });
  await A.shot('log-tab-a-1280.png');
  await B.shot('log-tab-b-1280.png');
  await B.shot('log-tab-b-360.png', 360);

  // 3. Double submission while pending.
  await A.type('#session-minutes', '20');
  await A.type('#session-note', 'Double click test');
  await A.click('#save-button');
  await A.click('#save-button');
  await A.enter();
  // A disabled submit button already blocks clicks and implicit submission
  // (Enter). requestSubmit() bypasses the button, so it reaches the handler's
  // own in-flight guard.
  await A.eval(`document.getElementById('session-form').requestSubmit()`);
  const pending = await A.state();
  await A.shot('log-pending-1280.png');
  check('pending save disables the button and says "Saving..."', pending.saveDisabled && pending.saveLabel === 'Saving...', pending);
  await A.waitFor(savedText);
  const afterDouble = stored().filter((s) => s.note === 'Double click test');
  check('double click + Enter while pending stores exactly one record', afterDouble.length === 1, stored().map((s) => s.note));
  report.doubleSubmitLogs = A.logs.filter((l) => l.includes('submit'));
  check('a submit event during the pending save is ignored by the in-flight guard', A.logs.some((l) => l.includes('ignored: a save is already pending')), report.doubleSubmitLogs);

  // 4. Two tabs save at the same moment: one gets 409, retries, both stored.
  await A.type('#session-minutes', '15');
  await A.type('#session-note', 'Overlap from tab A');
  await B.type('#session-minutes', '25');
  await B.type('#session-note', 'Overlap from tab B');
  const beforeOverlap = serverLog.length;
  await Promise.all([A.click('#save-button'), B.click('#save-button')]);
  const sawRetry = await Promise.race([
    A.waitFor(`document.getElementById('save-status').textContent.startsWith('The log is busy')`, 3000).then((ok) => ok && 'A'),
    B.waitFor(`document.getElementById('save-status').textContent.startsWith('The log is busy')`, 3000).then((ok) => ok && 'B'),
  ]);
  await A.waitFor(savedText, 8000);
  await B.waitFor(savedText, 8000);
  report.overlapServerLog = serverLog.slice(beforeOverlap).filter((l) => l.startsWith('POST'));
  const overlapNotes = stored().map((s) => s.note).filter((n) => n.startsWith('Overlap'));
  check('overlapping saves: the server answered one 409', report.overlapServerLog.some((l) => l.includes('-> 409')), report.overlapServerLog);
  check('overlapping saves: the client said it was retrying', Boolean(sawRetry), sawRetry);
  check('overlapping saves: both records stored, none lost', overlapNotes.length === 2, overlapNotes);

  // 5. Restart.
  const countBeforeRestart = stored().length;
  report.stop1 = await stopServer();
  server = await startServer();
  await A.reload();
  await B.reload();
  const [a5, b5] = [await A.state(), await B.state()];
  check('after a server restart both tabs list every record', a5.ids.length === countBeforeRestart && a5.ids.join() === b5.ids.join(), { stored: countBeforeRestart, A: a5.ids, B: b5.ids });

  // 6. Outage drill: stop the server with the page open.
  report.stop2 = await stopServer();
  await save(A, 40, 'Saved during the outage');
  const recovered = await A.waitFor(`document.getElementById('save-status').textContent.startsWith('Not saved')`, 10000);
  const down = await A.state();
  await A.shot('log-server-down-1280.png');
  await A.shot('log-server-down-360.png', 360);
  check('server down: a recoverable message replaces "Saving..."', recovered && down.save.includes('could not be reached') && !down.saveDisabled && down.saveLabel === 'Save session', down.save);
  check('server down: the typed values are kept and Try again is offered', down.minutes === '40' && down.note === 'Saved during the outage' && down.retryVisible);
  report.outageConsole = A.logs.filter((l) => l.includes('save failed') || l.includes('POST'));
  const countDuringOutage = stored().length;
  server = await startServer();
  await A.click('#retry-save');
  await A.waitFor(savedText, 8000);
  const up = await A.state();
  await A.shot('log-recovered-1280.png');
  const outageNotes = stored().filter((s) => s.note === 'Saved during the outage');
  check('after restart, Try again saves exactly one record', outageNotes.length === 1 && stored().length === countDuringOutage + 1 && up.save.startsWith('Saved session #'), { save: up.save, count: outageNotes.length });

  // 7. Lost response: saved on the server, but the browser sees a network error.
  await A.page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/sessions', requestStage: 'Response' }] });
  // 'drop': fail the next POST's response; 'hang': never answer POSTs.
  let fetchMode = 'drop';
  A.page.on('Fetch.requestPaused', (p) => {
    if (p.request.method === 'POST' && fetchMode === 'drop') {
      fetchMode = 'pass';
      A.page.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'ConnectionReset' });
    } else if (p.request.method === 'POST' && fetchMode === 'hang') {
      // Leave it paused: the browser waits until its own timeout fires.
    } else {
      A.page.send('Fetch.continueRequest', { requestId: p.requestId });
    }
  });
  const countBeforeLost = stored().length;
  await save(A, 35, 'Response lost on the way back');
  await A.waitFor(`document.getElementById('save-status').textContent.startsWith('Not saved')`, 10000);
  const lost = await A.state();
  const storedAfterLost = stored().length;
  await A.click('#retry-save');
  await A.waitFor(savedText, 8000);
  const replay = await A.state();
  await A.page.send('Fetch.disable');
  const lostNotes = stored().filter((s) => s.note === 'Response lost on the way back');
  check('lost response: the server had stored it, the page showed "Not saved"', storedAfterLost === countBeforeLost + 1 && lost.save.startsWith('Not saved'), lost.save);
  check('lost response: Try again reports "Already saved" and adds no duplicate', lostNotes.length === 1 && replay.save.startsWith('Already saved as session #'), { save: replay.save, count: lostNotes.length });

  // 8. Hung request: never answered -> timeout message after 8 s.
  fetchMode = 'hang';
  await A.page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/sessions', requestStage: 'Request' }] });
  const started = Date.now();
  await save(A, 10, 'Hung request');
  const timedOut = await A.waitFor(`document.getElementById('save-status').textContent.includes('did not answer within 8 seconds')`, 12000);
  const hung = await A.state();
  check('hung request: a timeout message after about 8 s, button usable again', timedOut && !hung.saveDisabled && Date.now() - started >= 7500, { ms: Date.now() - started, save: hung.save });
  await A.page.send('Fetch.disable');

  // No inline handlers, one listener per action.
  const listeners = await (async () => {
    const { result } = await A.page.send('Runtime.evaluate', { expression: `document.getElementById('session-form')` });
    const { listeners: l } = await A.page.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    return l.map((x) => x.type);
  })();
  check('the form has exactly one submit listener', listeners.filter((t) => t === 'submit').length === 1, listeners);

  report.finalRecords = stored().map(({ id, minutes, note }) => ({ id, minutes, note }));
  report.serverLog = serverLog;
} finally {
  if (server) report.finalStop = await stopServer();
  await closeChrome(chrome);
  if (!process.argv.includes('--keep-data')) rmSync(dataDir, { recursive: true, force: true });
}

report.checks = checks;
report.ok = checks.every((c) => c.ok);
console.log(JSON.stringify(report, null, 2));
const passed = checks.filter((c) => c.ok).length;
process.stderr.write(`\n${passed}/${checks.length} study-log browser checks passed\n`);
process.exit(report.ok ? 0 : 1);
