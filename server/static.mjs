// Static files from web/, served the way GitHub Pages serves them.
//
// Extracted from scripts/serve.mjs (Project 5) in Project 6 so that both the
// P5 preview server and the P6 app server (server/app.mjs) use one copy.
//
// - Files live under BASE (/studytrack-platform/), the GitHub Pages path, so
//   relative URLs in index.html and the root-relative URLs in 404.html
//   resolve exactly as they do in production.
// - Module scripts need a JavaScript MIME type; browsers refuse a module
//   served as text/plain or application/octet-stream.
// - All file access is promise-based (node:fs/promises): no blocking calls.

import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB_DIR = fileURLToPath(new URL('../web/', import.meta.url));
export const BASE = '/studytrack-platform/';

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

// Map a URL path under BASE to a file inside WEB_DIR, or null if it would
// escape WEB_DIR (for example /studytrack-platform/../package.json).
function toFile(urlPath) {
  let rest;
  try {
    rest = decodeURIComponent(urlPath.slice(BASE.length));
  } catch {
    return null; // malformed %-encoding
  }
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

/**
 * Answers one request for a static file. GET and HEAD only.
 * Unknown paths get web/404.html with status 404, like GitHub Pages.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} pathname - Already parsed from req.url
 */
export async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
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
  await send(res, 404, join(WEB_DIR, '404.html'), req.method);
}
