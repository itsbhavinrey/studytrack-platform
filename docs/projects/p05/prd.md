# PROJECT 5 - Interactive weekly planner

**Size:** 2 weeks, 20-30 hours total | **Mode:** Extends Project 4 and absorbs Project 1's calculation module.

Source: *sixty-week-spine* curriculum, section "PROJECT 5 - Interactive weekly planner". This file restates the brief as a checklist and records the decisions taken while building it.

## Why now

The P3/P4 page is visible on the internet but cannot respond to the learner. Connecting its form to the existing P1 calculation exposes browser events and rendering without adding a framework.

## New topics

- Frontend > JS / TS / Node: DOM events and updates.
- Frontend > JS / TS / Node: closures and event-handler state.
- Frontend > How browsers work: rendering path and reflow versus repaint.

## Reinforced topics

- P1 functions: reuse calculations in a different runtime (Node CLI and browser share one module).
- P3 semantic HTML: turn the preview into a working labelled form.
- P3 CSS: support result and error states without layout breakage (360px and 1280px).
- P4 deployment: ship browser modules with correct paths on GitHub Pages.

## The build

Visitors enter a study goal and weekly hours and immediately receive an accessible plan.

## Requirements checklist

Status: done. Each ticked item links to its evidence in [report.md](report.md); the optional stretch goal was not attempted.

- [x] R1. Reuse the pure calculation module in the browser; do not import Node-only modules into it. ([report section 1](report.md#1-live-url-shared-module-and-browser-script))
- [x] R2. Handle form submission without a page reload and apply P1's input rules. ([report section 3](report.md#3-all-p1-input-cases-in-the-browser-definition-of-done-1))
- [x] R3. Show an inline error associated with the relevant field; announce an updated result accessibly. ([report sections 3 and 5](report.md#5-keyboard-and-error-announcements-definition-of-done-3-r3))
- [x] R4. Add a reset button that clears values, errors, and results; verify five repeated submit/reset cycles. ([report section 4](report.md#4-repeated-submitreset-cycles-definition-of-done-2-r4))
- [x] R5. Keep one event handler per action; explain a closure used by a handler. ([report section 9](report.md#9-constraints-c1-c3-and-one-handler-per-action-r5), [learning 3.3](learning.md#33-closures-and-event-handler-state))
- [x] R6. Capture one browser performance recording and identify a DOM change that triggers layout and a visual change that only needs painting. ([report section 7](report.md#7-performance-capture-layout-versus-paint-r6))

## Constraints checklist

- [x] C1. No React, no form library, no browser storage (`localStorage`, `sessionStorage`, IndexedDB, cookies). ([report section 9](report.md#9-constraints-c1-c3-and-one-handler-per-action-r5))
- [x] C2. No inline event attributes (`onclick=` etc.) and no duplicate listener registration. ([report section 9](report.md#9-constraints-c1-c3-and-one-handler-per-action-r5))
- [x] C3. User input is never inserted as raw HTML; it is displayed as text (`textContent`). ([report section 9](report.md#9-constraints-c1-c3-and-one-handler-per-action-r5))

## Break it on purpose

- [x] Register the submit handler twice on a temporary branch. Observe duplicate work with a counter or log, locate the duplicate registration, repair, verify one execution per submit. Record fault, symptom, evidence, repair, verification. ([report section 8](report.md#8-duplicate-handler-drill-break-it-on-purpose))

## Definition of done

- [x] All P1 input cases work in the browser. ([report section 3](report.md#3-all-p1-input-cases-in-the-browser-definition-of-done-1))
- [x] Repeated submit/reset cycles remain correct. ([report section 4](report.md#4-repeated-submitreset-cycles-definition-of-done-2-r4))
- [x] Keyboard and error announcements are checked. ([report section 5](report.md#5-keyboard-and-error-announcements-definition-of-done-3-r3))
- [x] Public deployment and rendering evidence are current. ([report sections 1 and 2](report.md#2-deployment-and-rendering-evidence-current))

## Stretch goal (optional, does not block completion)

- [ ] Optional: a preset-hours button without duplicating calculation logic.

## Report back with

- Live URL; shared calculation module and browser script.
- Short recording of valid, invalid, and reset behaviour.
- Performance capture and duplicate-handler report.
- Explain why Node's `process.argv` cannot be used directly in this browser module.

## P1 input cases carried into the browser

P1's acceptance suite (`test/acceptance.js`) defines 4 valid and 8 invalid command lines. In the browser each argument becomes a form field, so they map as follows:

| P1 command line | Browser input (total / weekly) | Expected |
| --- | --- | --- |
| `30 12` | `30` / `12` | 3 weeks, final week 6 hours |
| `24 12` | `24` / `12` | 2 weeks, final week 12 hours |
| `5 12` | `5` / `12` | 1 week, final week 5 hours |
| `1 1` | `1` / `1` | 1 week, final week 1 hour |
| `0 12` | `0` / `12` | error on total hours |
| `30 0` | `30` / `0` | error on weekly hours |
| `-5 12` | `-5` / `12` | error on total hours |
| `30 2.5` | `30` / `2.5` | error on weekly hours |
| `30 twelve` | `30` / `twelve` | error on weekly hours |
| `30 12hours` | `30` / `12hours` | error on weekly hours |
| `30` (missing argument) | `30` / empty | error on weekly hours |
| `30 12 4` (extra argument) | `30` / `12 4` | error on weekly hours |

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Where the shared module lives | `web/js/calculation.mjs` is the one copy of the P1/P2 pure functions, written as an ES module. `src/calculation.js` becomes a one-line CommonJS bridge: `module.exports = require('../web/js/calculation.mjs')` | The browser can only load files that are published, and the P4 workflow publishes exactly `web/`. Keeping the module inside `web/` means the existing workflow (and its rollback path) ships it with no build step and no copy that could drift. Node 22.12+ can `require()` an ES module synchronously (`require(esm)`), so the CLI, storage code and every existing test keep their `require('../src/calculation')` unchanged. |
| Module format and extension | ES module syntax (`export function ...`), `.mjs` extension, loaded with `<script type="module" src="js/planner.mjs">` | `export`/`import` is the one module syntax both browsers and Node understand. `.mjs` tells Node it is an ES module without a `"type": "module"` switch that would turn every existing CommonJS file into a module. Browsers ignore the extension and use the `Content-Type` header, which is checked on the public site. |
| Node version | `package.json` gets `"engines": { "node": ">=22.12" }` | `require(esm)` is enabled without a flag from Node 22.12 / 23.0. The repo and CI already use Node 24. |
| Input type | `type="text"` with `inputmode="numeric"`, not `type="number"` | A number input sanitises its value: typing `twelve` gives `value === ""`, and `12hours` cannot be typed at all in some browsers. With a text input the raw text reaches P1's `isPositiveInteger` rule, so every P1 invalid case produces its own error. `inputmode` still brings up the numeric keyboard on phones. |
| Whitespace | Surrounding whitespace is trimmed before P1's rule is applied | The shell strips the spaces between arguments before Node sees `process.argv`, so P1 never received `" 12 "`. Trimming reproduces that; inner spaces (`12 4`) are still rejected, matching P1's "too many arguments" case. |
| Goal name | Required, trimmed, non-empty (P2's `isValidNote` rule), `maxlength="80"`, shown with `textContent` | "Visitors enter a study goal": the name makes the plan readable and is the field that proves C3 (try `<img src=x onerror=alert(1)>`). |
| Validation function | New pure `validatePlanInput({ goalName, totalHours, weeklyHours })` in the shared module, returning `{ ok, values, errors }` keyed by field | Keeps the rules out of the DOM code so they are unit-tested in Node. The CLI keeps its own P1 messages (it already uses the same `isPositiveInteger`), so P1 output is byte-for-byte unchanged. |
| Errors | Per-field `<p class="field-error">` under each input; on error the input gets `aria-invalid="true"` and `aria-describedby` pointing at the message; focus moves to the first invalid field | The message is programmatically tied to its field, so a screen reader reads label, value, "invalid entry" and the message when the field gets focus. Moving focus is what makes the error get announced. |
| Result announcement | A `role="status"` element (implicit `aria-live="polite"`) that is in the page from the start and receives one summary sentence; the week-by-week table sits outside it | Live regions must exist before their content changes, or screen readers miss the first update. Announcing one sentence, not the whole table, keeps it short. |
| Week table | Built with `createElement` + `textContent`; rows shown for plans of up to 52 weeks, a sentence instead for longer plans | P1 accepts any positive whole number (`10000 1` is valid); 10,000 rows would be slow and useless. |
| Reset | A native `<button type="reset">`; one `reset` listener clears errors, result and status and puts focus back on the first field. The inputs have no `value` attributes, so the browser's reset leaves them empty | Uses the browser primitive instead of re-implementing it. The P3 preview's pre-filled values become hints (`for example 30`). |
| One handler per action | Exactly one `submit` and one `reset` listener, registered by `wirePlanner(form)`, which is called once from the module's top level. Each submit logs `[planner] submit handled (run N)` | The log makes duplicate registration visible (the break-it drill). Module scripts run once per document, so the registration cannot repeat by loading the script twice. |
| Local preview | `scripts/serve.mjs`: a small `node:http` static server that serves `web/` at `http://127.0.0.1:8080/studytrack-platform/` (same path as GitHub Pages) | Browsers refuse to load module scripts from `file://` (CORS, origin `null`), so P3's "open the file" no longer works for the interactive page. Serving under the same path as Pages makes the 404 page's root-relative URLs work locally too. No packages. |
| Browser tests | `scripts/check-planner.mjs` drives headless Chrome over the DevTools Protocol (the P4 approach) through all P1 cases, five submit/reset cycles, keyboard-only use and the ARIA state; `npm run test:browser`. The CDP client from `check-site.mjs` moves to `scripts/lib/cdp.mjs` and is shared | No test packages needed, and it tests the real browser behaviour. It is not part of `npm test` because it needs Chrome; `npm test` keeps running anywhere Node runs. |
| Performance capture | `scripts/record-planner.mjs` records a Chrome trace (`Tracing` domain, `devtools.timeline` + invalidation-tracking categories) of a submit and a keyboard focus move, saves the trace (loadable in DevTools > Performance) and prints the Layout and Paint events with the code locations that invalidated layout | Headless Chrome cannot open the Performance panel; its trace file is the same data. |
| Recording | The same script captures screenshots of valid, invalid and reset steps and encodes them to a WebM video inside headless Chrome with `canvas.captureStream()` + `MediaRecorder` | No ffmpeg or image packages are installed; the browser's own encoder produces a real, short video. |
| Deployment | The P4 workflow is unchanged. The commits are pushed to a feature branch and published with the P4 dispatch path (`gh workflow run pages.yml -f ref=<sha>`), then checked with `check-site.mjs`, `check-planner.mjs` and `curl` at the public URL. The branch is then merged into `main` through a pull request (PR #4), whose push trigger redeploys the same `web/` content | The dispatch path is the documented P4 way to publish a specific commit; merging through a PR keeps `main` and the live site in step. |
| Stretch goal | Not attempted | Optional. |
