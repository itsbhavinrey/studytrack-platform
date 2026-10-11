// Minimal Chrome DevTools Protocol (CDP) helpers shared by the scripts in
// scripts/. Needs Node 22+ (global fetch and WebSocket) and Google Chrome.
// No packages. Set CHROME_PATH if Chrome is not in the default macOS location.
//
// Extracted from check-site.mjs (Project 4) in Project 5 so check-planner.mjs
// and record-planner.mjs drive Chrome the same way.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Start Chrome and wait for the "DevTools listening on ws://..." line.
export function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'studytrack-cdp-'));
  const proc = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    'about:blank',
  ]);
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start')), 15000);
    proc.stderr.on('data', (chunk) => {
      buf += chunk;
      const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ proc, profile, port: new URL(m[1]).port });
      }
    });
    proc.on('error', reject);
  });
}

// Minimal CDP client over one page target's WebSocket.
export async function openPage(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) || []) fn(msg.params);
    }
  };
  return {
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    on(method, fn) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(fn);
    },
    once(method) {
      return new Promise((resolve) => this.on(method, resolve));
    },
    close() {
      ws.close();
    },
  };
}

// Stop Chrome and remove its throwaway profile directory.
export async function closeChrome(chrome) {
  chrome.proc.kill();
  // Give Chrome a moment to release the profile before removing it.
  await new Promise((r) => setTimeout(r, 500));
  rmSync(chrome.profile, { recursive: true, force: true });
}
