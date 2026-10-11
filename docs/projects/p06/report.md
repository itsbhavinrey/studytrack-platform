# Project 6 report - Shared study log over HTTP

All outputs below were captured on 2026-10-11 on macOS with Node v24.14.0 and Google Chrome (headless, driven over the Chrome DevTools Protocol). Nothing was typed by hand; long outputs are trimmed and trimming is marked with `...`. `<tmp>` stands for a temporary directory. Full captured files are in [`evidence/`](evidence/).

## 1. Repository and files

| Item | Path |
| --- | --- |
| Repository | https://github.com/itsbhavinrey/studytrack-platform |
| Server entry point (`npm start`) | [`server/main.mjs`](../../../server/main.mjs) |
| Request dispatch (health, API, static, error catch-all) | [`server/app.mjs`](../../../server/app.mjs) |
| Session API handlers | [`server/api.mjs`](../../../server/api.mjs) |
| Body reading, JSON responses, error format | [`server/http-json.mjs`](../../../server/http-json.mjs) |
| Static files (extracted from P5's `scripts/serve.mjs`) | [`server/static.mjs`](../../../server/static.mjs) |
| Storage (P2 module + promise API and single-writer store) | [`src/storage.js`](../../../src/storage.js) |
| Shared validation (`validateSessionInput`) | [`web/js/calculation.mjs`](../../../web/js/calculation.mjs) |
| Browser API client (the only `fetch` caller) | [`web/js/sessions-api.mjs`](../../../web/js/sessions-api.mjs) |
| Study log page and its script | [`web/log.html`](../../../web/log.html), [`web/js/study-log.mjs`](../../../web/js/study-log.mjs) |
| Tests | [`test/api.test.js`](../../../test/api.test.js), [`test/session-store.test.js`](../../../test/session-store.test.js), [`test/session-input.test.js`](../../../test/session-input.test.js), [`test/server-constraints.test.js`](../../../test/server-constraints.test.js), [`test/sessions-api.test.js`](../../../test/sessions-api.test.js), [`test/web.test.js`](../../../test/web.test.js) (P6 part), [`scripts/check-study-log.mjs`](../../../scripts/check-study-log.mjs) (browser) |

Reproduce: `npm start` (server on `http://127.0.0.1:3000`, study log at `/studytrack-platform/log.html`), `npm test`, `npm run test:browser:log`.

## 2. Endpoint contracts (Definition of done 1, R1, R2)

One process (`node server/main.mjs`) on one origin serves:

| Method and path | Success | Errors |
| --- | --- | --- |
| `GET /health` | `200 {"status":"ok","storage":"ok","sessions":N,"uptimeSeconds":S}` | `503 {"status":"error","storage":"corrupt"` or `"unreadable",...}`; `405` + `Allow: GET, HEAD` |
| `GET /api/sessions` | `200 {"sessions":[{id,minutes,note,timestamp}...],"count":N,"totalMinutes":M}` | `500 storage_corrupt` |
| `POST /api/sessions` (body exactly `{"minutes":1-1440,"note":"1-200 chars"}`, `Content-Type: application/json`, optional `Idempotency-Key`) | `201 {"session":{...}}` + `Location: /api/sessions/{id}`; `200` + `Idempotent-Replayed: true` for a known key with the same body | `400 invalid_json`, `400 invalid_body`, `400 invalid_idempotency_key`, `413 body_too_large`, `415 unsupported_media_type`, `422 validation_failed` (+ per-field `details`), `422 idempotency_key_mismatch` (known key, different body), `409 write_conflict` (+ `Retry-After: 1`, `retryable: true`), `500 storage_corrupt` |
| `GET /api/sessions/{id}` (target of `Location`) | `200 {"session":{...}}` | `404 not_found` |
| other method on an API resource | | `405 method_not_allowed` + `Allow` |
| unknown `/api/...` path | | `404 not_found` |
| `GET /` | `302` to `/studytrack-platform/log.html` | |
| `GET /studytrack-platform/...` | files from `web/` (same path as GitHub Pages) | `404` + `web/404.html` |

Every API error has one shape, `{"error":{"code","message","retryable","details"?}}`, with `Content-Type: application/json; charset=utf-8`. API responses carry `Cache-Control: no-store`.

`test/api.test.js` checks each row against a real server started on a free port (timings removed):

```text
$ node --test test/api.test.js
▶ GET /health
  ✔ 200 with status and storage ok
  ✔ 503 when the data file is corrupt
  ✔ 405 for POST, with Allow
▶ GET /api/sessions
  ✔ empty log: 200 with an empty list
  ✔ lists records written by the P2 CLI format, without internal fields
  ✔ 500 storage_corrupt for a corrupt file, which is left untouched
▶ POST /api/sessions
  ✔ 201 with the record and Location; the record is on disk when the response arrives
  ✔ 400 invalid_json for malformed JSON, nothing stored
  ✔ 400 invalid_json for an empty body and for bytes that are not UTF-8
  ✔ 400 invalid_body when the JSON is not an object
  ✔ 422 validation_failed with per-field details
  ✔ 415 unsupported_media_type unless Content-Type is application/json
  ✔ 413 body_too_large by Content-Length and by counting a chunked body
  ✔ 409 write_conflict, retryable with Retry-After, for an overlapping write; no record lost
  ✔ a GET during a slow write sees the old complete list, never a partial file
  ✔ the same Idempotency-Key twice: 201 then 200 with the same record
  ✔ 422 idempotency_key_mismatch when a known key comes with a different body; nothing stored
▶ routing
  ✔ 405 with Allow for an unsupported method on a resource
  ✔ 404 not_found as JSON for unknown API paths and unknown ids
  ✔ the UI is served from the same origin: / redirects to the study log page
▶ restart
  ✔ records survive stopping the server and starting a new one on the same file
ℹ tests 21
ℹ pass 21
ℹ fail 0
```

## 3. HTTP examples: success, malformed input, overlap (DoD 3)

Captured with `curl -si` against `node server/main.mjs --port 3000 --data <tmp>/studytrack-data.json --write-delay-ms 300`. Full transcript including the server's request log: [`evidence/http-examples.txt`](evidence/http-examples.txt). `Date`, `Connection` and `Keep-Alive` headers removed.

**Success**

```text
$ curl -si -X POST http://127.0.0.1:3000/api/sessions -H 'Content-Type: application/json' -d '{"minutes":45,"note":"Node http module"}'
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Content-Length: 98
Cache-Control: no-store
Location: /api/sessions/1

{"session":{"id":1,"minutes":45,"note":"Node http module","timestamp":"2026-10-11T15:18:31.627Z"}}

$ curl -si http://127.0.0.1:3000/api/sessions
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 129
Cache-Control: no-store

{"sessions":[{"id":1,"minutes":45,"note":"Node http module","timestamp":"2026-10-11T15:18:31.627Z"}],"count":1,"totalMinutes":45}
```

**Malformed input**

```text
$ curl -si -X POST http://127.0.0.1:3000/api/sessions -H 'Content-Type: application/json' -d '{"minutes":45,"note":"x"'
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8
...
{"error":{"code":"invalid_json","message":"The body is not valid JSON: Expected ',' or '}' after property value in JSON at position 24 (line 1 column 25)","retryable":false}}

$ curl -si -X POST http://127.0.0.1:3000/api/sessions -H 'Content-Type: application/json' -d '[1,2]'
HTTP/1.1 400 Bad Request
...
{"error":{"code":"invalid_body","message":"The body must be a JSON object with \"minutes\" and \"note\".","retryable":false}}

$ curl -si -X POST http://127.0.0.1:3000/api/sessions -H 'Content-Type: application/json' -d '{"minutes":"45","note":"   ","id":99}'
HTTP/1.1 422 Unprocessable Entity
...
{"error":{"code":"validation_failed","message":"The session was not saved; see details.","retryable":false,"details":{"body":"Unknown field(s): id. Allowed: minutes, note.","minutes":"Minutes must be a positive whole number, for example 45.","note":"The note must be text that is not empty."}}}

$ curl -si -X POST http://127.0.0.1:3000/api/sessions -H 'Content-Type: text/plain' -d '{"minutes":45,"note":"x"}'
HTTP/1.1 415 Unsupported Media Type
...
{"error":{"code":"unsupported_media_type","message":"Send the body as Content-Type: application/json.","retryable":false}}

$ curl -si -X POST http://127.0.0.1:3000/api/sessions -H "Content-Type: application/json" --data-binary @big.json   # 5023 bytes
HTTP/1.1 413 Payload Too Large
Content-Type: application/json; charset=utf-8
Content-Length: 101
Cache-Control: no-store
Connection: close

{"error":{"code":"body_too_large","message":"The body is larger than 4096 bytes.","retryable":false}}
```

The same 413 is returned with `Transfer-Encoding: chunked` (no `Content-Length`), because the server counts the bytes it receives. None of these requests changed the data file.

**Overlap** - two POSTs sent at the same moment; `--write-delay-ms 300` holds the first write open long enough for the second to arrive:

```text
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Content-Length: 87
Cache-Control: no-store
Location: /api/sessions/2

{"session":{"id":2,"minutes":10,"note":"tab A","timestamp":"2026-10-11T15:18:32.094Z"}}

HTTP/1.1 409 Conflict
Content-Type: application/json; charset=utf-8
Content-Length: 126
Cache-Control: no-store
Retry-After: 1

{"error":{"code":"write_conflict","message":"Another write is in progress. Retry the same request shortly.","retryable":true}}
```

Defined outcome of an overlapping write: the first write completes and is acknowledged with 201; the second is not stored and is told so with 409, `retryable: true` and `Retry-After: 1`. The browser client retries it automatically (section 4). No acknowledged write is lost; section 7 shows what happens without this guard.

**Retry with the same key** (no duplicate):

```text
$ curl -si -X POST .../api/sessions -H 'Content-Type: application/json' -H 'Idempotency-Key: 6f0c2a8e-2c1b-4d7e-9a51-3b8d0f1e2a77' -d '{"minutes":25,"note":"retried entry"}'
HTTP/1.1 201 Created
...
Location: /api/sessions/3

$ (the same command again)
HTTP/1.1 200 OK
...
Idempotent-Replayed: true

{"session":{"id":3,"minutes":25,"note":"retried entry","timestamp":"2026-10-11T15:18:32.501Z"}}
```

**Same key, different body** (rejected, not replayed; fresh data file):

```text
$ curl -si -X POST .../api/sessions -H 'Content-Type: application/json' -H 'Idempotency-Key: 9d2e4b1a-7c3f-4e8d-b6a0-5f1c2e3d4a90' -d '{"minutes":25,"note":"first entry"}'
HTTP/1.1 201 Created
Location: /api/sessions/1

$ curl -si -X POST .../api/sessions -H 'Content-Type: application/json' -H 'Idempotency-Key: 9d2e4b1a-7c3f-4e8d-b6a0-5f1c2e3d4a90' -d '{"minutes":45,"note":"first entry"}'
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json; charset=utf-8

{"error":{"code":"idempotency_key_mismatch","message":"This Idempotency-Key was already used for a session with different minutes or note. Use a new key for a new entry.","retryable":false}}

$ curl -s .../api/sessions
{"sessions":[{"id":1,"minutes":25,"note":"first entry","timestamp":"2026-10-11T15:34:51.372Z"}],"count":1,"totalMinutes":25}
```

Silently replaying here would answer "saved" for 45 minutes that were never stored. The browser never hits this case (it mints a new key whenever the values change), but any other client could.

**The P2 CLI reads the server's file unchanged:**

```text
$ node planner.js --file <tmp>/studytrack-data.json summary 30 12
Goal hours: 30 hours
Weekly hours: 12 hours
Logged sessions: 3 sessions
Completed time: 80 minutes (1.33 hours)
...
```

## 4. Two tabs, double submission, overlap and restart in the browser (DoD 2, R3, R5)

`npm run test:browser:log` (`scripts/check-study-log.mjs`) starts `node server/main.mjs` as a real child process with a temporary data file and `--write-delay-ms 400`, opens two tabs (A and B) in one headless Chrome, and drives them with real mouse clicks and key presses. Output of the run that produced the screenshots ([`evidence/check-study-log.stderr.txt`](evidence/check-study-log.stderr.txt); the JSON with server log and console lines is [`evidence/check-study-log.json`](evidence/check-study-log.json)):

```text
PASS  list shows a loading state while GET /api/sessions is pending
PASS  empty log shows the empty state
PASS  tab A: save shows success and lists the record
PASS  tab A: the form is cleared after success
PASS  tab B: does not change by itself (no polling)
PASS  tab B: after a reload shows the record saved in tab A
PASS  both tabs show the same records after refresh
PASS  pending save disables the button and says "Saving..."
PASS  double click + Enter while pending stores exactly one record
PASS  a submit event during the pending save is ignored by the in-flight guard
PASS  overlapping saves: the server answered one 409
PASS  overlapping saves: the client said it was retrying
PASS  overlapping saves: both records stored, none lost
PASS  after a server restart both tabs list every record
PASS  server down: a recoverable message replaces "Saving..."
PASS  server down: the typed values are kept and Try again is offered
PASS  after restart, Try again saves exactly one record
PASS  lost response: the server had stored it, the page showed "Not saved"
PASS  lost response: Try again reports "Already saved" and adds no duplicate
PASS  hung request: a timeout message after about 8 s, button usable again
PASS  the form has exactly one submit listener

21/21 study-log browser checks passed
```

The same script passed three further consecutive runs during development.

- **Two tabs**: after tab A saved "Node http module", tab B still showed the empty state until it reloaded, then listed record 1. After tab B saved "REST status codes" and tab A pressed **Refresh list**, both tabs listed ids `2,1` with identical notes. Tab B at both widths: [`log-tab-b-1280.png`](screenshots/log-tab-b-1280.png), [`log-tab-b-360.png`](screenshots/log-tab-b-360.png); empty state: [`log-empty-1280.png`](screenshots/log-empty-1280.png).
- **Double submission**: two clicks on **Save session** and an Enter key press while the first save was pending (button disabled, label "Saving...": [`log-pending-1280.png`](screenshots/log-pending-1280.png)) stored one record. The disabled button already swallows clicks and the Enter key (implicit submission does nothing when the form's default button is disabled), so the script also called `form.requestSubmit()`, which bypasses the button; the handler's own guard logged:

  ```text
  [study-log] submit 2: POST /api/sessions (key 2922fd89-5fa7-4e10-9c58-77bfb4ff52b9)
  [study-log] submit 3 ignored: a save is already pending
  ```
- **Overlap from two tabs**: both tabs saved at once. Server log: `POST /api/sessions -> 409 (1.0 ms)`, `POST /api/sessions -> 201 (408.5 ms)`, `POST /api/sessions -> 201 (412.4 ms)`. The losing tab showed "The log is busy; retrying (1)...", waited the `Retry-After` second, retried and saved. Both records (ids 4 and 5) are in the file.
- **Restart**: the script stopped the server with SIGINT (exit `{"code":0,"signal":null}`, log line `SIGINT received, finishing in-flight requests`), started a new process on the same port and file, and reloaded both tabs; both listed all 5 records.

Final file of that run: ids 1-7, "Node http module", "REST status codes", "Double click test", "Overlap from tab B", "Overlap from tab A", "Saved during the outage", "Response lost on the way back" - one record per intended save, no duplicates. ("Hung request" in check 20 never reached the server.)

## 5. Outage report: server stopped while the page is open (Break it on purpose, DoD 4)

**Fault.** On a temporary branch `drill/p06-no-failure-handling`, the save handler in `web/js/study-log.mjs` was reduced to the happy path: `await addSession(...)` with no `try/catch`, and `setSaving(false)` only after success - the code a first version naturally has.

**Procedure** (identical for fault and repair; a scratch script, not committed): start `node server/main.mjs --port 3456` as its own process, open `log.html` in headless Chrome, save one session, stop the server with SIGINT (what Ctrl+C sends), confirm with `curl` that nothing listens, type a new session and click **Save session**, sample the page at 1, 5 and 12 seconds, restart the server, press **Try again** (or **Save session** when there is no Try again button), and read the data file.

**Symptom with the fault** ([`evidence/drill-broken-transcript.txt`](evidence/drill-broken-transcript.txt), screenshot [`drill-broken-server-down.png`](screenshots/drill-broken-server-down.png)):

```text
== stop the server (SIGINT, as Ctrl+C would)
  [server] SIGINT received, finishing in-flight requests
  exit: {"code":0,"sig":null}
  $ curl -sS http://127.0.0.1:3456/health
  curl: (7) Failed to connect to 127.0.0.1 port 3456 after 0 ms: Couldn't connect to server (exit 7)
== submit a session while the server is down
  [console.info] [study-log] submit 2: POST /api/sessions (key 71375522-ff49-4500-a711-805e5bfca859)
  [network] POST /api/sessions failed: net::ERR_CONNECTION_REFUSED
  [uncaught] NetworkError: The StudyTrack server could not be reached.
  t+1s page: {"status":"Saving...","button":"Saving... (disabled)","retry":false,"form":"40 / During the outage"}
  t+5s page: {"status":"Saving...","button":"Saving... (disabled)","retry":false,"form":"40 / During the outage"}
  t+12s page: {"status":"Saving...","button":"Saving... (disabled)","retry":false,"form":"40 / During the outage"}
  stored records: ["#1 30 Before the outage"]
== restart the server
  ...
== no Try again button; press Save session
  page: {"status":"Saving...","button":"Saving... (disabled)","retry":false,"form":"40 / During the outage"}
  stored records: ["#1 30 Before the outage"]
```

**Evidence and diagnosis.** The network event is `net::ERR_CONNECTION_REFUSED`: no HTTP response exists, so `fetch()` *rejected*. Nothing in the handler caught the rejection, so it surfaced as an uncaught promise rejection (`[uncaught] NetworkError`) and the code after the `await` - including `setSaving(false)` - never ran. The page stayed on "Saving..." with a disabled button for good, even after the server came back; the only way out was reloading, which throws away the typed entry.

**Repair.** Returned to `main` (branch deleted, never pushed), where the handler has `try { ... } catch (err) { ... }`: the catch writes a message chosen by error type, re-enables the button, keeps the typed values and shows **Try again**. `sessions-api.mjs` turns the rejection into a `NetworkError` and gives every request an 8-second timeout, so a hung server also ends in a message.

**Verification** ([`evidence/drill-repaired-transcript.txt`](evidence/drill-repaired-transcript.txt), screenshots [`drill-repaired-server-down.png`](screenshots/drill-repaired-server-down.png), [`drill-repaired-after-retry.png`](screenshots/drill-repaired-after-retry.png)):

```text
== submit a session while the server is down
  [console.info] [study-log] submit 2: POST /api/sessions (key 026887f9-65f5-4b38-a8cb-da4ee1c74348)
  [network] POST /api/sessions failed: net::ERR_CONNECTION_REFUSED
  [console.warning] [study-log] save failed: NetworkError The StudyTrack server could not be reached.
  t+1s page: {"status":"Not saved: The StudyTrack server could not be reached. It may be stopped or restarting. Your entry is still in the form. When the server is running, press Try again; it will not create a duplicate.","button":"Save session","retry":true,"form":"40 / During the outage"}
  ...
  stored records: ["#1 30 Before the outage"]
== restart the server
  ...
== press Try again
  [console.info] [study-log] submit 3: POST /api/sessions (key 026887f9-65f5-4b38-a8cb-da4ee1c74348)
  [server] POST /api/sessions -> 201 (7.4 ms)
  page: {"status":"Saved session #2: 40 minutes.","button":"Save session","retry":false,"form":" / "}
  stored records: ["#1 30 Before the outage","#2 40 During the outage"]
```

The retry carried the same `Idempotency-Key` as the failed attempt (`026887f9-...`), and exactly one record was added. The scenario is automated as checks 15-17 in section 4 ([`log-server-down-1280.png`](screenshots/log-server-down-1280.png), [`log-server-down-360.png`](screenshots/log-server-down-360.png), [`log-recovered-1280.png`](screenshots/log-recovered-1280.png)).

**Why "no duplicate" needs more than a retry button.** When the server is already stopped, a retry cannot duplicate anything: the first attempt never arrived. The dangerous case is a server that stored the record and then failed to deliver the response. Checks 18-19 reproduce it with the CDP `Fetch` domain: the POST reaches the server and is stored, then the browser's response is replaced by `ConnectionReset`. The page shows "Not saved"; **Try again** sends the same key, the server answers `200` with the existing record, the page says "Already saved as session #7; no duplicate was added.", and the file holds one copy.

## 6. Constraints

| Constraint | Evidence |
| --- | --- |
| C1 no Express or router | `package.json` has no dependencies; `test/server-constraints.test.js` checks that every import in `server/` is `node:` or a relative file. Routing is plain comparison (`pathname === '/api/sessions'`) in `server/api.mjs`. |
| C2 one process, one writer | `createSessionStore` guards writes with an in-memory flag, which by construction only works inside one process; `server/main.mjs` and the README say not to run `planner.js add` on the same file while the server runs. No cross-process locking is claimed. |
| C3 no blocking file I/O in handlers | `test/server-constraints.test.js`: no `*Sync(` call in any `server/*.mjs` file or in the promise half of `src/storage.js`. The CLI half keeps its P2 synchronous calls; the CLI is not a request handler. |

```text
$ node --test test/server-constraints.test.js
✔ server/ has the expected modules
✔ server/api.mjs: imports only node: built-ins and files in this repo
✔ server/api.mjs: no blocking (*Sync) calls
... (the same two checks for app.mjs, http-json.mjs, main.mjs, static.mjs)
✔ src/storage.js: the promise API uses no *Sync calls
✔ package.json has no dependencies
ℹ pass 13
```

## 7. Extra drill: the lost update the guard prevents (R4)

Not required by the brief, but it shows why R4 exists. On a temporary branch `drill/p06-no-write-guard`, the line `if (busy) throw new StoreBusyError(file);` in `createSessionStore` was commented out. Five POSTs sent at once to a server with `--write-delay-ms 200`:

```text
--- fault:
request 1: 201 {"session":{"id":1,"minutes":1,"note":"request 1",...}}
request 2: 201 {"session":{"id":1,"minutes":2,"note":"request 2",...}}
request 3: 201 {"session":{"id":1,"minutes":3,"note":"request 3",...}}
request 4: 201 {"session":{"id":1,"minutes":4,"note":"request 4",...}}
request 5: 201 {"session":{"id":1,"minutes":5,"note":"request 5",...}}
acknowledged (201): 5, stored: 1 -> [[1,"request 5"]]
```

All five clients were told "201 Created", all five got id 1, and the file holds only the last: four acknowledged records silently lost. Each request read the empty file, waited, and wrote a list containing only its own record; the last rename won. The suite caught it (`✖ 409 write_conflict, retryable with Retry-After, for an overlapping write; no record lost`, `✖ an overlapping add is rejected with StoreBusyError and nothing is lost`, `✖ ten concurrent adds: ...`). Back on `main` (branch deleted):

```text
--- repaired (main):
request 1: 201 {"session":{"id":1,"minutes":1,"note":"request 1",...}}
request 2: 409 Retry-After: 1 {"error":{"code":"write_conflict","message":"Another write is in progress. Retry the same request shortly.","retryable":true}}
... (requests 3-5 identical)
acknowledged (201): 1, stored: 1 -> [[1,"request 1"]]
```

## 8. Earlier work still green (DoD 4)

```text
$ npm test
...
ℹ tests 140
ℹ pass 140
ℹ fail 0
...
--- Testing Stretch Goal: --help ---
PASS: node planner.js --help works as expected

================================
Result: 13/13 tests passed.
================================
```

This includes the P1 calculation unit tests and 13 P1 acceptance cases, the P2 storage and CLI integration tests (test files unchanged, run against the refactored `src/storage.js`), and the P4/P5 web tests. The P5 browser checks, which now use the extracted `server/static.mjs`, still pass:

```text
$ npm run test:browser
...
21/21 browser checks passed
```

## 9. GitHub Pages and deployment (R6)

The Pages workflow is unchanged and publishes `web/`, so `log.html` will also exist on the static site, where there is no API. That case was checked locally with the P5 static server, which, like Pages, answers `/api/sessions` with an HTML 404:

```text
static server (no API), log.html list state: Could not load sessions: this address has no StudyTrack API (HTTP 404). Open the page from the StudyTrack server (npm start).
GET /api/sessions on the static server -> 404 text/html; charset=utf-8
```

Screenshot: [`log-static-no-api-1280.png`](screenshots/log-static-no-api-1280.png). Remote deployment of the Node service is deferred to P22, as the brief says; the reproducible local version is `npm start` (no packages, no install step).

## 10. Explain: a rejected promise versus an HTTP error response

Full answer in [learning.md section 6](learning.md#6-answer-a-rejected-promise-versus-an-http-error-response). In short: `fetch()` rejects only when there is **no HTTP response at all** (connection refused or reset, DNS failure, CORS block, abort or timeout) - the outage drill's `net::ERR_CONNECTION_REFUSED`. A 4xx or 5xx is a **complete, successfully delivered HTTP response**, so `fetch()` resolves with `response.ok === false`, and the body (our JSON error) says what the server decided - the 409 and 422 examples above. `web/js/sessions-api.mjs` maps the first to `NetworkError` and the second to `ApiError`, and the page reacts differently to each.

## Uncertain or not observed

- No screen reader was run (headless). The save and list messages use `role="status"` live regions, as in P5.
- `fsync` is called on the temporary file but not on the directory after `rename`; after a power cut right after the rename, some file systems could lose the rename itself. A process crash (the realistic local failure) is covered.
- The 409 path is timing-dependent; tests make it deterministic with `--write-delay-ms`. With no delay, real overlaps are rare locally because a write takes a few milliseconds.
