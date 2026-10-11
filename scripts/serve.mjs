#!/usr/bin/env node
// Serve web/ locally the way GitHub Pages serves it.
//
// Usage: node scripts/serve.mjs [--port 8080] [--host 127.0.0.1]
//        then open http://127.0.0.1:8080/studytrack-platform/
// Other scripts can import { startServer } (check-planner.mjs does).
//
// Why a server at all: since Project 5 the page loads ES modules
// (<script type="module">). Browsers refuse module scripts from file:// URLs,
// because a file:// page has an opaque ("null") origin and module loading is
// subject to CORS. Over http:// the page and its modules share one origin.
//
// Why under /studytrack-platform/: that is the path GitHub Pages uses, so the
// relative URLs in index.html and the root-relative URLs in 404.html resolve
// exactly as they do in production.
//
// Static files only, GET/HEAD only, no packages. Not meant for production.
// For the Project 6 study log with its API, use the app server: npm start.

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { BASE, serveStatic } from '../server/static.mjs';

function option(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
}

// The static handler itself lives in server/static.mjs since Project 6, where
// the app server (npm start) reuses it alongside the API.
async function handle(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/' || pathname === BASE.slice(0, -1))) {
    res.writeHead(301, { Location: BASE }).end();
    return;
  }
  await serveStatic(req, res, pathname);
}

/**
 * Starts the server. Port 0 asks the OS for any free port.
 * @returns {Promise<{ server: import('node:http').Server, url: string }>}
 */
export function startServer({ port = 8080, host = '127.0.0.1', log = true } = {}) {
  const server = createServer((req, res) => {
    handle(req, res)
      .catch((err) => {
        console.error(err);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      })
      .finally(() => {
        if (log) console.log(`${req.method} ${req.url} -> ${res.statusCode}`);
      });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      resolve({ server, url: `http://${host}:${server.address().port}${BASE}` });
    });
  });
}

// Run only when started directly (node scripts/serve.mjs), not when imported.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await startServer({
    port: Number(option('--port', process.env.PORT || 8080)),
    host: option('--host', '127.0.0.1'),
  });
  console.log(`Serving web/ at ${url}`);
}
