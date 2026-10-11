# StudyTrack — Study-Time Calculator & Persistent Study Log

> **About this repository.** `studytrack-platform` continues StudyTrack from **Project 3 onward** (Projects 3-52 of the curriculum). It was cloned from the original `studytrack` repository, which stays at Projects 1-2, with the full Git history preserved, so the Project 1 and Project 2 code and commits are still here.

A terminal application for planning study goals, logging study sessions, and tracking progress over time.

StudyTrack began as a stateless study-time calculator (**Project 1**) and has been extended into a persistent study log that survives process restarts (**Project 2**). **Project 3** adds a second runnable artifact: a static, accessible public study profile page in `web/` (HTML and CSS only, no JavaScript). **Project 4** publishes that page on the internet with GitHub Pages: https://itsbhavinrey.github.io/studytrack-platform/ . **Project 5** turns the page's goal form into an interactive weekly planner that runs the Project 1 calculation in the browser: https://itsbhavinrey.github.io/studytrack-platform/#planner . **Project 6** adds a small Node server (`npm start`, no framework) that serves the pages and a JSON API from one origin, so several browser tabs can add study sessions to one shared, persistent log.

---

## Purpose

- **Project 1**: Understand terminal environments, Node CLI execution, pure calculations, input validation, and Git version control.
- **Project 2**: Build modular JavaScript/Node applications, design JSON data models, implement file persistence, handle absent and corrupted data safely, and write thorough unit and integration test suites.
- **Project 3**: Learn the browser document model with semantic HTML (landmarks, headings, lists, labels), the CSS cascade and box model, one responsive layout technique (flexbox), and keyboard and contrast accessibility checks.
- **Project 4**: Trace a real browser request (DNS, HTTPS, HTTP status and content type), publish a static artifact, use a branch + pull request + merge workflow, and practise rollback.
- **Project 6**: Build an HTTP server with only `node:http`, design a REST resource with a written request/response contract and consistent JSON errors, use promises and `async`/`await` without blocking the event loop, and make concurrent writes and network failures safe and visible.
- **Project 5**: Handle DOM events without a framework (one listener per action, `preventDefault`, closures holding handler state), update the page safely with `textContent`, make errors and results accessible, reuse the P1 module in the browser, and see reflow versus repaint in a performance trace.

### Learning Topics

- **Frontend > JS / TS / Node**: Arrays, objects, modules (CommonJS), JSON serialization, file system persistence (`fs`), and pure functions.
- **Common > Testing and Performance**: Unit testing with Node's native test runner (`node:test`), assertions (`node:assert`), boundary value analysis, and process-level integration testing.
- **Common > Documentation**: Comprehensive setup, reproducible examples, and failure drills.
- **Frontend > CSS** (Project 3): Semantic HTML for headings, navigation, forms and lists; the cascade, box model, and a responsive flexbox layout.
- **Common > Testing and Performance** (Project 3): Keyboard and basic accessibility checks.
- **Common > Fundamentals > Networking** (Project 4): HTTP/HTTPS, URLs, DNS, requests, responses and status codes.
- **Common > Dev environment and deployment** (Project 4): Publishing a static artifact (GitHub Pages via GitHub Actions).
- **Common > VCS and hosting > GitHub** (Project 4): Remote branches, a pull request, and the merge workflow.
- **Frontend > JS / TS / Node** (Project 5): DOM events and updates; closures and event-handler state; ES modules shared by Node and the browser.
- **Frontend > How browsers work** (Project 5): The rendering path, and reflow versus repaint.
- **Frontend > JS / TS / Node** (Project 6): The native Node HTTP server runtime; promises, `async`/`await`, concurrency and an initial event-loop model.
- **Backend > APIs** (Project 6): REST resources and request/response contracts.

---

## Prerequisites

- **Node.js**: `v22.12.0` or higher (built and verified with `v24.14.0`). Since Project 5 the CLI loads the shared ES module `web/js/calculation.mjs` with `require()`, which Node supports from 22.12.
- **Git**: `v2.0.0` or higher (built and verified with `2.50.1`).
- Operating system: macOS, Linux, or Windows.
- **Zero third-party dependencies**: Uses only Node.js standard libraries (`node:fs`, `node:path`, `node:os`, `node:child_process`, `node:http`, `node:crypto`, `node:test`, `node:assert`).
- **Optional, Project 4 checks**: `npm run check:site` needs Node.js `v22` or higher (global `fetch` and `WebSocket`) and Google Chrome (set `CHROME_PATH` if it is not at the default macOS location). The DNS/HTTP/HTTPS evidence commands use `dig`, `curl` and `openssl`. None of these are needed for the CLI or `npm test`.
- **Optional, Project 5 checks**: `npm run test:browser` and `npm run record:planner` need the same Node.js and Google Chrome. `npm run serve` needs only Node.js.
- **Project 6 server**: `npm start` needs only Node.js (no `npm install`; there are no packages). `npm run test:browser:log` also needs Google Chrome.

Check your installed versions:

```bash
node --version
git --version
```

---

## Project Structure & Architecture

```text
studytrack-platform/
├── planner.js              # CLI entry point delegating to command handler
├── prd.md                  # Project 1 Product Requirements Document
├── prd2.md                 # Project 2 Product Requirements Document
├── package.json            # Test runner scripts (no third-party dependencies)
├── README.md               # Documentation, usage guide, and verification notes
├── .github/workflows/
│   └── pages.yml           # Project 4: test, publish web/ to GitHub Pages, verify the public site
├── server/                 # Project 6: the app server (node:http only, ES modules)
│   ├── main.mjs            # npm start: flags, startup, graceful stop on Ctrl+C / SIGTERM
│   ├── app.mjs             # One origin: /health, /api/..., static web/ files; one error catch-all
│   ├── api.mjs             # The session resource: GET/POST /api/sessions, GET /api/sessions/{id}
│   ├── http-json.mjs       # Body reading (415/413/400), JSON responses, the JSON error format
│   └── static.mjs          # web/ files under /studytrack-platform/ (shared with scripts/serve.mjs)
├── web/                    # The study profile, planner and study log; the published site root
│   ├── index.html          # Semantic page structure: landmarks, headings, lists, table, planner form
│   ├── log.html            # Project 6: the shared study log page (needs the server)
│   ├── styles.css          # Hand-written CSS: cascade, flexbox layout, focus, error and result states
│   ├── 404.html            # Project 4: page GitHub Pages serves for missing paths
│   └── js/
│       ├── calculation.mjs # Project 5: the shared pure P1/P2 module (ES module, Node + browser)
│       ├── planner.mjs     # Project 5: form events, validation display, result rendering
│       ├── sessions-api.mjs # Project 6: the browser API client (the only fetch caller)
│       └── study-log.mjs   # Project 6: study log states, double-submit guard, retry
├── scripts/
│   ├── serve.mjs           # Project 5: local static server for web/ at /studytrack-platform/
│   ├── check-site.mjs      # Project 4: headless-Chrome network + viewport check of a URL
│   ├── check-planner.mjs   # Project 5: headless-Chrome checks of the planner (P1 cases, cycles, keyboard, a11y)
│   ├── check-study-log.mjs # Project 6: two tabs, double submit, overlap, restart, outage in headless Chrome
│   ├── record-planner.mjs  # Project 5: performance trace + WebM recording of the planner
│   └── lib/cdp.mjs         # Minimal Chrome DevTools Protocol client shared by the scripts
├── docs/
│   └── projects/
│       ├── p03/
│       │   ├── prd.md      # Project 3 brief as a checklist, plus build decisions
│       │   ├── report.md   # Viewport, keyboard, contrast checks and failure report
│       │   ├── learning.md # Concept notes, code walkthrough, self-quiz
│       │   └── screenshots/ # 360px/1280px pages, focus states, break before/after
│       ├── p04/            # Project 4 prd, report (DNS/HTTP/rollback evidence), learning notes, screenshots
│       ├── p05/            # Project 5 prd, report, learning notes, screenshots, perf/ (trace + recording)
│       └── p06/            # Project 6 prd, report, learning notes, screenshots, evidence/ (captured outputs)
├── src/
│   ├── calculation.js      # CommonJS bridge: re-exports web/js/calculation.mjs for Node
│   ├── storage.js          # File persistence (sync API for the CLI, promise API + single-writer store for the server)
│   └── cli.js              # Command dispatch, argument parsing, and console output
└── test/
    ├── acceptance.js       # Project 1 acceptance test runner (13 test cases)
    ├── calculation.test.js # Unit tests for pure calculation and validation functions
    ├── storage.test.js     # Unit tests for file persistence and corrupt file safety
    ├── p2.test.js          # Integration tests for multi-run persistence and commands
    ├── shared-module.test.js # Project 5: Node and browser get the same environment-neutral module
    ├── plan-input.test.js  # Project 5: planner form validation with every P1 case
    ├── web.test.js         # Projects 4-6: resource links, module imports, no inline handlers/innerHTML/storage
    ├── session-input.test.js # Project 6: validateSessionInput() rules and limits
    ├── session-store.test.js # Project 6: promise storage, atomic write, overlap rejection, idempotent add
    ├── api.test.js         # Project 6: every endpoint and error against a real server
    └── server-constraints.test.js # Project 6: no framework imports, no *Sync calls in the server
```

### Module Separation (Requirement 3)

1. **`web/js/calculation.mjs`** (loaded in Node through the one-line bridge `src/calculation.js`): Contains pure, deterministic functions with no side effects and no file/terminal I/O. Handles week estimations, accumulated minute totals, hours conversions, rounding, and input validation. Since Project 5 it is an ES module inside `web/` so the browser can load the very same file; it must not use Node-only or browser-only APIs.
2. **`src/storage.js`**: Manages file read/write operations using Node's `fs` module. Encapsulates single-writer persistence, generates sequential IDs, handles missing files gracefully, and detects corrupted JSON without overwriting it. Since Project 6 it has two APIs over one file format: synchronous functions for the CLI, and promise-based functions plus `createSessionStore()` (atomic writes, one write at a time, idempotent add) for the server.
3. **`src/cli.js`**: Parses flags and arguments, coordinates calculations and storage, formats human-readable terminal output, and sets proper process exit codes.
4. **`planner.js`**: The main executable script that passes `process.argv` to `src/cli.js`.
5. **`server/`** (Project 6): HTTP only. It knows requests, statuses and JSON; it reaches the file only through the store from `src/storage.js`, and validates with `validateSessionInput()` from the shared module.

---

## Usage & Commands

### 1. Study-Time Calculator (Project 1)

Calculates the total weeks required to complete a study goal and the hours needed in the final week.

```bash
node planner.js <totalHours> <weeklyHours>
```

**Example:**

```bash
node planner.js 30 12
```

**Output:**
```text
Total hours: 30 hours
Weekly hours: 12 hours
Required weeks: 3 weeks
Final-week hours: 6 hours
```

### 2. Log a Study Session (`add`)

Logs a completed study session with duration in minutes and a descriptive note.

```bash
node planner.js add <minutes> <note> [--file <path>]
```

- `<minutes>`: Positive whole number (`> 0`).
- `<note>`: Non-empty string describing the session.
- `--file <path>`: Optional custom data file path (defaults to `studytrack-data.json`).

**Example:**

```bash
node planner.js add 45 "Completed JavaScript array methods exercises"
```

**Output:**
```text
Added session #1: 45 minutes - "Completed JavaScript array methods exercises"
Total study time logged: 45 minutes (0.75 hours across 1 session)
```

### 3. Study Progress Summary (`summary`)

Calculates accumulated study time from the persistent log and provides an updated estimate of weeks remaining toward a target study goal.

```bash
node planner.js summary <goal-hours> <weekly-hours> [--file <path>]
```

**Example:**

```bash
node planner.js summary 30 12
```

**Output (Partial Progress):**
```text
Goal hours: 30 hours
Weekly hours: 12 hours
Logged sessions: 2 sessions
Completed time: 120 minutes (2 hours)
Remaining hours: 28 hours
Estimated weeks remaining: 3 weeks
Final-week hours: 4 hours
```

**Output (Completed Goal):**
```text
Goal hours: 10 hours
Weekly hours: 5 hours
Logged sessions: 5 sessions
Completed time: 600 minutes (10 hours)
Remaining hours: 0 hours
Status: Goal completed! 0 weeks remaining.
```

### 4. View Session History (`log` — Stretch Goal)

Lists the most recent study sessions (up to the latest 5 sessions) with session IDs, timestamps, durations, and notes.

```bash
node planner.js log [--file <path>]
```

**Example Output:**
```text
Recent study sessions (showing latest 2 of 2):
  #1 [9/19/2026, 1:33:04 AM] 45 min - "Learned Node fs module"
  #2 [9/19/2026, 1:33:04 AM] 75 min - "Built storage module"
```

### 5. Help & Options

```bash
node planner.js --help
# or
node planner.js -h
```

### 6. Public Study Profile Page (Project 3)

A web page in `web/` showing a learner's goal, weekly availability, three resources, a sample weekly plan, and (since Project 5) the interactive weekly planner. Since Project 5 it loads one JavaScript module, so preview it through the local server described in section 8; opening `web/index.html` from disk still shows the static content, but the planner does not work there.

The sample plan matches the calculator: `node planner.js 30 12` gives 3 weeks with 6 hours in the final week, and the page shows 12 + 12 + 6 hours.

### 7. Published Study Profile (Project 4)

The page in `web/` is published at **https://itsbhavinrey.github.io/studytrack-platform/** by the GitHub Actions workflow `.github/workflows/pages.yml`. GitHub Pages serves the contents of `web/` as the site root, so the relative `styles.css` link works both from disk and online. There is no backend and no custom domain.

**How a change gets published**

1. Make the change on a branch, push it, and open a pull request: `git switch -c my-change`, commit, `git push -u origin my-change`, `gh pr create`.
2. Inspect the diff (`gh pr diff <n>`), then merge with a merge commit (`gh pr merge <n> --merge`), and update local `main` with `git pull --ff-only`.
3. The push to `main` (when it touches `web/` or the workflow) starts the workflow. It runs `npm test`, copies `web/` into the site, adds `version.txt`, deploys, and then its `verify` job checks the **public** site: it waits until `version.txt` reports the new commit, then checks the document (200 `text/html`), the stylesheet (200 `text/css`), a missing path (404) and every local resource.

**Which commit is live?**

```bash
curl -s https://itsbhavinrey.github.io/studytrack-platform/version.txt
```

This prints `commit: <sha>`, `ref: ...` and `run: <Actions run id>`. Trust this file over the GitHub deployments page, which records the workflow's commit rather than the commit that was deployed (see `docs/projects/p04/report.md`, section 2).

**Roll back to a known-good page**

```bash
gh workflow run pages.yml --ref main -f ref=<known-good-sha>   # deploy an earlier commit
gh run watch                                                    # wait; the verify job must pass
curl -s https://itsbhavinrey.github.io/studytrack-platform/version.txt
gh workflow run pages.yml --ref main -f ref=main               # roll forward when fixed
```

The same can be done from the Actions tab ("Publish study profile" → "Run workflow", fill in `ref`). A redeploy does not change `main`, so the next push to `main` would publish the bad change again. To make a rollback permanent, `git revert <bad-commit>` on a branch and merge it through a PR.

**Check the public page yourself**

```bash
dig itsbhavinrey.github.io A +noall +answer                                   # name -> addresses
curl -sI https://itsbhavinrey.github.io/studytrack-platform/                   # 200 text/html
curl -sI https://itsbhavinrey.github.io/studytrack-platform/styles.css         # 200 text/css
npm run check:site -- https://itsbhavinrey.github.io/studytrack-platform/ --screenshots /tmp/shots
```

`check:site` needs Google Chrome (set `CHROME_PATH` if it is not in the default macOS location). It records each request's status and Content-Type, which is the same data as the DevTools Network panel, checks for horizontal scrolling at 360px and 1280px, and exits 1 on any required-resource failure.

Note that GitHub Pages responses are cacheable for 10 minutes (`cache-control: max-age=600`), so a browser may show the previous version briefly after a deploy or rollback.

### 8. Interactive Weekly Planner (Project 5)

Live: **https://itsbhavinrey.github.io/studytrack-platform/#planner**

Run it locally (no packages):

```bash
npm run serve            # Serving web/ at http://127.0.0.1:8080/studytrack-platform/
# open http://127.0.0.1:8080/studytrack-platform/#planner ; Ctrl+C to stop
npm run serve -- --port 9000   # another port
```

A server is needed because browsers refuse to load module scripts from `file://` pages. `scripts/serve.mjs` serves `web/` under the same `/studytrack-platform/` path as GitHub Pages, with `text/javascript` for `.mjs` and the 404 page for unknown paths.

**Using it**

1. Enter a goal name, the total hours it needs and the hours available per week (whole numbers).
2. Press **Plan my weeks** or Enter. The page does not reload. A summary sentence appears (announced by screen readers through a `role="status"` live region), with a week-by-week table for plans of up to 52 weeks. `30` / `12` gives 3 weeks: 12 + 12 + 6 hours, the same as `node planner.js 30 12`.
3. Invalid input follows Project 1's rules (positive whole numbers only; surrounding spaces are ignored, as the shell ignores them). Each problem is shown under its own field, the field is marked `aria-invalid` and described by the message, the previous result is removed, and focus moves to the first invalid field.
4. **Reset** empties all fields and removes errors, the status and the table, then puts focus on the goal name.

**How it is built**

- `web/js/calculation.mjs` holds the P1/P2 pure functions plus `validatePlanInput()` and `weeklyBreakdown()`. The browser imports it; Node `require()`s it through `src/calculation.js`.
- `web/js/planner.mjs` calls `wirePlanner(form)` once, which registers exactly one `submit` and one `reset` listener. Each submit logs `[planner] submit handled by handler #1 (run N)` to the console, so a duplicate registration is visible.
- All text, including the goal name, is written with `textContent`; no `innerHTML`, no inline `on*` attributes, no browser storage, no framework or packages.

### 9. Shared Study Log Server (Project 6)

Two (or more) browser tabs add study sessions to one log kept by a small Node server.

```bash
npm start
# StudyTrack server listening on http://127.0.0.1:3000
# Study log: http://127.0.0.1:3000/studytrack-platform/log.html
# Data file: <working directory>/studytrack-data.json
```

Open the study log URL in two tabs. Save a session in one; press **Refresh list** (or reload) in the other and it appears. Stop the server with Ctrl+C and start it again: the sessions are still there. Options: `npm start -- --port 3100`, `--host`, `--data <file>` (default: `STUDYTRACK_DATA_FILE`, else `studytrack-data.json`, the same file the CLI uses), `--write-delay-ms <n>` (pauses every write, only for demonstrating overlapping writes).

One process is the only writer of the data file while it runs. Reading it with `node planner.js summary` or `log` is fine; do not run `node planner.js add` on the same file at the same time (the overlap guard works inside one process only).

The pages are served under `/studytrack-platform/` (the GitHub Pages path), and `/` redirects to the study log. GitHub Pages also publishes `log.html`, but Pages has no API, so there the page only explains that the log needs the local server. Remote deployment of the server is planned for Project 22.

**API contract**

| Request | Success | Errors (always JSON) |
| --- | --- | --- |
| `GET /health` | `200 {"status":"ok","storage":"ok","sessions":N,"uptimeSeconds":S}` | `503 {"status":"error","storage":"corrupt"}` (or `"unreadable"`) |
| `GET /api/sessions` | `200 {"sessions":[{"id","minutes","note","timestamp"}...],"count":N,"totalMinutes":M}` | `500 storage_corrupt` |
| `POST /api/sessions` | `201 {"session":{...}}` with `Location: /api/sessions/{id}` | see below |
| `GET /api/sessions/{id}` | `200 {"session":{...}}` | `404 not_found` |

`POST /api/sessions` rules:

- Header `Content-Type: application/json`, otherwise `415 unsupported_media_type`.
- Body at most 4096 bytes, otherwise `413 body_too_large` (checked from `Content-Length` and by counting a chunked body).
- Body is UTF-8 JSON, otherwise `400 invalid_json`; a JSON object, otherwise `400 invalid_body`.
- Exactly the fields `minutes` (a JSON integer, 1 to 1440) and `note` (a string, 1 to 200 characters after trimming); anything else is `422 validation_failed` with a message per field in `details`.
- Optional header `Idempotency-Key` (8-100 letters, digits, `-`, `_`): repeating a request with a key that was already stored returns that record with `200` and `Idempotent-Replayed: true` instead of creating a duplicate. Reusing a stored key with a different `minutes` or `note` (after trimming) is `422 idempotency_key_mismatch` and stores nothing: one key means one entry.
- If another write is in progress: `409 write_conflict`, `Retry-After: 1`, `"retryable": true`. Nothing was stored; send the same request again.
- The response is sent only after the record is on disk (temporary file, `fsync`, atomic `rename`).

Every error body has the same shape:

```json
{ "error": { "code": "write_conflict", "message": "Another write is in progress. Retry the same request shortly.", "retryable": true } }
```

Other methods get `405 method_not_allowed` with an `Allow` header; unknown `/api/...` paths get `404 not_found`.

**Try it with curl** (server running):

```bash
curl -i http://127.0.0.1:3000/health
curl -i -X POST http://127.0.0.1:3000/api/sessions -H 'Content-Type: application/json' -d '{"minutes":45,"note":"Node http module"}'
curl -i http://127.0.0.1:3000/api/sessions
curl -i -X POST http://127.0.0.1:3000/api/sessions -H 'Content-Type: application/json' -d '{"minutes":45,'   # 400 invalid_json
```

**What the page does**: it shows loading, empty, success and failure states; disables **Save session** while a save is pending (and ignores any extra submit); keeps your entry and offers **Try again** if the server cannot be reached or does not answer within 8 seconds; retries a `409` automatically after `Retry-After`; and sends one idempotency key per entry, so trying again never adds a duplicate.

---

## Data Storage & Persistence

### Data Location

By default, session data is stored in `studytrack-data.json` within the current working directory.

You can override the data file location in two ways:
1. **CLI Flag**: Add `--file <path>` or `-f <path>` to any command:
   ```bash
   node planner.js --file ./data/my-sessions.json add 60 "Studying"
   ```
2. **Environment Variable**: Set `STUDYTRACK_DATA_FILE`:
   ```bash
   export STUDYTRACK_DATA_FILE="/path/to/my-sessions.json"
   node planner.js summary 30 12
   ```

### JSON Schema

Sessions are stored as a JSON array of objects:

```json
[
  {
    "id": 1,
    "minutes": 45,
    "note": "Completed JavaScript array methods exercises",
    "timestamp": "2026-09-18T20:03:04.123Z"
  }
]
```

- `id`: Auto-incrementing positive integer starting at 1.
- `minutes`: Integer duration in minutes.
- `note`: Cleaned, trimmed descriptive text.
- `timestamp`: ISO 8601 UTC timestamp recorded at time of creation.
- `requestId` (Project 6, optional): the `Idempotency-Key` of the HTTP request that created the record. The CLI ignores it and the API does not return it.

The CLI and the Project 6 server read and write the same format, so `node planner.js summary 30 12` reports sessions saved through the browser.

---

## Display Rounding & Conversion Rules (Requirement 3)

1. **Minute-to-Hour Conversion**:
   - Converted using exact floating-point division: \(\text{hours} = \text{minutes} / 60\).
2. **Display Rounding Rule**:
   - Completed hours and remaining hours are rounded to 2 decimal places using standard half-up rounding (\(\text{round}(\text{hours} \times 100) / 100\)).
   - Clean formatting: Whole numbers are presented without trailing zeros (e.g. `2 hours` instead of `2.00 hours`; `0.75 hours`; `1.67 hours`).
3. **Weeks Remaining Rule**:
   - \(\text{remainingHours} = \max(0, \text{goalHours} - \text{completedHours})\).
   - If \(\text{remainingHours} > 0\), required weeks are rounded up to the nearest whole integer: \(\lceil \text{remainingHours} / \text{weeklyHours} \rceil\).
   - For exact multiples, the final week reflects the full weekly capacity rather than 0.
   - If \(\text{remainingHours} == 0\), remaining weeks is 0, and the status displays `Goal completed! 0 weeks remaining.`

---

## Error & Corruption Handling (Requirement 4)

- **Absent Data File**: If the data file does not exist when running `summary` or `log`, StudyTrack treats it as an empty log (0 sessions, 0 minutes completed) without raising an error or crashing.
- **Corrupted JSON File**: If the data file exists but contains invalid JSON syntax or a non-array root structure:
  - Prints a visible error to `stderr`:
    ```text
    Error: Data file at "<path>" is corrupted or contains invalid JSON: <details>
    The corrupted file was preserved and not overwritten.
    ```
  - Exits with status code `1`.
  - **Does not overwrite or erase** the corrupted file, allowing manual inspection and recovery.

---

## Running Tests

Run all test suites:

```bash
npm test
# or directly with Node:
node --test test/*.test.js && node test/acceptance.js
```

Or run individual test suites:

```bash
# Pure calculation and boundary unit tests:
node --test test/calculation.test.js

# Storage persistence and corruption unit tests:
node --test test/storage.test.js

# Project 2 CLI integration and multi-run tests:
node --test test/p2.test.js

# Project 1 backward-compatibility acceptance tests:
node test/acceptance.js

# Project 4-5 web tests (resource links, module imports, P5 constraints):
npm run test:web

# Project 5 planner validation and shared-module tests:
node --test test/plan-input.test.js test/shared-module.test.js

# Project 5 browser checks in headless Chrome (serves web/ itself on a free port):
npm run test:browser
# the same checks against the public site, plus 360/1280 screenshots:
node scripts/check-planner.mjs https://itsbhavinrey.github.io/studytrack-platform/ --screenshots /tmp/planner-shots

# Project 5 performance trace + recording (writes docs/projects/p05/perf/):
npm run record:planner

# Project 6 server, storage and API tests (included in npm test):
npm run test:api

# Project 6 browser checks: starts the server itself, two Chrome tabs, outage drill:
npm run test:browser:log
node scripts/check-study-log.mjs --screenshots /tmp/log-shots   # JSON report + screenshots
```

`npm test` does not need a browser. `test:browser` and `record:planner` need Google Chrome (see Prerequisites); `check-planner.mjs` prints a JSON report on stdout, a PASS/FAIL line per check on stderr, and exits 1 on any failure.

---

## Project 3 Checks (web page)

Full details, numbers, and screenshots are in [`docs/projects/p03/report.md`](docs/projects/p03/report.md). Concept notes are in [`docs/projects/p03/learning.md`](docs/projects/p03/learning.md).

- **Structure**: `header`, `nav` (named "Profile sections"), `main`, and `footer` landmarks; one `<title>`; one `h1` followed by five `h2`s with no skipped levels.
- **Viewports**: at exactly 360px and 1280px (Chrome DevTools Protocol device emulation), `scrollWidth` equals the viewport width, so there is no horizontal scroll. Screenshots: [`profile-360.png`](docs/projects/p03/screenshots/profile-360.png) and [`profile-1280.png`](docs/projects/p03/screenshots/profile-1280.png).
- **Keyboard check**: pressing Tab from the top reaches all 14 interactive elements (10 links, 3 inputs, 1 button) in reading order:
  1. Skip to main content (skip link)
  2. Goal (nav)
  3. Weekly availability (nav)
  4. Resources (nav)
  5. Sample weekly plan (nav)
  6. Goal form preview (nav)
  7. MDN reference: HTML elements (resource)
  8. MDN guide: basic concepts of flexbox (resource)
  9. W3C: Understanding WCAG contrast (minimum) (resource)
  10. Goal name (input)
  11. Total hours needed (input)
  12. Hours available per week (input)
  13. Plan my weeks (button)
  14. Back to the top of the profile (footer link)

  This is the Project 3 route. Project 5 renamed the nav link "Goal form preview" to "Weekly planner" and added an inline "weekly planner" link and a Reset button, so the route now has 16 stops (11 Tabs to the goal-name field); the current order is in [`docs/projects/p05/report.md` section 5](docs/projects/p05/report.md#5-keyboard-and-error-announcements-definition-of-done-3-r3).

  Each one shows a 3px focus outline: orange `#c2410c` on light areas, yellow `#ffbf47` in the navy header and footer. Every input has a visible label, and its accessible name matches that label.
- **Contrast**: all text pairs are 6.21:1 or higher (WCAG AA needs 4.5:1). Focus rings are 4.83:1 or higher against their background (needs 3:1).
- **Still recommended**: a manual keyboard pass by the owner (Tab, Shift+Tab, Enter, Space) in Chrome and in Safari with "Press Tab to highlight each item" enabled, plus a quick VoiceOver pass. The automated route pressed real Tab keys in headless Chrome, but no human has used the page yet.

### Exercise 4: Removed Label and Focus Style (Project 3)

- **Fault**: on a temporary branch, the "Total hours needed" `<label>` was removed, the input focus rule was deleted, and then `input:focus { outline: none; }` was added.
- **Symptom**: the second field showed "30" with no label, so it was unclear whether that meant hours, weeks, or minutes. Its accessible name became `""`. When focused, it had no ring. Deleting our rule alone was not enough: Chrome's own thin blue ring came back until `outline: none` removed it.
- **Repair**: returned to `main`, which still had the label and the `:focus-visible` outline and border, then deleted the branch.
- **Verification**: repeated the same Tab route. The field's name is "Total hours needed" again, with a 3px orange ring. Before and after screenshots:
  - [`break-before-repair-360.png`](docs/projects/p03/screenshots/break-before-repair-360.png)
  - [`break-after-repair-360.png`](docs/projects/p03/screenshots/break-after-repair-360.png)
  - 1280px versions are in the same folder.

---

## Project 4 Checks (published site)

Full evidence is in [`docs/projects/p04/report.md`](docs/projects/p04/report.md), and the concept notes are in [`docs/projects/p04/learning.md`](docs/projects/p04/learning.md).

- **PRs**: [#1](https://github.com/itsbhavinrey/studytrack-platform/pull/1) published the page (merge commit `e413661`). [#2](https://github.com/itsbhavinrey/studytrack-platform/pull/2) added verification and the 404 page (merge commit `c797230`, the live commit).
- **DNS**: `itsbhavinrey.github.io` resolves to four A records (`185.199.108-111.153`) and four AAAA records. DNS resolves only the host name; the path `/studytrack-platform/...` is handled by the GitHub Pages web server.
- **HTTP/HTTPS**: the document is `200 text/html; charset=utf-8`, the stylesheet is `200 text/css; charset=utf-8`, the certificate is `*.github.io` from Let's Encrypt (verify code 0), and `http://` redirects to `https://` with a 301.
- **Viewports at the public URL**: no horizontal scroll at 360px or 1280px. Screenshots are in `docs/projects/p04/screenshots/`.
- **Rollback**: redeployed `e413661` over `c797230`, confirmed it with `version.txt` and the page text, then rolled forward.

### Exercise 5: Wrong Stylesheet Path on the Public Site (Project 4)

- **Fault**: a temporary branch changed the stylesheet link to `css/styles.css` and was deployed with `gh workflow run pages.yml -f ref=<branch>`. The deploy job was green.
- **Symptom**: the public page rendered unstyled (Times font, bullets, no colours).
- **Evidence**: Chrome network events showed `Stylesheet 404 text/html .../studytrack-platform/css/styles.css`, and `curl -sI` gave the same 404, while the document itself was 200.
- **Repair**: restored `href="styles.css"` on the branch and redeployed. The stylesheet returned `200 text/css` again. Then redeployed `main` and deleted the branch.
- **Prevention**: `test/web.test.js` now fails on that path, and the workflow runs the tests before uploading. Screenshots: [`drill-broken-1280.jpg`](docs/projects/p04/screenshots/drill-broken-1280.jpg) and [`drill-repaired-1280.jpg`](docs/projects/p04/screenshots/drill-repaired-1280.jpg).

---

## Project 5 Checks (interactive planner)

Full evidence is in [`docs/projects/p05/report.md`](docs/projects/p05/report.md); concept notes, a file walkthrough and a self-quiz are in [`docs/projects/p05/learning.md`](docs/projects/p05/learning.md).

- **P1 cases in the browser**: all 4 valid and 8 invalid P1 cases pass on the public site (23/23 browser checks), with one submit per click and no reload.
- **Submit/reset cycles**: five valid-submit, invalid-submit, reset cycles leave empty fields, no errors, no result and focus on the first field.
- **Keyboard and announcements**: Tab reaches the form, Enter submits, focus moves to the first invalid field, Space on Reset clears. Chrome's accessibility tree shows each invalid input as invalid with the error as its description, and the status region as a polite live region. No screen reader was run (headless); a VoiceOver pass is a useful manual check.
- **Performance**: a trace of a submit shows 1 Layout (39 of 246 layout objects dirty, caused by inserting the table and filling the status box); a keyboard focus move shows 0 Layout and 2 Paint (outline only). Files: `docs/projects/p05/perf/`.
- **Recording**: `docs/projects/p05/perf/planner-recording.webm` (12 s) shows valid, invalid and reset behaviour.

### Exercise 6: Submit Handler Registered Twice (Project 5)

- **Fault**: on a temporary branch, a `DOMContentLoaded` listener called `wirePlanner()` a second time. Module scripts already run after parsing, so the form got two `submit` and two `reset` listeners.
- **Symptom**: the page looked correct; one click logged `handler #1 (run 1)` and `handler #2 (run 1)`.
- **Evidence**: `DOMDebugger.getEventListeners` listed two `submit` listeners from the same source line; `check-planner.mjs` failed 14 checks and `npm test` failed `planner.mjs registers one listener per action, once`.
- **Repair**: reverted the extra call; one log line per submit, all checks green; branch deleted unpushed.

## Project 6 Checks (shared study log)

Full evidence is in [`docs/projects/p06/report.md`](docs/projects/p06/report.md); concept notes, a file walkthrough and a self-quiz are in [`docs/projects/p06/learning.md`](docs/projects/p06/learning.md).

- **Contracts**: `test/api.test.js` checks all three endpoints (and `GET /api/sessions/{id}`) against a real server: 200/201/400/404/405/409/413/415/422/500/503, the JSON error shape, `Location`, `Allow`, `Retry-After`. curl examples for success, malformed input and overlap are in the report, section 3.
- **Two tabs and restart**: `npm run test:browser:log` (21 checks): tab B sees tab A's record after reload or Refresh, both tabs list identical records, and all records are still listed after the server process is stopped and started again.
- **Double submission**: while a save is pending the button is disabled and further submits are ignored; double click + Enter stores one record.
- **Overlap**: two saves at once give one `201` and one `409`; the client retries after `Retry-After` and both are stored. With the guard removed (extra drill), five concurrent POSTs all got `201` but only one record survived.

### Exercise 7: Server Stopped While the Page Is Open (Project 6)

- **Fault**: on a temporary branch the save handler had no `try/catch` (happy path only).
- **Symptom**: with the server stopped (SIGINT), Save showed "Saving..." with a disabled button for good - still at 12 s, and still after the server was restarted. Chrome logged `POST /api/sessions failed: net::ERR_CONNECTION_REFUSED` and an uncaught `NetworkError`.
- **Evidence**: `fetch()` rejected (no HTTP response), the rejection escaped the handler, and the line that re-enables the button never ran.
- **Repair**: back on `main`: the handler catches the error, shows "Not saved: The StudyTrack server could not be reached. ... press Try again; it will not create a duplicate.", re-enables the button, keeps the entry; every fetch also has an 8-second timeout.
- **Verification**: same drill on `main`: message within 1 s, server restarted, **Try again** sent the same idempotency key and stored exactly one record. A lost response (stored, but never delivered) is also covered: Try again answers "Already saved", no duplicate. Branch deleted unpushed.

---

## Deliberate Failure Exercises

### Exercise 1: Incorrect Rounding (Project 1)
- **Change made**: Replaced `Math.ceil(totalHours / weeklyHours)` with `Math.floor(totalHours / weeklyHours)`.
- **Observed output**: `node planner.js 30 12` reported `Required weeks: 2 weeks`.
- **Why it failed**: \(30 / 12 = 2.5\). Rounding down fails to allocate time for the remaining 6 hours, which require an additional calendar week.
- **Repair**: Restored `Math.ceil`.

### Exercise 2: Incorrect Working Directory (Project 1)
- **Command & working directory**: `node planner.js 30 12` executed from parent directory `../`.
- **Observed error**: `MODULE_NOT_FOUND`. Node looked for `planner.js` in the parent directory.
- **Repair**: Specify path (`node studytrack/planner.js 30 12`) or `cd studytrack`.

### Exercise 3: Corrupt JSON File Drill (Project 2)
- **Experiment**:
  1. Created a known-good data file with 2 sessions (90 total minutes).
  2. Corrupted a disposable copy by injecting invalid JSON: `{"corrupted": true, broken syntax [}`.
  3. Ran `node planner.js --file ./sessions.json summary 30 12`.
- **Observed error**:
  ```text
  Error: Data file at ".../sessions.json" is corrupted or contains invalid JSON: Unexpected token 'b', "{"corrupted"... is not valid JSON
  The corrupted file was preserved and not overwritten.
  ```
  Process exited with code `1`.
- **Preservation verification**: Checked file content with `cat sessions.json`. The corrupt string was preserved byte-for-byte; StudyTrack did not overwrite it with `[]`.
- **Recovery verification**: Restored the known-good backup. Reran `summary 30 12`. Correctly reported `Logged sessions: 2 sessions` and `Completed time: 90 minutes (1.5 hours)`.

---

## Report-Back & Questions

### Why a unit test should not depend on your personal data file (Requirement Question)
1. **Test Hermeticity and Reproducibility**: Unit tests must produce identical, deterministic results regardless of who runs them or what machine they run on. If a test relied on a personal data file, it would pass on one developer's computer (where specific sessions exist) but fail on a clean CI environment or another teammate's machine.
2. **Preventing Accidental Data Loss**: A test suite that writes or resets files could accidentally wipe out, modify, or corrupt real, personal study history.
3. **Isolation and Concurrency**: Using isolated, temporary mock data files allows tests to run in parallel without race conditions or shared state contamination.

### Three-Run Transcript

```bash
# Run 1: Add first study session
$ node planner.js --file ./demo-data.json add 45 "Learned Node.js modules"
Added session #1: 45 minutes - "Learned Node.js modules"
Total study time logged: 45 minutes (0.75 hours across 1 session)

# Run 2: Add second study session
$ node planner.js --file ./demo-data.json add 75 "Built file storage module"
Added session #2: 75 minutes - "Built file storage module"
Total study time logged: 120 minutes (2 hours across 2 sessions)

# Run 3: Generate progress summary
$ node planner.js --file ./demo-data.json summary 10 4
Goal hours: 10 hours
Weekly hours: 4 hours
Logged sessions: 2 sessions
Completed time: 120 minutes (2 hours)
Remaining hours: 8 hours
Estimated weeks remaining: 2 weeks
Final-week hours: 4 hours
```

---

## Verification from a Fresh Clone

To verify that StudyTrack runs cleanly from a fresh clone using only this README:

```bash
# 1. Clone repository to a temporary location (replace <repo-url> with this repository's URL)
git clone <repo-url> /tmp/studytrack-fresh-verify

# 2. Change directory
cd /tmp/studytrack-fresh-verify

# 3. Run full automated test suite (unit + acceptance)
npm test

# 4. Verify P1 calculator command
node planner.js 30 12

# 5. Verify P2 add and summary commands
node planner.js --file ./fresh-demo.json add 60 "Fresh clone session"
node planner.js --file ./fresh-demo.json summary 10 5
node planner.js --file ./fresh-demo.json log

# 6. Optional (needs Google Chrome): Project 5 planner checks in a headless browser
npm run test:browser

# 7. Project 6 server: start it, check health and the API, stop it with Ctrl+C
npm start -- --data ./fresh-demo.json
#   in a second terminal:
curl -i http://127.0.0.1:3000/health
curl -i -X POST http://127.0.0.1:3000/api/sessions -H 'Content-Type: application/json' -d '{"minutes":30,"note":"Fresh clone API session"}'
curl -i http://127.0.0.1:3000/api/sessions
#   open http://127.0.0.1:3000/studytrack-platform/log.html in two tabs

# 8. Optional (needs Google Chrome): Project 6 two-tab, restart and outage checks
npm run test:browser:log

# 9. Cleanup verification clone
rm -rf /tmp/studytrack-fresh-verify
```

---

## Definition of Done Checklist

- [x] Data survives restarts and accumulated minutes are accurate across three separate process runs.
- [x] Existing Project 1 calculator cases still pass with identical behavior.
- [x] Separate modules for calculation (`src/calculation.js`), storage (`src/storage.js`), and CLI (`src/cli.js`).
- [x] Tests cover boundary cases, empty history, partial progress, and completed goals.
- [x] Absent data file handled gracefully as an empty log.
- [x] Corrupt data triggers a clear error and is not silently replaced or overwritten.
- [x] Fresh clone verified working using only this README.

### Project 3 Definition of Done

- [x] Required content and semantic structure are present (goal, availability, three resources, sample plan, preview form; landmarks and heading order checked in the accessibility tree).
- [x] Both viewport checks pass (360px and 1280px, no horizontal scroll).
- [x] Keyboard operation and visible labels pass (14-stop Tab route, visible focus, labelled inputs). A manual human keyboard pass is still recommended.
- [x] This README and the before/after screenshots explain the accessibility repair (Exercise 4 above).

### Project 4 Definition of Done

- [x] The public HTTPS page works with no required-resource failures (document and stylesheet 200, at 360px and 1280px).
- [x] The PR and the deployed commit are identifiable (PRs #1 and #2; `version.txt` on the live site).
- [x] DNS and HTTP evidence is recorded (`docs/projects/p04/report.md`).
- [x] Broken-asset diagnosis and rollback are demonstrated (Exercise 5 and the report's rollback section).

### Project 5 Definition of Done

- [x] All P1 input cases work in the browser (12 cases, public site, `docs/projects/p05/report.md` section 3).
- [x] Repeated submit/reset cycles remain correct (five cycles, report section 4).
- [x] Keyboard and error announcements are checked (keyboard pass and accessibility tree, report section 5; no screen reader run).
- [x] Public deployment and rendering evidence are current (deployed commit in `version.txt`, network events and screenshots at 360/1280, report section 2).

### Project 6 Definition of Done

- [x] All three endpoints follow their documented contracts (`test/api.test.js`, 20 tests; curl examples in `docs/projects/p06/report.md` section 3).
- [x] Two-tab and restart checks pass (`npm run test:browser:log`, 21/21; report section 4).
- [x] Invalid JSON and overlapping writes have defined outcomes (`400 invalid_json`; `409 write_conflict` + `Retry-After`, nothing lost; report section 3).
- [x] Server-down recovery works and prior calculation tests remain green (Exercise 7; `npm test` 138/138 and 13/13 P1 acceptance cases).