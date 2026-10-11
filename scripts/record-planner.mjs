#!/usr/bin/env node
// Project 5: record the planner in headless Chrome.
//
// Usage:
//   node scripts/record-planner.mjs [<url>] --out <dir>
//   Without a URL it serves web/ locally (scripts/serve.mjs) on a free port.
//
// Writes to <dir>:
//   planner-trace.json.gz  A Chrome performance trace (the same file the
//                          DevTools Performance panel saves and loads) of
//                          two interactions, marked with performance.mark():
//                            "submit": click "Plan my weeks" on a valid form
//                            "focus":  press Tab to move focus to "Reset"
//   trace-summary.json     For each interaction: the rendering events
//                          (Recalculate style, Layout, Paint...) with their
//                          durations, and the layout invalidations Chrome
//                          recorded, including the JavaScript line that
//                          caused them.
//   planner-recording.webm A short video of valid, invalid and reset
//                          behaviour, encoded by Chrome itself
//                          (canvas.captureStream + MediaRecorder).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { launchChrome, openPage, closeChrome } from './lib/cdp.mjs';
import { startServer } from './serve.mjs';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const outDir = outAt > -1 ? args[outAt + 1] : null;
const urlArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
if (!outDir) {
  console.error('Usage: node scripts/record-planner.mjs [<url>] --out <dir>');
  process.exit(2);
}
const local = urlArg ? null : await startServer({ port: 0, log: false });
const url = urlArg || local.url;
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function helpers(page) {
  const h = {
    async eval(expression) {
      const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || expression);
      return r.result.value;
    },
    async load(width, height) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      const loaded = page.once('Page.loadEventFired');
      await page.send('Page.navigate', { url });
      await loaded;
    },
    async click(selector) {
      const p = await h.eval(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await page.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
      }
    },
    async tab() {
      const k = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 };
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
    },
    async fill(selector, text) {
      await h.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select(); })()`);
      if (text) await page.send('Input.insertText', { text });
      else {
        const k = { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 };
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
      }
    },
    // Wait until the browser has produced the next frames.
    frames(n = 3) {
      return h.eval(`new Promise((resolve) => { let left = ${n};
        const step = () => (--left ? requestAnimationFrame(step) : setTimeout(resolve, 50));
        requestAnimationFrame(step); })`);
    },
  };
  return h;
}

// ---------------------------------------------------------------------------
// 1. Performance trace
// ---------------------------------------------------------------------------
const CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.stack',
  'disabled-by-default-devtools.timeline.invalidationTracking',
  'blink.user_timing',
  'v8.execute',
  'loading',
];

// Rendering-pipeline events as the Performance panel names them.
const RENDER_EVENTS = {
  UpdateLayoutTree: 'Recalculate style',
  Layout: 'Layout',
  PrePaint: 'Pre-paint',
  Paint: 'Paint',
  Layerize: 'Layerize',
  Commit: 'Commit',
};

async function recordTrace(page, h) {
  await h.load(1280, 900);
  await h.fill('#goal-name', 'Learn the DOM');
  await h.fill('#total-hours', '30');
  await h.fill('#weekly-hours', '12');
  await h.eval("document.getElementById('planner').scrollIntoView()");
  await h.frames();

  const events = [];
  page.on('Tracing.dataCollected', (p) => events.push(...p.value));
  const done = page.once('Tracing.tracingComplete');
  await page.send('Tracing.start', {
    traceConfig: { includedCategories: CATEGORIES, recordMode: 'recordAsMuchAsPossible' },
    transferMode: 'ReportEvents',
  });
  await sleep(300);

  await h.eval("performance.mark('submit:start')");
  await h.click('#planner-form button[type="submit"]');
  await h.frames();
  await h.eval("performance.mark('submit:end')");
  await sleep(300);

  // Focus is on "Plan my weeks" (mouse click: no visible ring). Tab moves it
  // to "Reset", whose :focus-visible outline appears.
  await h.eval("performance.mark('focus:start')");
  await h.tab();
  await h.frames();
  await h.eval("performance.mark('focus:end')");
  await sleep(300);

  await page.send('Tracing.end');
  await done;
  return events;
}

function summarise(events) {
  // Only the page's renderer: the process that recorded our marks.
  const marks = events.filter((e) => e.cat.includes('blink.user_timing') && /^(submit|focus):(start|end)$/.test(e.name));
  const pid = marks[0]?.pid;
  const ts = (name) => marks.find((m) => m.name === name && (m.ph === 'R' || m.ph === 'I' || m.ph === 'b' || m.ph === 'n'))?.ts
    ?? marks.find((m) => m.name === name)?.ts;
  const out = { categories: CATEGORIES, interactions: {} };

  for (const action of ['submit', 'focus']) {
    const start = ts(`${action}:start`);
    const end = ts(`${action}:end`);
    const inWindow = events.filter((e) => e.pid === pid && e.ts >= start && e.ts <= end);
    const pipeline = inWindow
      .filter((e) => RENDER_EVENTS[e.name] && e.ph === 'X')
      .map((e) => ({
        event: RENDER_EVENTS[e.name],
        atMs: +((e.ts - start) / 1000).toFixed(2),
        durationMs: +((e.dur || 0) / 1000).toFixed(3),
        ...(e.name === 'Layout' && e.args?.beginData
          ? { dirtyObjects: e.args.beginData.dirtyObjects, totalObjects: e.args.beginData.totalObjects, partialLayout: e.args.beginData.partialLayout }
          : {}),
        ...(e.name === 'UpdateLayoutTree' && e.args?.elementCount !== undefined ? { elementCount: e.args.elementCount } : {}),
      }));
    const count = (name) => pipeline.filter((p) => p.event === name).length;
    // Which code made the change: the JavaScript function (FunctionCall)
    // or DOM event (EventDispatch) that was running when it happened.
    const enclosing = (e) => {
      const around = (name) => inWindow.find((o) => o.name === name && o.ph === 'X' && o.tid === e.tid && o.ts <= e.ts && e.ts <= o.ts + o.dur);
      const fn = around('FunctionCall');
      if (fn?.args.data.url) return `${fn.args.data.functionName || '(anonymous)'} (${fn.args.data.url.split('/').pop()}:${fn.args.data.lineNumber})`;
      const ev = around('EventDispatch');
      if (ev) return `browser default action for "${ev.args.data.type}"`;
      if (around('UpdateLayoutTree')) return 'Recalculate style (rendering step, after the script)';
      return 'no script or event running';
    };
    const layoutInvalidations = inWindow
      .filter((e) => e.name === 'LayoutInvalidationTracking')
      .map((e) => ({ reason: e.args.data.reason, node: e.args.data.nodeName, during: enclosing(e) }));
    const styleInvalidations = inWindow
      .filter((e) => e.name === 'StyleInvalidatorInvalidationTracking' || e.name === 'ScheduleStyleInvalidationTracking' || e.name === 'StyleRecalcInvalidationTracking')
      .map((e) => ({ event: e.name, reason: e.args.data.reason || null, node: e.args.data.nodeName || null, during: enclosing(e) }));
    const paintInvalidations = inWindow
      .filter((e) => e.name === 'PaintInvalidationTracking')
      .map((e) => e.args.data.nodeName);
    out.interactions[action] = {
      windowMs: +((end - start) / 1000).toFixed(1),
      counts: Object.fromEntries(Object.values(RENDER_EVENTS).map((n) => [n, count(n)])),
      pipeline,
      layoutInvalidations: dedupe(layoutInvalidations),
      styleInvalidations: dedupe(styleInvalidations).slice(0, 20),
      paintInvalidations: [...new Set(paintInvalidations)].slice(0, 20),
    };
  }
  return out;
}

function dedupe(list) {
  const seen = new Map();
  for (const item of list) {
    const key = JSON.stringify(item);
    seen.set(key, { ...item, times: (seen.get(key)?.times || 0) + 1 });
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// 2. Recording: screenshots of each step, encoded to WebM inside Chrome
// ---------------------------------------------------------------------------
const VIDEO = { width: 900, height: 900, clipHeight: 820, captionHeight: 80 };

async function recordVideo(page, h) {
  await h.load(VIDEO.width, VIDEO.height);
  await h.eval(`(() => { const s = document.getElementById('planner');
    window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 8); })()`);
  const frames = [];
  const shot = async (caption, holdMs) => {
    await h.frames(2);
    const { data } = await page.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 80,
      clip: { x: 0, y: await h.eval('scrollY'), width: VIDEO.width, height: VIDEO.clipHeight, scale: 1 },
    });
    frames.push({ caption, holdMs, data });
  };

  await shot('Empty form', 1200);
  await h.fill('#goal-name', 'Learn the DOM');
  await shot('1. Valid input: goal name typed', 700);
  await h.fill('#total-hours', '30');
  await shot('1. Valid input: total hours 30', 700);
  await h.fill('#weekly-hours', '12');
  await shot('1. Valid input: 12 hours per week', 700);
  await h.click('#planner-form button[type="submit"]');
  await shot('1. Submit: plan shown, page not reloaded', 2600);
  await h.fill('#total-hours', '-5');
  await h.fill('#weekly-hours', 'twelve');
  await shot('2. Invalid input: -5 and "twelve" (P1 cases)', 1000);
  await h.click('#planner-form button[type="submit"]');
  await shot('2. Submit: inline errors, focus on first invalid field', 2600);
  await h.click('#planner-form button[type="reset"]');
  await shot('3. Reset: values, errors and result cleared', 2600);

  // Encode in a blank page of the same browser.
  await page.send('Page.navigate', { url: 'about:blank' });
  await sleep(300);
  const base64 = await h.eval(`(async () => {
    const frames = ${JSON.stringify(frames.map(({ caption, holdMs }) => ({ caption, holdMs })))};
    const images = await Promise.all(${JSON.stringify(frames.map((f) => f.data))}.map((d) => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + d;
      return img.decode().then(() => img);
    }));
    const canvas = document.createElement('canvas');
    canvas.width = ${VIDEO.width};
    canvas.height = ${VIDEO.clipHeight + VIDEO.captionHeight};
    const ctx = canvas.getContext('2d');
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType, videoBitsPerSecond: 600000 });
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise((r) => (recorder.onstop = r));
    const draw = (i) => {
      ctx.fillStyle = '#12324f';
      ctx.fillRect(0, 0, canvas.width, ${VIDEO.captionHeight});
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.fillText(frames[i].caption, 24, ${VIDEO.captionHeight / 2 + 9});
      ctx.drawImage(images[i], 0, ${VIDEO.captionHeight});
    };
    draw(0);
    recorder.start();
    for (let i = 0; i < frames.length; i++) {
      const until = performance.now() + frames[i].holdMs;
      // Redraw while holding so the stream keeps producing frames.
      while (performance.now() < until) {
        draw(i);
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: mimeType });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  })()`);
  return { video: Buffer.from(base64, 'base64'), frames: frames.map((f) => f.caption) };
}

const chrome = await launchChrome();
try {
  const page = await openPage(chrome.port);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  const h = helpers(page);

  const events = await recordTrace(page, h);
  const traceFile = join(outDir, 'planner-trace.json.gz');
  writeFileSync(traceFile, gzipSync(JSON.stringify({ traceEvents: events, metadata: { source: 'scripts/record-planner.mjs', url } })));
  const summary = { url, recordedAt: new Date().toISOString(), traceEvents: events.length, ...summarise(events) };
  writeFileSync(join(outDir, 'trace-summary.json'), JSON.stringify(summary, null, 2) + '\n');

  const { video, frames } = await recordVideo(page, h);
  writeFileSync(join(outDir, 'planner-recording.webm'), video);

  console.log(JSON.stringify({ url, traceFile, traceEvents: events.length, videoBytes: video.length, frames, interactions: Object.fromEntries(Object.entries(summary.interactions).map(([k, v]) => [k, v.counts])) }, null, 2));
  page.close();
} finally {
  await closeChrome(chrome);
  local?.server.close();
}
