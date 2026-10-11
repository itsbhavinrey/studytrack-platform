# Project 6 learning notes - Shared study log over HTTP

These notes explain what Project 6 built and why, using this repository's code as the example throughout. Read them alongside the code; file paths are relative to the repository root. The evidence (real outputs) is in [report.md](report.md).

## 1. The whole journey in one picture

```text
 Tab A (log.html)                Tab B (log.html)
   study-log.mjs                   study-log.mjs
        |  sessions-api.mjs             |
        |  fetch('/api/sessions')       |
        +---------------+---------------+
                        |  HTTP/1.1 over TCP, 127.0.0.1:3000 (one origin)
                        v
          node server/main.mjs   (one process, one event loop)
            server/app.mjs        route by method + path
              /health           -> health()
              /api/...          -> server/api.mjs  -> validateSessionInput()  (web/js/calculation.mjs)
              /studytrack-platform/... -> server/static.mjs (files from web/)
                        |
                        v
          src/storage.js  createSessionStore()   one writer, rejects overlap
             readFile -> append -> write temp -> fsync -> rename
                        |
                        v
          studytrack-data.json   (same file and format the P2 CLI reads)
```

Before Project 6, each browser had only its own memory: the P5 planner forgot everything on reload, and two tabs could not share anything. Now the state lives in one place (a file owned by one server process), and every tab asks that process for it over HTTP.

## 2. What changed, briefly

| Area | Change |
| --- | --- |
| New server | `server/` holds a `node:http` server: `main.mjs` (start/stop), `app.mjs` (dispatch), `api.mjs` (session resource), `http-json.mjs` (bodies, JSON, errors), `static.mjs` (files, moved out of `scripts/serve.mjs`). `npm start`. |
| Storage | `src/storage.js` keeps its P2 synchronous API for the CLI and gains a promise API for the server: `readSessionsAsync`, `writeSessionsAsync` (atomic), `createSessionStore` (single writer, idempotent add). |
| Shared rules | `validateSessionInput()` in `web/js/calculation.mjs`: one definition of a valid session for the server and the browser. |
| Browser | `web/log.html`, `web/js/study-log.mjs` (page behaviour) and `web/js/sessions-api.mjs` (the only `fetch` caller). `index.html` and the P5 planner are unchanged. |
| Tests | `test/api.test.js` (real server), `test/session-store.test.js`, `test/session-input.test.js`, `test/server-constraints.test.js`, new cases in `test/web.test.js`; `scripts/check-study-log.mjs` for two real Chrome tabs. |

## 3. New topics, explained against this code

### 3.1 The native Node HTTP server runtime

`node:http` gives you a server object and, for every request, two objects. There is no router, no body parser and no JSON helper; Project 6 writes those parts by hand (constraint C1).

```js
// server/app.mjs (startApp)
const server = createServer((req, res) => { ... handle(req, res); });
server.listen(port, host, () => { ... });
```

- **`createServer(listener)`** creates an `http.Server`. Node calls `listener` once per request. One TCP connection can carry many requests one after another (HTTP/1.1 keep-alive, the `Connection: keep-alive` / `Keep-Alive: timeout=5` headers in the curl output).
- **`req` is an `http.IncomingMessage`**. The request line and headers are already parsed when the listener runs: `req.method` (`'POST'`), `req.url` (the path and query exactly as sent, e.g. `/api/sessions?x=1`), and `req.headers` (an object whose keys are **lower-cased**: `req.headers['content-type']`, `req.headers['idempotency-key']`). The **body is not parsed**: `req` is a *readable stream* and the body arrives in chunks (`Buffer`s), possibly after the listener has started running.
- **`res` is an `http.ServerResponse`**: `res.writeHead(status, headers)` sends the status line and headers, `res.end(body)` sends the body and finishes the response. Once headers are sent (`res.headersSent`), you cannot change the status any more; that is why `app.mjs` destroys the socket instead of sending a 500 if an error happens after headers went out.

How this code reads a body (`server/http-json.mjs`, `readJsonBody`):

```js
for await (const chunk of req) {
  received += chunk.length;
  if (received > limit) throw tooLarge();
  chunks.push(chunk);
}
text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
return JSON.parse(text);
```

`for await` uses the stream's async iterator: each loop turn waits (without blocking anything else) for the next chunk. The byte count is checked on every chunk because `Content-Length` can be missing (a chunked body) or wrong; the test `413 body_too_large by Content-Length and by counting a chunked body` sends both. `TextDecoder` with `fatal: true` rejects bytes that are not valid UTF-8 instead of silently replacing them with `U+FFFD`. Only after the whole body is in memory is it parsed; `JSON.parse` throws a `SyntaxError` for malformed JSON, which becomes `400 invalid_json`.

Routing is string comparison on the path from `new URL(req.url, 'http://localhost')` (the base is needed because `req.url` is only a path):

```js
// server/app.mjs (route)
if (pathname === '/health') return health(req, res, store, startedAt);
if (pathname === '/api' || pathname.startsWith('/api/')) return api(req, res, pathname);
```

and in `server/api.mjs` the method decides the action, with `405` + `Allow` for anything else. That is all a "router" is.

Two runtime details worth knowing:

- **The listener is not awaited by Node.** `createServer` calls `listener(req, res)` and moves on; a returned promise is ignored. If an `async` handler throws and nobody catches it, the request is left hanging *and* the process gets an unhandled rejection. `app.mjs` therefore wraps everything in one `try/catch` (`handle()`), turning `HttpError` into its JSON response and anything else into `500 internal_error`.
- **Stopping cleanly.** `server.close()` stops accepting new connections and calls back when existing ones have finished; since Node 19 it also closes idle keep-alive connections. `server/main.mjs` calls it on `SIGINT` (Ctrl+C) and `SIGTERM`, so a write that has started completes before the process exits. The drill output shows `SIGINT received, finishing in-flight requests` and exit code 0.

### 3.2 REST resources and request/response contracts

REST models the API as **resources** (things with URLs) manipulated with the **standard HTTP methods**, and every response says what happened with a **status code** and describes its body with a **media type**.

| Resource | URL | Methods |
| --- | --- | --- |
| The collection of sessions | `/api/sessions` | `GET` (read the list), `POST` (create a member) |
| One session | `/api/sessions/{id}` | `GET` (read it) |

Method semantics (RFC 9110) drive the design:

- **GET is safe** (it does not change state) and **idempotent** (repeating it has the same effect as doing it once). The browser may repeat it freely; that is why the list can be refreshed and why `GET /health` is a GET.
- **POST is neither.** Sending the same POST twice normally creates two records. This is exactly the duplicate risk in the outage drill, and why the client adds an `Idempotency-Key` header (section 3.3 and the report section 5). The header name follows an IETF draft (`draft-ietf-httpapi-idempotency-key-header`); several public payment APIs use the same idea.

The status codes this API uses, and the reason for each:

| Status | When | Why this one |
| --- | --- | --- |
| 200 OK | a GET, or a POST replayed with a known key | the request succeeded and the body is the resource |
| 201 Created | a POST stored a new record | tells the client a new resource exists; `Location` gives its URL |
| 400 Bad Request | body is not UTF-8 / not JSON / not an object; bad key | the server cannot even interpret the request |
| 404 Not Found | unknown path or id | no such resource |
| 405 Method Not Allowed | e.g. `DELETE /api/sessions` | the resource exists but not this method; `Allow` lists the valid ones (required by RFC 9110) |
| 409 Conflict | another write is in progress | the request conflicts with the current state of the resource and may succeed if resubmitted |
| 413 Content Too Large | body > 4096 bytes | Node still prints the older reason phrase "Payload Too Large" |
| 415 Unsupported Media Type | `Content-Type` is not `application/json` | the server only understands JSON bodies |
| 422 Unprocessable Content | valid JSON, wrong values or unknown fields | understood, but breaks the rules; Node prints "Unprocessable Entity" |
| 500 Internal Server Error | corrupt data file, unexpected bug | the server's fault, not the client's |
| 503 Service Unavailable | `/health` when storage is unreadable | the service cannot do its job right now |

**400 versus 422.** `{"minutes":45,` is not JSON at all: 400. `{"minutes":"45","note":""}` is perfectly good JSON whose *values* are wrong: 422, with `details` per field so the form can mark each field. Splitting them tells the client whether to fix its encoding or its data.

**409 versus 503 for the overlap.** Both are defensible. 503 says "the server is overloaded"; but the server is fine - the request collided with a specific in-progress change to the session collection. 409 describes that, and the response adds `Retry-After: 1` and `"retryable": true` so a client does not have to guess. The browser client honours both (it waits `Retry-After` seconds, then retries up to 3 times).

**Media types.** Every API response is `Content-Type: application/json; charset=utf-8`, including errors - so a client can always `response.json()` an API answer. The server also *requires* `application/json` on POST (415 otherwise). A plain HTML form post would be `application/x-www-form-urlencoded`; the test `415 unsupported_media_type unless Content-Type is application/json` sends one. `Cache-Control: no-store` stops browsers and proxies from answering a GET from a stale copy, which would break "two tabs see the same records after refresh".

**The contract** is the table in the report section 2 and in the README: fields, limits, statuses and the error shape `{"error":{"code","message","retryable","details"?}}`. `code` is stable for programs (`if (err.code === 'write_conflict')`), `message` is for people, `retryable` says whether the same request may succeed later. Having one shape is what R2 calls "consistent JSON errors": the client has one parser for all failures.

"Accept only the documented fields" is enforced by `validateSessionInput()`: any key other than `minutes` and `note` is reported (`Unknown field(s): id`). This blocks a client from smuggling in `id` or `timestamp`, which the server must own.

### 3.3 Promises, async/await, concurrency and an initial event-loop model

**A promise** is an object standing for a result that is not ready yet. It is *pending*, then settles once: *fulfilled* with a value or *rejected* with a reason (usually an `Error`). `await p` inside an `async` function pauses that function until `p` settles: on fulfilment it evaluates to the value, on rejection it **throws** the reason at that line, so `try/catch` works around `await`. An `async` function itself always returns a promise.

**An initial event-loop model.** A Node process runs your JavaScript on **one thread**. It repeatedly takes one ready callback from a queue and runs it *to completion*; nothing else of yours runs meanwhile. Slow work (disk, network, timers) is handed to the operating system or libuv's small thread pool; when it finishes, a callback is queued. After each callback, the **microtask queue** (promise reactions - the code after an `await`) is drained before the next callback. So:

- `await readFile(...)` (from `node:fs/promises`) starts the read on libuv's thread pool and *returns control to the event loop*. Other requests are served while the disk works. When the read completes, the rest of the function is queued and later continues.
- `readFileSync(...)` does the read *on the main thread*: while it runs, no other request, timer or callback can run. With one user that is invisible; with many it multiplies everyone's wait. That is constraint C3, checked by `test/server-constraints.test.js`. The CLI (`planner.js`) keeps the synchronous P2 calls because it is one short-lived command with nothing else to serve.

**Concurrency is not parallelism here.** Two POSTs can be *in progress* at the same time (both started, both waiting on the disk) even though only one line of JavaScript runs at any instant. Each `await` is a point where another request's code may run. That is where the lost update comes from:

```text
POST A: read file -> []          (await: other code may run)
POST B: read file -> []          (A has not written yet)
POST A: write [A]
POST B: write [B]                 -> A is gone, though A got 201
```

The extra drill in the report (section 7) shows exactly this with the guard removed: five 201 responses, one stored record.

**The guard** in `createSessionStore` (`src/storage.js`):

```js
async add(details, { requestId } = {}) {
  if (busy) throw new StoreBusyError(file);
  busy = true;
  try {
    const sessions = await readSessionsAsync(file);
    ...
    await writeSessionsAsync(file, [...sessions, session]);
    return { session, created: true };
  } finally {
    busy = false;
  }
}
```

The check `if (busy)` and the assignment `busy = true` have **no `await` between them**, so they run in one uninterrupted piece of a callback. No other request can slip in between "it is free" and "I take it" - the event loop guarantees it, no lock primitive needed. `finally` releases the flag whether the write succeeded or threw (the test `add on a corrupt file rejects and does not overwrite it` checks `store.writing === false` afterwards). This only works **inside one process**: a second server process, or `node planner.js add` on the same file, has its own `busy` variable (constraint C2). The project says so instead of pretending.

Note what the guard does *not* do: it does not queue the second request. R4 asks for a "documented retryable response", so the second request is rejected immediately with 409, and the client decides to retry. A queue (a promise chain `last = last.then(() => doWrite())`) would be the alternative design; it hides the conflict but makes the server hold requests open.

**Concurrent versus sequential in the code:**

```js
// test/api.test.js - concurrent: both requests are in flight together
const [a, b] = await Promise.all([postJson(url, A), postJson(url, B)]);

// sequential: the second starts only after the first has finished
const first = await postJson(url, A);
const second = await postJson(url, B);
```

`Promise.all` starts nothing by itself - the two `postJson` calls already started their requests when they were called; `Promise.all` just waits for both and rejects as soon as one rejects. `Promise.allSettled` (used in `test/session-store.test.js`) waits for all and reports each outcome, which is what you want when some failures are expected.

**A concurrency bug on the client too.** In `study-log.mjs`, two list loads can overlap (a refresh click while the previous load is slow). Responses can arrive out of order, so an older, slower answer could overwrite a newer one. `loadNumber` fixes it: each load remembers its number and only the newest may update the page.

```js
const mine = ++loadNumber;
const data = await listSessions();
if (mine !== loadNumber) return; // a newer load has started; drop this answer
```

**Durable before acknowledged (R4).** `writeSessionsAsync` writes the full list to a temporary file in the same directory, calls `handle.sync()` (`fsync`: ask the OS to push the bytes to the disk, not just its cache), closes it, then `rename`s it over the data file. `rename` within one directory is atomic on POSIX file systems: anyone reading the path sees the whole old file or the whole new file, never half. Only after `add()` resolves does `api.mjs` send `201`. The test `201 ... the record is on disk when the response arrives` reads the file the moment the response comes back. (Strictly, a power cut could also lose the rename unless the *directory* is fsynced too; that last step is not done here, and report.md lists it.)

## 4. Concepts to read up on (mapped to this code)

| Concept | Where it appears | Suggested reading |
| --- | --- | --- |
| Node http request/response | `server/app.mjs`, `server/http-json.mjs` | Node docs: "HTTP" (`http.createServer`, `IncomingMessage`, `ServerResponse`), "Anatomy of an HTTP Transaction" guide |
| REST resource, method, status; JSON content type | `server/api.mjs`, README contract | RFC 9110 sections 9 (methods: safe, idempotent) and 15 (status codes); MDN "HTTP response status codes"; MDN "Content-Type" |
| fetch, async/await, rejection | `web/js/sessions-api.mjs`, `web/js/study-log.mjs` | MDN "Using the Fetch API" (note: "fetch() promise does not reject on HTTP errors"), MDN "async function", MDN "AbortSignal.timeout()" |
| Concurrent requests versus sequential operations | `createSessionStore`, `Promise.all` in tests, `loadNumber` | MDN "Promise.all()" and "Promise.allSettled()"; Node docs "The Node.js Event Loop"; "Don't Block the Event Loop" guide |

## 5. Reinforced topics

### 5.1 P2 modules: storage separate from HTTP

`server/api.mjs` never touches a file and `src/storage.js` never sees a request. They meet through a small interface: `store.list()` and `store.add(values, { requestId })`, which resolve or reject with `StoreBusyError` / `IdempotencyKeyMismatchError` / `CorruptDataError`. `api.mjs` translates those errors into HTTP (`storageError()`): `StoreBusyError` -> 409, `IdempotencyKeyMismatchError` -> 422 `idempotency_key_mismatch`, `CorruptDataError` -> 500 with no server path in the message (the path goes to the server log). The storage module could move to PostgreSQL in Project 8 without changing the HTTP code, as long as the interface stays.

The P2 rule "a corrupt file is reported, never overwritten" carries over: `parseSessions()` is now shared by the synchronous and promise readers, so both raise `CorruptDataError` for the same input, and `add()` reads (and fails) before it would ever write.

### 5.2 P2 persistence: detect overlapping writes

P2's CLI was one process doing one write and exiting, so overlap could not happen. A server serves many clients at once, so the P2 read-modify-write became a race (section 3.3). The fix is detection plus a defined outcome (409), proved with tests and the drill.

### 5.3 P4 HTTP: methods, statuses, media types

In P4 you *observed* statuses and content types from GitHub Pages with `curl -I`. Here you *choose* them. Compare the static file server (`server/static.mjs`) - `text/html`, `text/css`, `text/javascript` chosen from the file extension, 404 page for unknown paths - with the API, which always answers `application/json`.

### 5.4 P5 UI states

Each asynchronous operation on the page has four visible states:

| State | List | Save |
| --- | --- | --- |
| loading | "Loading sessions...", list `aria-busy`, Refresh disabled | "Saving...", button disabled with label "Saving...", form `aria-busy` |
| empty | "No sessions logged yet. ..." | (n/a) |
| success | the list, newest first, with a total | "Saved session #N: M minutes." (or "Already saved as session #N; ...") |
| failure | "Could not load sessions: ..." + what to do | "Not saved: ..." + **Try again**, values kept |

The P5 rules still hold: text only through `textContent`, one listener per action (checked by `test/web.test.js` and by `DOMDebugger.getEventListeners` in the browser check), messages in `role="status"` live regions that exist from page load.

## 6. Answer: a rejected promise versus an HTTP error response

They are different layers, and `fetch()` treats them differently.

- **A rejected promise** means the operation did not produce a result at all. For `fetch()`, that is a failure *below* HTTP: the TCP connection was refused (server stopped - `net::ERR_CONNECTION_REFUSED` in the drill), reset, the name did not resolve, the browser blocked the response (CORS), or the request was aborted (our `AbortSignal.timeout(8000)` -> `DOMException` named `TimeoutError`). There is no status code and no body, because no response arrived. In code: `await fetch(...)` throws (usually a `TypeError: Failed to fetch`).
- **An HTTP error response** is a complete, successfully delivered response whose *status* says the server refused or failed: 400, 404, 409, 422, 500... At the transport level everything worked, so `fetch()` **fulfils** its promise with a `Response` whose `ok` is `false` (`ok` is true only for 200-299). The body is readable and, in this API, explains the decision (`{"error":{"code":"write_conflict",...}}`).

Consequences in `web/js/sessions-api.mjs`:

```js
try {
  response = await fetch(path, { ..., signal: AbortSignal.timeout(TIMEOUT_MS) });
} catch (err) {
  throw new NetworkError(...);          // rejected: no response exists
}
...
if (!response.ok || data === null) {
  throw new ApiError(response.status, data, ...);  // resolved, but an error status
}
```

`fetch` never throws for a 500, so code that only has a `catch` around `fetch` treats a 500 as success; and code that only checks `response.ok` crashes on a network failure (that is the drill's endless spinner: the rejection escaped the handler). The page responds differently because the situations differ: after a `NetworkError` the server state is *unknown* (the request may or may not have arrived), so the advice is "try again" with the same idempotency key; after an `ApiError` the server's answer is *known* - for 422 fix the fields, for 409 retry, for 404 on GitHub Pages "this address has no API".

A middle case: the headers arrived but the body was cut off. Then `fetch()` fulfilled, but `response.json()` rejects; `sessions-api.mjs` classifies that as a `NetworkError` too, because the answer is incomplete.

## 7. File-by-file walkthrough

### `server/main.mjs` (new)

The entry point for `npm start`. Reads `--port`, `--host`, `--data`, `--write-delay-ms` (or `PORT`), starts the app, prints where it listens and which data file it owns, and installs `SIGINT`/`SIGTERM` handlers that call `app.close()` and exit 0, with a 5-second fallback (`unref()` so the timer itself does not keep the process alive) and "second signal exits at once". It is the only file with process-level concerns, so tests can start the app in-process without signal handlers.

### `server/app.mjs` (new)

`createApp({ store, bodyLimit })` returns `handle(req, res)`: parse the URL, dispatch to `/health`, `/api/...`, the `/` redirect, or static files, and catch every error in one place. `health()` reads storage so a corrupt file shows as `503`, not "ok". `startApp()` creates the store and the server, logs `METHOD url -> status (ms)` when each response finishes (`res.on('finish')`), and resolves with `{ server, url, store, close }`. Port 0 lets tests get a free port.

Why a 302 for `/`: it is an application choice that may change; a 301 would be cached permanently by browsers.

### `server/api.mjs` (new)

The session resource. `createApi(store)` returns `handleApi(req, res, pathname)`, which picks a handler by path and method. `createSession` checks the optional `Idempotency-Key` format, reads the body, rejects non-objects with 400, validates with `validateSessionInput` (422 with details), calls `store.add` and only then sends 201 + `Location` (or 200 + `Idempotent-Replayed` for a known key with the same minutes and note; a known key with different values is 422 `idempotency_key_mismatch`, because replaying would claim values were saved that never were). `toResource()` strips internal fields (`requestId`) from responses. `storageError()` maps storage errors to HTTP. It imports the shared ES module directly and the CommonJS storage module through `createRequire`.

### `server/http-json.mjs` (new)

`HttpError` (an error carrying status, code, retryable flag, details and extra headers), `sendJson` (JSON body with correct byte `Content-Length`, no body for HEAD), `sendError` (the one error shape), and `readJsonBody` (415, 413 by header and by counting, UTF-8 check, empty body, `JSON.parse`). The 413 response adds `Connection: close`: the server stopped reading mid-body, so the leftover bytes are still on the connection, and closing it is simpler than draining them.

### `server/static.mjs` (new, extracted)

The P5 static file handler moved here unchanged in behaviour (GET/HEAD only, MIME types, directory redirect, path-traversal guard, 404 page), plus a guard for malformed `%` escapes (previously `decodeURIComponent` would have thrown into a 500). `scripts/serve.mjs` now imports it, so the P5 preview server and the P6 app serve files identically; `npm run test:browser` (P5) still passes.

### `src/storage.js` (extended)

- `parseSessions()` and `newSessionRecord()` were extracted from `loadSessions()`/`addSession()` so both APIs share the file format, corrupt-file rule and id rule (highest id + 1).
- `readSessionsAsync()`: `fs/promises.readFile`; `ENOENT` means empty log.
- `writeSessionsAsync()`: temp file, `fsync`, `close`, `rename`; removes the temp file if the rename fails.
- `StoreBusyError` and `createSessionStore()`: the single-writer store with idempotent `add` (section 3.3). `writeDelayMs` widens the read-to-write gap for tests and demonstrations; it is 0 in normal use.

### `web/js/calculation.mjs` (extended)

`SESSION_FIELDS`, `SESSION_LIMITS` and `validateSessionInput()`. It returns every error at once (`body`, `minutes`, `note`), like `validatePlanInput()` from P5. `minutes` must be a JSON *number*; `"45"` is rejected so the API contract is strict, and the form converts its text first (`toApiInput` in `study-log.mjs`). The module still has no imports and no runtime-specific globals (`test/shared-module.test.js`).

### `web/js/sessions-api.mjs` (new)

The browser's API client and the only `fetch()` caller (checked in `test/web.test.js`). Every request has `Accept: application/json`, `cache: 'no-store'` and an 8-second timeout. It classifies outcomes into `NetworkError` and `ApiError` (section 6). `addSession()` sends `Idempotency-Key` and retries `write_conflict` up to 3 times after `Retry-After` seconds, reporting each retry through `onRetry` so the page can say so.

### `web/js/study-log.mjs` (new)

`wireStudyLog(document)` looks up elements once and registers exactly three listeners: form `submit`, Try again `click` (which calls `form.requestSubmit()` so retry goes through the same validation and pending guard), and Refresh `click`. Closure state:

- `saving` - the in-flight guard. Belt and braces with `button.disabled`: a disabled default button already blocks clicks and implicit submission (Enter), but `requestSubmit()` or a future second button would not be blocked by it; the flag blocks every path (the browser check proves it with `submit 3 ignored`).
- `draft` - `{ key, minutes, note }`. The same values reuse the same idempotency key; changed values get a new `crypto.randomUUID()` (available on secure origins, which includes `http://127.0.0.1`). Cleared after a success.
- `loadNumber` - the stale-response guard for the list.

The `catch` in `onSubmit` is the drill's repair: message by error type, button re-enabled, values kept, Try again shown.

### `web/log.html` (new)

Same header/footer/skip-link structure as `index.html`, a labelled form with hints and error paragraphs (the P5 pattern), two `role="status"` regions (save result, list state) and an `<ol>` for the sessions. `novalidate` because validation messages come from the shared rules, not the browser's built-in bubbles. No inline handlers; one module script.

### `web/styles.css` (extended)

Section 7: narrow/wide field widths, the Refresh button style, a dashed border and `progress` cursor for disabled buttons (the pending state is not shown by colour alone), and the session list layout. No change to existing rules.

### `scripts/serve.mjs` (changed)

Now a thin wrapper: the `/` redirect plus `serveStatic` from `server/static.mjs`.

### `scripts/check-study-log.mjs` (new)

Real-browser checks against a real server *process* (so "stop the server" is a real process exit). Uses CDP: `Network.emulateNetworkConditions` to make the loading state visible, `Input.dispatchMouseEvent`/`dispatchKeyEvent` for real clicks and Enter, `Fetch.failRequest` to lose a response after the server stored it, an unanswered paused request to trigger the 8-second timeout, and `DOMDebugger.getEventListeners` to count listeners.

### Tests

- `test/session-input.test.js` - validation boundaries (1 and 1440 minutes, 200-character note after trimming), unknown fields, types.
- `test/session-store.test.js` - promise API, atomic write leaves no temp file, overlap rejected and lock released, 10 concurrent adds lose nothing acknowledged, idempotent add, corrupt file untouched.
- `test/api.test.js` - every endpoint and error against a real server on port 0, including chunked 413, non-UTF-8 400, overlap 409 and restart.
- `test/server-constraints.test.js` - C1 and C3 in the source.
- `test/web.test.js` - log.html loads one module; three listeners; only `sessions-api.mjs` calls `fetch`, with a timeout.

### `package.json`

`npm start`, `npm run test:api`, `npm run test:browser:log`. Still no dependencies.

## 8. Self-quiz

1. Why does `readJsonBody` count received bytes instead of trusting `Content-Length`?
2. `fetch('/api/sessions')` gets a `500` response. Does the promise reject? What does `response.ok` contain?
3. In `createSessionStore().add`, what would break if you inserted `await Promise.resolve()` between `if (busy) throw ...` and `busy = true`?
4. Why is `{"minutes":"45","note":"x"}` a 422 and not a 400?
5. The server stores a session and crashes before sending the 201. What does the page show, and why does Try again not create a duplicate?
6. Why is `readFileSync` acceptable in `planner.js` but not in `server/api.mjs`?
7. What does `rename` give you that writing the data file directly with `writeFile` does not?
8. Two tabs press Save at the same moment. List the HTTP exchanges until both records are stored.
9. Why does the browser client send the idempotency key as a header instead of a body field?
10. What would the user see if `sessions-api.mjs` had no `AbortSignal.timeout` and the server accepted the connection but never answered?
11. Why can the `busy` flag not protect against `node planner.js add` running at the same time as the server?
12. What is the difference between `Promise.all` and `Promise.allSettled`, and which one does the overlap test in `test/session-store.test.js` need?

<details>
<summary>Answers</summary>

1. `Content-Length` can be absent (`Transfer-Encoding: chunked`) or lie. Counting each chunk as it arrives is the only way to stop reading as soon as the limit is passed, without first buffering an unbounded body.
2. It does not reject: an HTTP 500 is a delivered response. The promise fulfils with a `Response` whose `ok` is `false` and `status` is 500. `sessions-api.mjs` turns that into an `ApiError`.
3. The check and the claim would no longer be atomic. Two calls could both see `busy === false`, both pass the check before either sets the flag, and both read-modify-write: the lost update returns. The guard depends on there being no `await` between those two lines.
4. The body is valid JSON and a JSON object, so the server understood it (no 400). Its *values* break the contract - `minutes` must be a number - so it is unprocessable: 422 with `details.minutes`.
5. The fetch rejects or the response is cut off, so the page shows "Not saved: ..." with Try again and keeps the values. Try again resends the same values with the same `Idempotency-Key`; the store finds a record with that `requestId` and returns it with 200 instead of adding one, and the page shows "Already saved as session #N".
6. `planner.js` is a single command that does one thing and exits, so blocking its only thread costs nothing. The server's one thread serves every client; a synchronous read stops all of them, including health checks, until the disk answers.
7. Atomicity: readers and a crash see either the complete old file or the complete new file. Writing in place can leave a truncated or half-written file if the process dies mid-write, which the next start would then report as corrupt.
8. A: `POST` -> store busy is false, A takes it. B: `POST` arrives while A is writing -> `409 write_conflict`, `Retry-After: 1`. A: `201 Created` (+ `GET /api/sessions` to refresh). B's client shows "retrying (1)", waits 1 s, `POST` again with the same key -> `201 Created` (+ `GET`). Two records, none lost.
9. The contract says the body has exactly `minutes` and `note`; an extra field would be rejected as unknown and would mix "what to store" with "how to deliver it". The key is about the request, not the resource - the same reason `Content-Type` is a header.
10. "Saving..." with a disabled button for as long as the TCP connection stays open - in practice an endless spinner. The timeout guarantees a `NetworkError` ("did not answer within 8 seconds") and a usable page (browser check 20).
11. `busy` is a variable in the server process's memory. The CLI is a different process with its own memory; it never sees the flag. Protecting across processes needs an OS-level lock or a database - which is why C2 says one process, one writer.
12. `Promise.all` rejects as soon as any input rejects (you lose the other results); `Promise.allSettled` waits for all and gives each `{status, value | reason}`. The overlap test expects one fulfilment and one `StoreBusyError` rejection, so it needs `allSettled` to see both.

</details>
