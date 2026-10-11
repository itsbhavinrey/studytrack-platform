#!/usr/bin/env node
// Inspect a published (or local) page the way the DevTools Network panel does.
//
// Usage:
//   node scripts/check-site.mjs <url> [--widths 360,1280] [--screenshots <dir>] [--prefix <name>]
//
// For each width it opens the page in headless Google Chrome through the Chrome
// DevTools Protocol (CDP), records every request and response (status,
// Content-Type, remote address, protocol, TLS state), measures horizontal
// overflow, and optionally saves a full-page PNG. It prints one JSON report and
// exits 1 if any required resource failed or the page scrolls sideways.
//
// Needs Node 22+ (global fetch and WebSocket) and Google Chrome. No packages.
// Set CHROME_PATH if Chrome is not in the default macOS location.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome, openPage, closeChrome } from './lib/cdp.mjs';

function parseArgs(argv) {
  const opts = { url: null, widths: [360, 1280], screenshots: null, prefix: 'page' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--widths') opts.widths = argv[++i].split(',').map(Number);
    else if (a === '--screenshots') opts.screenshots = argv[++i];
    else if (a === '--prefix') opts.prefix = argv[++i];
    else if (!opts.url) opts.url = a;
  }
  if (!opts.url) {
    console.error('Usage: node scripts/check-site.mjs <url> [--widths 360,1280] [--screenshots <dir>] [--prefix <name>]');
    process.exit(2);
  }
  return opts;
}

async function checkWidth(port, url, width, opts) {
  const page = await openPage(port);
  const requests = new Map();

  page.on('Network.requestWillBeSent', (p) => {
    requests.set(p.requestId, { url: p.request.url, method: p.request.method, type: p.type });
  });
  page.on('Network.responseReceived', (p) => {
    const r = requests.get(p.requestId) || { url: p.response.url };
    const headers = Object.fromEntries(
      Object.entries(p.response.headers).map(([k, v]) => [k.toLowerCase(), v]),
    );
    Object.assign(r, {
      status: p.response.status,
      contentType: headers['content-type'] || null,
      protocol: p.response.protocol,
      remoteAddress: p.response.remoteIPAddress
        ? `${p.response.remoteIPAddress}:${p.response.remotePort}`
        : null,
      securityState: p.response.securityState,
      certificateSubject: p.response.securityDetails?.subjectName || null,
      certificateIssuer: p.response.securityDetails?.issuer || null,
    });
    requests.set(p.requestId, r);
  });
  page.on('Network.loadingFailed', (p) => {
    const r = requests.get(p.requestId) || {};
    r.failed = p.errorText;
    requests.set(p.requestId, r);
  });

  await page.send('Network.enable');
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });

  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url });
  await loaded;
  // Let late requests (e.g. favicon) settle.
  await new Promise((r) => setTimeout(r, 1000));

  const { result } = await page.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const de = document.documentElement;
      const sheets = [...document.styleSheets].map((s) => {
        let rules = null;
        try { rules = s.cssRules.length; } catch (e) { rules = 'unreadable'; }
        return { href: s.href, rules };
      });
      const overflowing = [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 0.5)
        .map((el) => el.tagName.toLowerCase() + (el.className ? '.' + el.className : ''));
      return {
        location: location.href,
        title: document.title,
        innerWidth: window.innerWidth,
        clientWidth: de.clientWidth,
        scrollWidth: de.scrollWidth,
        horizontalScroll: de.scrollWidth > de.clientWidth,
        overflowingElements: overflowing.slice(0, 10),
        stylesheets: sheets,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        bodyFontFamily: getComputedStyle(document.body).fontFamily,
      };
    })()`,
  });

  let screenshot = null;
  if (opts.screenshots) {
    const metrics = await page.send('Page.getLayoutMetrics');
    const height = Math.ceil(metrics.cssContentSize.height);
    const shot = await page.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    mkdirSync(opts.screenshots, { recursive: true });
    screenshot = join(opts.screenshots, `${opts.prefix}-${width}.png`);
    writeFileSync(screenshot, Buffer.from(shot.data, 'base64'));
  }

  page.close();
  const all = [...requests.values()];
  // favicon.ico is requested by the browser itself, not by the page; it is
  // reported but does not count as a required resource.
  const isOptional = (r) => /\/favicon\.ico$/.test(r.url || '');
  const failures = all.filter(
    (r) => !isOptional(r) && (r.failed || !(r.status >= 200 && r.status < 400)),
  );
  return { width, page: result.value, requests: all, failures, screenshot };
}

const opts = parseArgs(process.argv.slice(2));
const chrome = await launchChrome();
const report = { url: opts.url, checkedAt: new Date().toISOString(), widths: [] };
try {
  for (const width of opts.widths) {
    report.widths.push(await checkWidth(chrome.port, opts.url, width, opts));
  }
} finally {
  await closeChrome(chrome);
}

report.ok = report.widths.every((w) => w.failures.length === 0 && !w.page.horizontalScroll);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
