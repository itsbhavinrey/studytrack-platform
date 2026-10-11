// The StudyTrack app server (Project 6): one process, one origin.
//
//   /health                  -> server and storage status (JSON)
//   /api/...                 -> the session API (server/api.mjs)
//   /                        -> redirect to the study log page
//   /studytrack-platform/... -> static files from web/ (server/static.mjs)
//
// "Routing" is plain string comparison on the URL path. Every request goes
// through handle(), which turns any thrown HttpError into its JSON response
// and any other error into a 500, so no request is left without an answer.

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createApi } from './api.mjs';
import { HttpError, sendError, sendJson } from './http-json.mjs';
import { BASE, serveStatic } from './static.mjs';

const require = createRequire(import.meta.url);
const { CorruptDataError, createSessionStore } = require('../src/storage.js');

export const LOG_PAGE = `${BASE}log.html`;

async function health(req, res, store, startedAt) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, 'method_not_allowed', 'Use one of: GET, HEAD.', { headers: { Allow: 'GET, HEAD' } });
  }
  const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);
  try {
    const sessions = await store.list();
    sendJson(req, res, 200, { status: 'ok', storage: 'ok', sessions: sessions.length, uptimeSeconds });
  } catch (err) {
    const storage = err instanceof CorruptDataError ? 'corrupt' : 'unreadable';
    console.error(`[health] storage ${storage}: ${err.message}`);
    sendJson(req, res, 503, { status: 'error', storage, uptimeSeconds });
  }
}

/**
 * Builds the request handler.
 * @param {{ store: object, bodyLimit?: number }} options
 */
export function createApp({ store, bodyLimit }) {
  const api = createApi(store, { bodyLimit });
  const startedAt = Date.now();

  async function route(req, res) {
    let pathname;
    try {
      ({ pathname } = new URL(req.url, 'http://localhost'));
    } catch {
      throw new HttpError(400, 'bad_request', 'The request URL could not be parsed.');
    }

    if (pathname === '/health') return health(req, res, store, startedAt);
    if (pathname === '/api' || pathname.startsWith('/api/')) return api(req, res, pathname);
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/') {
      res.writeHead(302, { Location: LOG_PAGE }).end();
      return;
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname === BASE.slice(0, -1)) {
      res.writeHead(301, { Location: BASE }).end();
      return;
    }
    return serveStatic(req, res, pathname);
  }

  return async function handle(req, res) {
    try {
      await route(req, res);
    } catch (err) {
      if (res.headersSent) {
        console.error(err);
        res.destroy();
      } else if (err instanceof HttpError) {
        sendError(req, res, err);
      } else {
        console.error(err);
        sendError(req, res, new HttpError(500, 'internal_error', 'The server could not complete the request.'));
      }
    }
  };
}

/**
 * Starts the app server.
 * @param {{ port?: number, host?: string, dataFile?: string,
 *           writeDelayMs?: number, bodyLimit?: number, log?: boolean }} [options]
 *   port 0 asks the OS for a free port (tests do this).
 * @returns {Promise<{ server: import('node:http').Server, url: string, store: object, close: () => Promise<void> }>}
 */
export function startApp({ port = 3000, host = '127.0.0.1', dataFile, writeDelayMs = 0, bodyLimit, log = true } = {}) {
  const store = createSessionStore(dataFile, { writeDelayMs });
  const handle = createApp({ store, bodyLimit });

  const server = createServer((req, res) => {
    const started = process.hrtime.bigint();
    if (log) {
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        console.log(`${req.method} ${req.url} -> ${res.statusCode} (${ms.toFixed(1)} ms)`);
      });
    }
    handle(req, res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const url = `http://${host}:${server.address().port}`;
      resolve({
        server,
        url,
        store,
        // Stop accepting connections; resolves when in-flight requests have
        // finished. Idle keep-alive connections are closed (Node 19+).
        close: () => new Promise((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}
