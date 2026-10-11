# PROJECT 6 - Shared study log over HTTP

**Size:** 3 weeks, 30-45 hours total | **Mode:** Extends Project 5 and absorbs Project 2's storage module.

Source: *sixty-week-spine* curriculum, section "PROJECT 6 - Shared study log over HTTP". This file restates the brief as a checklist and records the decisions taken while building it.

## Why now

A browser-only planner cannot share persistent state with another browser. One small server connects the interface to storage and makes asynchronous failures visible.

## New topics

- Frontend > JS / TS / Node: the native Node HTTP server runtime.
- Backend > APIs: REST resources and request/response contracts.
- Frontend > JS / TS / Node: promises, async/await, concurrency, and an initial event-loop model.

## Reinforced topics

- P2 modules: keep storage separate from HTTP handling.
- P2 persistence: detect overlapping writes instead of losing records.
- P4 HTTP: use meaningful methods, statuses, and media types.
- P5 UI states: show loading, empty, success, and failure states.

## The build

Two browser tabs add study sessions to one shared server-side log.

## Requirements checklist

- [ ] R1. Serve the UI and API from one origin. Implement `GET /api/sessions`, `POST /api/sessions`, and `GET /health`.
- [ ] R2. Accept only the documented session fields, reject malformed JSON and oversized bodies, and return consistent JSON errors.
- [ ] R3. The browser lists and adds records through `fetch`; accidental double submission is prevented while a request is pending.
- [ ] R4. Successful writes are persisted before success is acknowledged. Overlapping mutations of the single-process file store are rejected with a documented retryable response rather than silently losing data.
- [ ] R5. Two tabs see the same records after refresh, and records survive a server restart.
- [ ] R6. The working local version is reproducible. Remote deployment of the Node service is deferred to P22.

## Constraints checklist

- [ ] C1. No Express or framework router: method, path, headers and body are inspected by our own code.
- [ ] C2. One server process and one writer; the file store does not pretend to support distributed concurrency.
- [ ] C3. No blocking file operations inside request handlers: promise-based I/O only.

## Break it on purpose

- [ ] Stop the server while the page is open. Observe the fetch failure, display a recoverable message instead of an endless spinner, restart the server, and retry without adding a duplicate record. Record fault, symptom, evidence, repair, verification.

## Definition of done

- [ ] All three endpoints follow their documented contracts.
- [ ] Two-tab and restart checks pass.
- [ ] Invalid JSON and overlapping writes have defined outcomes.
- [ ] Server-down recovery works and prior calculation tests remain green.

## Stretch goal (optional, does not block completion)

- [ ] Optional: deletion of a session with a deliberate confirmation in the UI.

## Report back with

- Repository; server, storage, and browser API files.
- HTTP examples for success, malformed input, and overlap.
- Two-tab/restart evidence and outage report.
- Explain the difference between a rejected promise and an HTTP error response.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Server runtime | `node:http` `createServer`, Node 24 (repo already requires >= 22.12). No packages | C1 forbids Express/routers; the native server is the topic. |
| Where the code lives | `server/` (ES modules): `main.mjs` (entry, CLI flags, signals), `app.mjs` (request dispatch: API, health, static), `api.mjs` (session handlers), `http-json.mjs` (body reading, JSON responses and errors), `static.mjs` (static files, extracted from `scripts/serve.mjs`) | HTTP concerns stay out of storage (reinforced topic "keep storage separate from HTTP handling"). The P5 `scripts/serve.mjs` keeps working by importing the extracted static handler. |
| Storage | `src/storage.js` (P2) gains a promise-based API next to its synchronous one: `readSessionsAsync`, `writeSessionsAsync` (temp file, `fsync`, `rename`) and `createSessionStore(file)`. Parsing, ID generation and record shape are shared with the CLI path | "Absorbs Project 2's storage module": one module, one file format, one corrupt-file rule. The CLI keeps its synchronous calls (it is not a request handler); the server uses only the promise API (C3). |
| One origin | One process serves `web/` under `/studytrack-platform/` (same path as GitHub Pages, so relative links behave the same) plus `/api/...` and `/health`. `/` redirects to `/studytrack-platform/log.html` | R1. Same origin means no CORS: the page calls `fetch('/api/sessions')`. |
| UI placement | A new page `web/log.html` with `web/js/study-log.mjs` (DOM) and `web/js/sessions-api.mjs` (the browser API client). `index.html` is not changed | Keeps the P5 page, its keyboard route and its browser checks exactly as they were. GitHub Pages also publishes `log.html`, where no API exists; the page then shows its failure state and explains that the log needs the local server (remote deployment is P22). |
| Session fields (POST body) | Exactly `{ "minutes": <integer 1-1440>, "note": <string, 1-200 characters after trimming> }`. Any other field, a non-object body, or a wrong type is rejected | R2 "only the documented fields". P2's rules (`isPositiveInteger`, `isValidNote`) plus upper bounds that a single study session can sensibly have (one day; a short note). The check is a pure function `validateSessionInput()` in the shared module, so the browser shows the same messages before sending. The API requires real JSON numbers; strings such as `"45"` are rejected (the form converts). |
| Stored record | `{ id, minutes, note, timestamp, requestId? }` - the P2 shape plus an optional `requestId` | The P2 CLI ignores unknown fields, so `node planner.js summary` and `log` read the shared log unchanged. |
| Error format | Every error is `application/json; charset=utf-8` with `{ "error": { "code", "message", "retryable", "details"? } }` | R2 "consistent JSON errors". `code` is for programs, `message` for people, `retryable` tells the client whether sending the same request again can succeed. |
| Status codes | 200 GET/health and idempotent replay; 201 created (+ `Location`); 400 `invalid_json`/`invalid_body`; 404 `not_found`; 405 `method_not_allowed` (+ `Allow`); 409 `write_conflict` (+ `Retry-After: 1`, retryable); 413 `body_too_large`; 415 `unsupported_media_type`; 422 `validation_failed` (+ per-field details); 500 `storage_corrupt`/`internal_error`; 503 from `/health` when storage is unreadable | Meaningful methods, statuses and media types (P4). 400 = cannot parse; 422 = parsed but the values break the rules. |
| Body limit | 4096 bytes. `Content-Length` larger than that is refused before reading; bytes are also counted while streaming (chunked bodies), and the request is refused as soon as the count passes the limit | A valid session is under 300 bytes. Counting the stream protects against a missing or lying `Content-Length`. |
| Overlapping writes | The store allows one mutation at a time. A `POST` that arrives while another write is between "read file" and "rename new file into place" gets `409 write_conflict` with `Retry-After: 1` and `retryable: true`; nothing is queued and nothing is lost | R4 asks for a documented retryable rejection, not a queue. 409 because the request conflicts with the current state of the resource (a write in progress), and the client may resubmit. A test-only `--write-delay-ms` option widens the window so overlap can be demonstrated deterministically. |
| Durable before acknowledged | The new list is written to a temp file in the same directory, `fsync`ed, closed, then `rename`d over the data file, and only then is `201` sent | R4. A crash leaves either the old or the new file, never half a file; a reader never sees a partial write. |
| Duplicate protection on retry | The browser creates one `crypto.randomUUID()` per entry and sends it as an `Idempotency-Key` header (not a body field). If a record with that `requestId` exists, the server returns it with `200` instead of adding another | The break-it drill: if the first request was saved but its response was lost (server stopped after writing), "Try again" must not add a second record. Header, not field, so the documented body stays two fields. |
| Double submission | While a request is pending the submit button is `disabled`, the form has `aria-busy="true"`, and the handler ignores further submits (in-flight flag) | R3. Disabling alone does not stop a second Enter keypress queued before the re-render; the flag does. |
| Browser timeouts | Every fetch has `AbortSignal.timeout(8000)` | A hung server must also end in a message, not an endless spinner. |
| Failure display | `sessions-api.mjs` turns outcomes into two error classes: `NetworkError` (the fetch promise rejected or timed out: no HTTP response) and `HttpError` (a response arrived with a 4xx/5xx status and a JSON error). The page shows a different, recoverable message for each and keeps the typed values | Answers the "Explain" question in code. |
| 409 in the browser | Retried automatically up to 3 times, waiting `Retry-After` seconds; then shown as a message with "Try again" | The response says it is retryable; a person should not need to act on a brief overlap. |
| Data file | Same resolution as the CLI: `--data <path>`, else `STUDYTRACK_DATA_FILE`, else `studytrack-data.json` in the working directory (git-ignored) | `node planner.js summary 30 12` reads the shared log. Only the server writes while it runs (C2); README says not to run `planner.js add` against the same file at the same time. |
| Port/host | `127.0.0.1:3000` by default; `--port`, `--host`, `PORT` | Local only; nothing is exposed to the network. |
| Health | `GET /health` reads the data file: `200 {"status":"ok","storage":"ok","sessions":N,"uptimeSeconds":S}` or `503 {"status":"error","storage":"corrupt"|"unreadable",...}` | A health check that cannot see storage would report "ok" while every write fails. |
| Tests | `node:test` only. `test/session-input.test.js` (validation), `test/session-store.test.js` (async store, overlap, idempotency, durability), `test/api.test.js` (real server on port 0: every endpoint, error, overlap, restart), extra static checks in `test/web.test.js` (no `*Sync` calls in `server/`). Browser: `scripts/check-study-log.mjs` (two tabs, double click, server-down drill) in headless Chrome over CDP, `npm run test:browser:log` | Runs anywhere Node runs; the browser part needs Chrome, like P5. |
| Graceful stop | `SIGINT`/`SIGTERM` stop accepting connections and wait for in-flight requests before exiting | A write that has started is allowed to finish, so stopping the server never truncates the file. |
| Stretch goal | Not attempted | Optional. |
