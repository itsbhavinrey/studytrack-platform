#!/usr/bin/env node
// Serve web/ locally the way GitHub Pages serves it.
//
// Usage: node scripts/serve.mjs [--port 8080] [--host 127.0.0.1]
//        then open http://127.0.0.1:8080/studytrack-platform/
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

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_DIR = fileURLToPath(new URL('../web/', import.meta.url));
const BASE = '/studytrack-platform/';

// Browsers enforce the MIME type of module scripts: a module served as
// text/plain or application/octet-stream is refused.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function option(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
}

// Map a URL path under BASE to a file inside WEB_DIR, or null if it would
// escape WEB_DIR (for example /studytrack-platform/../package.json).
function toFile(urlPath) {
  const rest = decodeURIComponent(urlPath.slice(BASE.length));
  const file = normalize(join(WEB_DIR, rest));
  return file.startsWith(WEB_DIR) || file + sep === WEB_DIR ? file : null;
}

async function send(res, status, file, method) {
  const body = await readFile(file);
  res.writeHead(status, {
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'no-cache',
  });
  res.end(method === 'HEAD' ? undefined : body);
}

async function handle(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  if (pathname === '/' || pathname === BASE.slice(0, -1)) {
    res.writeHead(301, { Location: BASE }).end();
    return;
  }
  let file = pathname.startsWith(BASE) ? toFile(pathname) : null;
  if (file) {
    const info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: pathname + '/' }).end();
        return;
      }
      file = join(file, 'index.html');
    }
    if (await stat(file).then((s) => s.isFile(), () => false)) {
      await send(res, 200, file, req.method);
      return;
    }
  }
  // Like GitHub Pages: unknown paths get web/404.html with status 404.
  await send(res, 404, join(WEB_DIR, '404.html'), req.method);
}

const port = Number(option('--port', process.env.PORT || 8080));
const host = option('--host', '127.0.0.1');
const server = createServer((req, res) => {
  handle(req, res)
    .catch((err) => {
      console.error(err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    })
    .finally(() => console.log(`${req.method} ${req.url} -> ${res.statusCode}`));
});
server.listen(port, host, () => {
  console.log(`Serving web/ at http://${host}:${server.address().port}${BASE}`);
});
