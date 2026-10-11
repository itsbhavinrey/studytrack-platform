# Project 5 learning notes - Interactive weekly planner

These notes explain what Project 5 changed and why, using this repository's own files and the evidence in [`report.md`](report.md). Read them next to the code: `web/js/planner.mjs` is short enough to keep open the whole time.

Public page: https://itsbhavinrey.github.io/studytrack-platform/#planner

## 1. The whole journey in one picture

1. The browser downloads `index.html` and starts **parsing** it into the DOM (Document Object Model), the tree of element objects that JavaScript can read and change.
2. It meets `<link rel="stylesheet" href="styles.css">` and requests the CSS. CSS is **render-blocking**: nothing is painted until it has arrived and been parsed into the CSSOM.
3. It meets `<script type="module" src="js/planner.mjs">`. Module scripts are **deferred** by default: the browser downloads the file in parallel but does not run it until the whole HTML has been parsed. Before running it, it reads the `import` line, resolves `./calculation.mjs` against the module's URL (`.../js/planner.mjs`) and downloads that too (report section 2 shows both requests).
4. Parsing finishes. The module runs **once**: it defines functions and calls `wirePlanner(form)` once, which registers one `submit` listener and one `reset` listener. Then `DOMContentLoaded` fires.
5. The page is rendered: style, layout, paint (section 3.4).
6. Nothing else happens until the visitor acts. When they press "Plan my weeks" (or Enter in a field), the browser fires a `submit` event at the form. `onSubmit` runs, cancels the default reload, validates the text with the P1 rules, and changes the DOM: error text and ARIA attributes, or the status sentence and a new table.
7. After the handler returns, the browser renders again, doing only the work the changes require: a new table needs layout, a focus ring only needs paint (report section 7).

Steps 1-5 are the **critical rendering path**. Step 6 is **event-driven** programming: the code does not run from top to bottom and exit, like the CLI does; it registers functions and waits to be called.

## 2. What changed, briefly

| Before (P3/P4) | After (P5) |
| --- | --- |
| A form preview with a `type="button"` that did nothing | A working form: `submit` and `reset` buttons, inline errors, a live status, a week table |
| P1/P2 pure functions in `src/calculation.js` (CommonJS) | The same functions in `web/js/calculation.mjs` (ES module), used by the browser; `src/calculation.js` is a one-line bridge for Node |
| No JavaScript; open `web/index.html` from disk | One module script; preview with `npm run serve` (modules do not load from `file://`) |
| `check-site.mjs` with its own CDP client | `scripts/lib/cdp.mjs` shared by `check-site.mjs`, `check-planner.mjs` and `record-planner.mjs` |

## 3. New topics, explained against this code

### 3.1 DOM events

An **event** is the browser telling your code that something happened: a click, a key press, a form being submitted. You subscribe with:

```js
form.addEventListener('submit', onSubmit);
```

- `form` is the **target** you listen on. `'submit'` is the event **type**. `onSubmit` is the **listener**: a function the browser will call later, passing an `Event` object.
- The browser calls listeners; your code never calls `onSubmit` itself. That is why the order of events, not the order of lines, decides what runs when.

**Why listen for `submit` on the form, not `click` on the button?** A form can be submitted several ways: clicking the submit button, pressing Space or Enter on it, or pressing Enter inside a text field (*implicit submission*). All of them end in one `submit` event on the form. One listener covers every route, which is part of "one event handler per action". The keyboard check in report section 5 used Enter inside the weekly-hours field and still got a plan.

**Default actions and `preventDefault()`.** Many events have a built-in browser behaviour that happens *after* the listeners run, unless a listener cancels it. For `submit` the default action is navigation: build a URL from the form fields (method GET by default, so `<page URL>?goalName=...&totalHours=...`; the form has no `action`, so it submits to the document URL, here `/studytrack-platform/`) and load it, which reloads the page and throws away everything on it. `event.preventDefault()` cancels that, so the page stays and JavaScript shows the result in place. The browser check proves it by setting `window.__plannerCheck = true` after load and confirming it still exists after every submit (a reload would create a fresh `window`).

**The `reset` event** fires on the form when a reset button is activated, *before* the browser restores each control to its default value. The planner uses the native behaviour: since the inputs have no `value="..."` attribute any more, their default is empty, so the browser empties them. `onReset` only clears what the planner added (errors, ARIA state, result, status) and moves focus back to the first field.

**One listener per action, and why duplicates are easy to create.** `addEventListener` keeps a list per target and type. If you add the *same function object* twice with the same options, the second call is ignored. But a function expression creates a *new* function object each time it is evaluated. `wirePlanner()` defines `onSubmit` inside itself, so every call produces a brand-new `onSubmit`, and two calls mean two listeners. The drill (report section 8) did exactly that and saw two log lines per submit; the side experiment in the same section confirmed that registering one reference twice runs it only once.

### 3.2 DOM updates: text, elements and attributes

Ways `planner.mjs` changes the page, and why each was chosen:

| Change | API used | Why |
| --- | --- | --- |
| Error message, status sentence, table cells | `el.textContent = text` | Sets the element's content to one text node. The string is never parsed, so `<img onerror=...>` in a goal name stays visible characters (report section 3). |
| New table | `document.createElement('table')`, `.append(...)` | Builds real element objects; structure comes from code, text from `textContent`. |
| Replace the old table | `result.replaceChildren(newTable)` | Removes all children and inserts the new ones in one call; with no argument it empties the element. |
| Show or hide the result | `result.hidden = true/false` | The `hidden` attribute is the semantic "not relevant now": hidden content is not rendered and not in the accessibility tree. |
| Error state | `setAttribute('aria-invalid', 'true')`, `setAttribute('aria-describedby', ...)` / `removeAttribute` | ARIA attributes are how assistive technology learns the field is invalid and which text describes it. Removing them (not setting `"false"` or `""`) returns the field to its original state exactly. |
| Focus | `input.focus()` | Moves keyboard focus, which makes a screen reader announce the field. |

**`textContent` versus HTML insertion.** `el.innerHTML = '<b>' + name + '</b>'` hands the string to the HTML parser. Whatever the visitor typed becomes markup: tags become elements, attributes like `onerror` become event handlers that run. That is cross-site scripting (XSS) when the text comes from someone else. `textContent` (and `createTextNode`) never parse; they always produce text. The test `js/planner.mjs: no HTML insertion and no browser storage` forbids `innerHTML`, `outerHTML`, `insertAdjacentHTML` and `document.write` in `web/js/`, and the browser check proves the behaviour with a real payload.

### 3.3 Closures and event-handler state

A **closure** is a function together with the variables that were in scope where it was *written*. JavaScript scope is **lexical**: a name refers to the nearest enclosing declaration in the source text, and an inner function keeps access to its outer function's variables even after the outer function has returned.

The closure in this project (trimmed from `web/js/planner.mjs`):

```js
export function wirePlanner(form) {
  const fields = FIELDS.map(/* look up each input, error and hint once */);
  const status = document.getElementById('plan-status');
  const result = document.getElementById('plan-result');
  const handlerNumber = ++handlersCreated;
  let runs = 0;

  function onSubmit(event) {
    event.preventDefault();
    runs += 1;
    console.info(`[planner] submit handled by handler #${handlerNumber} (run ${runs})`);
    // ... reads fields[i].input.value, writes status and result
  }
  function onReset() { /* uses fields, status, result */ }

  form.addEventListener('submit', onSubmit);
  form.addEventListener('reset', onReset);
}

wirePlanner(document.getElementById('planner-form'));
```

What happens:

1. `wirePlanner(form)` runs once at load. Calling a function creates a fresh **environment** (a record of its local variables): `form`, `fields`, `status`, `result`, `handlerNumber`, `runs`.
2. `onSubmit` and `onReset` are created inside that call, so each carries a reference to that environment.
3. `wirePlanner` returns. Normally its locals would be garbage. They survive because the form's listener list holds `onSubmit`, and `onSubmit` holds the environment.
4. Every later submit calls the same `onSubmit`, which sees the **same** `runs` variable, so the count goes 1, 2, 3... (the live check reached `run 9` by the "30 twelve" case).

What the closure buys here:

- **Look-ups done once.** `fields`, `status` and `result` are found when the form is wired, not on every event.
- **Private state.** `runs` cannot be read or changed by any other code on the page: there is no global for it. Only the two handlers can see it. (No browser storage either: state lives in memory and disappears on reload, which is what C1 asks for.)
- **Per-form state.** If the page ever had two planner forms, `wirePlanner(formA)` and `wirePlanner(formB)` would each get their own `fields` and `runs`.

The same mechanism explains the drill. The second `wirePlanner()` call created a *second* environment with its own `runs = 0` and its own new `onSubmit`, so one submit logged `handler #1 (run 1)` and `handler #2 (run 1)`. `handlerNumber` comes from `handlersCreated`, a module-level variable that *all* calls share (it lives in the module's scope, one level further out), which is what made the two handlers distinguishable.

### 3.4 How browsers render: the critical rendering path, reflow and repaint

The pipeline, in the names the DevTools Performance panel uses:

1. **Parse HTML** into the DOM; **parse CSS** into the CSSOM.
2. **Recalculate style**: for each element, which CSS rules match and what the final property values are.
3. **Layout** (also called *reflow*): compute every box's size and position. Text wrapping, table column widths and flexbox all happen here. One box's size can move many others.
4. **Pre-paint / Paint**: record drawing commands (backgrounds, borders, text, outlines) for each layer.
5. **Layerize, Commit, Raster, Composite**: split into layers, hand to the compositor thread, turn into pixels and put them on screen.

The *critical* rendering path is the first trip through these steps until the first pixels appear. Things that block it: CSS (render-blocking) and classic synchronous scripts (parser-blocking). This page's script is a module, so it is deferred and never blocks parsing.

After that, every DOM or style change makes the browser re-run the pipeline **from the earliest step the change affects**:

- Changing *geometry* (adding elements, changing text, padding, width, `display`, `hidden`) needs **style + layout + paint**. This is a **reflow**.
- Changing only *appearance* (`color`, `background-color`, `border-color`, `outline`, `box-shadow`) needs **style + paint**, no layout. This is a **repaint**.
- Changing only `transform` or `opacity` on its own layer can skip to compositing.

The trace in report section 7 shows both sides on this page:

- **Submit → layout.** `onSubmit` set `status.textContent` (a text node inserted, and `.plan-status:empty` stopped matching, so padding and border came back), replaced the result's children with a new table and set `result.hidden = false`. Chrome recorded layout invalidations "Added to layout" for the table, its 5 rows, 6 header cells, 4 data cells and 12 text nodes, and "Style changed" for the status box. One Layout event followed with 39 dirty objects out of 246.
- **Tab to Reset → paint only.** `:focus-visible` began to match on one button; the only property change was the `outline`. Chrome recalculated style for one element, recorded **zero** Layout events, and painted.

Two practical points the trace also illustrates:

- **Writes are batched.** The script changed three things; the browser did one Layout afterwards, not three. Layout runs when the next frame is produced (or earlier if code *asks* for geometry).
- **Forced synchronous layout.** Reading a geometric property (`offsetHeight`, `getBoundingClientRect()`) right after a write forces the browser to do layout immediately, inside your script. Doing that in a loop (write, read, write, read) is *layout thrashing*. `planner.mjs` never reads geometry, so all its layout work happens once, after the handler.

## 4. Concepts to read up on (mapped to this code)

| Concept | Where in this project | Section |
| --- | --- | --- |
| DOM `addEventListener`, `preventDefault` | `wirePlanner()` registers `submit`/`reset`; `onSubmit` calls `event.preventDefault()` | 3.1 |
| Closures, lexical scope | `onSubmit`/`onReset` close over `fields`, `status`, `result`, `runs`; `handlersCreated` at module scope | 3.3 |
| `textContent` versus HTML insertion | `setFieldError`, `textElement`, status sentence; the XSS check | 3.2 |
| Critical rendering path; reflow, repaint | module script deferral; submit (layout) vs focus ring (paint) in the trace | 3.4 |

## 5. Reinforced topics

### 5.1 P1 functions in a different runtime: ES modules and `require(esm)`

Node has two module systems:

- **CommonJS** (P1/P2): `require()` and `module.exports`. Synchronous, Node-only. Files ending `.js` are CommonJS unless `package.json` says `"type": "module"`.
- **ES modules** (ESM): `import` and `export`. The standard, understood by browsers and Node. Files ending `.mjs` are always ESM.

Browsers do not have `require` or `module`, so the P1 file could not be loaded as it was. The options were: (a) turn the whole project into ESM (`"type": "module"` would change every existing file), (b) keep two copies (they would drift), or (c) one ESM file plus a bridge. This project chose (c). Since Node 22.12, `require()` can load an ES module synchronously as long as it has no top-level `await`, and returns its **namespace object** (one property per export). So `src/calculation.js` is just:

```js
module.exports = require('../web/js/calculation.mjs');
```

and every existing `const { calculateStudyPlan } = require('./calculation')` keeps working. `"engines": { "node": ">=22.12" }` in `package.json` records the requirement.

Why the file lives in `web/js/` and not `src/`: only `web/` is published (P4 decision). A file outside `web/` has no URL on GitHub Pages, so the browser could not fetch it.

### 5.2 P3 semantic HTML: a working labelled form

- Every input has a `<label for="...">`; the label is its accessible **name** ("Goal name").
- Hints and errors are separate `<p>` elements with ids. `aria-describedby="total-hours-error total-hours-hint"` makes them the input's **description**, read after the name. The error is listed first so it is heard first. Report section 5 shows Chrome's computed description: "Total hours must be a positive whole number, for example 30. Whole hours, for example 30."
- `aria-invalid="true"` exposes "invalid entry". `aria-required="true"` exposes "required" without the browser's own validation popups (a `required` attribute would block submit with the browser's message before our handler runs).
- `role="status"` is a **live region**: when its text changes, screen readers announce the new text without moving focus. It is *polite* (waits for the user to be idle) and *atomic* (reads the whole region, not just the changed part). It must exist in the DOM before the change, which is why it is in the HTML, empty, from the start.
- `type="text" inputmode="numeric"` instead of `type="number"`: a number input sanitises its value (`twelve` reads back as `""`), which would hide P1's distinction between "missing" and "not a whole number".

### 5.3 P3 CSS: result and error states without layout breakage

- `.field-error:empty { margin: 0; }`: an empty error paragraph has no text and no margin, so it takes zero height and fields without errors do not move.
- `.goal-form { align-items: flex-start; }` (was `flex-end`): on a wide screen the three fields sit in one flex row. With `flex-end`, a two-line error under one field would push the *other* inputs down to align bottoms. `flex-start` keeps the inputs on one line.
- `.form-actions { flex: 1 1 100%; }`: the buttons take a full row of their own instead of squeezing beside the fields.
- `.plan-status:empty { margin: 0; padding: 0; border: 0; }`: the live region stays rendered (so it stays in the accessibility tree) but is invisible while empty.
- `.field input[aria-invalid="true"] { border-color: ... }`: styling keyed to the ARIA state means the visual and the accessible state cannot disagree. The error is also *text*, so colour is never the only signal.

### 5.4 P4 deployment: shipping browser modules with correct paths

- **Relative URLs resolve against the file that contains them.** `src="js/planner.mjs"` in `index.html` resolves against the page URL; `import './calculation.mjs'` inside `planner.mjs` resolves against `.../js/planner.mjs`. So the import does not need `js/` in it.
- **Browsers need full URLs in imports.** No bare names (`'calculation'`) and no extension guessing: Node's CommonJS tries `.js` automatically; browsers request exactly the URL written. `test/web.test.js` enforces `./something.mjs` and checks the file exists.
- **MIME type.** A module script is refused unless served as JavaScript. GitHub Pages and `scripts/serve.mjs` both send `text/javascript` for `.mjs` (report section 2).
- **`file://` does not work.** A page opened from disk has an opaque (`null`) origin; module scripts are fetched in CORS mode and fail. Hence `npm run serve`.

## 6. File-by-file walkthrough

### `web/js/calculation.mjs` (moved from `src/calculation.js`, extended)

- **Header comment**: states the rule that keeps it shareable: no `require`, no `node:` imports, no `process`, no `document`/`window`.
- **P1/P2 functions** (`pluralize`, `isPositiveInteger`, `isValidNote`, `minutesToHours`, `roundHours`, `calculateStudyPlan`, `calculateAccumulatedMinutes`, `calculateSummary`): unchanged bodies; `function` became `export function` and the `module.exports` block was removed. Git records the move as a rename, so history is kept.
- **`weeklyBreakdown(plan)`** (new): turns `{ weeklyHours, totalWeeks, finalWeekHours }` into `[12, 12, 6]`. Pure, so the table logic is unit-tested without a browser.
- **`validatePlanInput(raw)`** (new): trims each value (argv never had surrounding spaces, see report section 10), then applies `isValidNote` to the goal name and `isPositiveInteger` to both hour fields. It separates *missing* ("Enter the total hours needed.") from *invalid* ("... must be a positive whole number, for example 30."), returns every field's error at once, and returns numbers in `values` only when all fields are valid. The CLI keeps its own messages, so P1's output did not change.

### `src/calculation.js` (rewritten)

One `require` of the ES module. Everything in Node that used the old file now gets the same function objects the browser uses (`test/shared-module.test.js` checks `===`).

### `web/js/planner.mjs` (new)

- **Imports**: four named imports from `./calculation.mjs`.
- **`MAX_TABLE_WEEKS = 52`**: P1 accepts `10000 1`; a 10,000-row table would be slow and useless, so long plans get a sentence.
- **`FIELDS`**: maps the validator's keys to element ids, so validation (keys) and DOM (ids) stay decoupled.
- **`handlersCreated`**: module-level counter; module scope is shared by every call, so it numbers the handler instances.
- **`setFieldError(field, message)`**: the one place that changes an error state: text, `aria-describedby` (error first, then hints) and `aria-invalid`. Clearing removes the attributes rather than setting empty values.
- **`describePlan()`**: the one sentence for the live region, using P1's `pluralize`.
- **`textElement(tag, text, attributes)`**: `createElement` + `textContent` + `setAttribute`; all user-visible strings in the table go through it, so there is no path from input to HTML parsing.
- **`buildPlanTable()`**: a real data table (`caption`, `thead` with `scope="col"`, row headers with `scope="row"`, `tfoot` total), same structure and class as the P3 sample table so it shares its CSS.
- **`wirePlanner(form)`**: the closure (section 3.3). `onSubmit`: `preventDefault`, count and log, read `input.value`s, validate, set or clear every field's error, then either (invalid) clear the result, say how many fields need correcting and focus the first invalid field, or (valid) calculate, write the sentence, show the table. `onReset`: clear errors, result and status, focus the first field; the browser empties the inputs.
- **Last line**: the single `wirePlanner()` call.

### `web/index.html` (changed)

- `<script type="module" src="js/planner.mjs">` in `<head>`: deferred, so it can sit in the head and still find the form.
- The form section became "Plan your weeks": `id="planner-form"`, inputs without `value` attributes, hint and error paragraphs with ids, `aria-required`, a submit and a reset button, then the empty `role="status"` region and the `hidden` result container.
- A `<noscript>` note for visitors without JavaScript (they still see the static sample plan above).
- Nav link and footer text updated; the Goal card links to the planner.

### `web/styles.css` (changed)

New `--color-error` token (replaces the preview-note colours, now unused); secondary button style; hint and error text; invalid border; status box with its `:empty` collapse; `align-items: flex-start` and the full-width `.form-actions` row (section 5.3).

### `scripts/serve.mjs` (new)

`node:http` static server. Maps `/studytrack-platform/<path>` to `web/<path>`; redirects `/` and directory paths without a slash (as Pages does); serves `404.html` with status 404; sets MIME types including `.mjs`; refuses paths that normalise outside `web/` (`..%2f` and `%2e%2e` both gave 404 in testing). It exports `startServer()` and only listens on its own when run directly (`import.meta.url === pathToFileURL(process.argv[1]).href`), so the check scripts can start it on port 0 (any free port).

### `scripts/lib/cdp.mjs` (new, extracted)

`launchChrome()` starts headless Chrome with a throwaway profile and `--remote-debugging-port=0`, reading the WebSocket URL from stderr. `openPage()` creates a tab and returns a tiny client: `send(method, params)` matches responses by `id`; `on`/`once` subscribe to events. `closeChrome()` kills Chrome and deletes the profile. `check-site.mjs` now imports these instead of defining them; its output is unchanged.

### `scripts/check-planner.mjs` (new)

Drives the real page like a user: `Input.insertText` to type, `Input.dispatchMouseEvent` to click, `Input.dispatchKeyEvent` for Tab/Enter/Space/Backspace. Reads state with `Runtime.evaluate`, counts `[planner]` log lines via `Runtime.consoleAPICalled`, counts top-level navigations via `Page.frameNavigated`, lists listeners with `DOMDebugger.getEventListeners`, and reads the accessibility tree with `Accessibility.getPartialAXTree`. Without a URL it serves `web/` itself (`npm run test:browser`); with `--screenshots` it also saves the planner section at 360 and 1280 px and checks for horizontal scroll.

### `scripts/record-planner.mjs` (new)

- **Trace**: `Tracing.start` with `devtools.timeline` and the invalidation-tracking categories, `performance.mark()` around each interaction, `Tracing.end`; saves gzipped JSON the Performance panel can load. The summary counts pipeline events in each marked window and attributes invalidations to the enclosing `FunctionCall` (e.g. `onSubmit (planner.mjs:141)`), `EventDispatch` (browser default action) or Recalculate style.
- **Video**: screenshots per step, then a canvas + `MediaRecorder` in Chrome to produce WebM.

### Tests

- `test/shared-module.test.js` (new): bridge and ESM export the same function objects; the module's code uses no runtime-specific globals.
- `test/plan-input.test.js` (new): the 12 P1 cases as form values, trimming, required goal name, all errors at once, empty vs invalid, markup kept as data (escaping is the DOM's job), `weeklyBreakdown` sums.
- `test/web.test.js` (extended): one module script; no `on*` attributes; relative `.mjs` imports that exist; no HTML insertion or storage; exactly one `submit` and one `reset` registration from one `wirePlanner()` call.

### `package.json`

`engines.node >= 22.12`; scripts `serve`, `test:browser`, `record:planner`. Still no dependencies.

## 7. Answers to the "Explain ..." questions

**Explain why Node's `process.argv` cannot be used directly in this browser module.** `process` is created by Node for a program started from a command line; `argv` is that command line. Browsers define no `process` global (using it throws `ReferenceError: process is not defined`), and a page has no command line at all: its input arrives later, repeatedly, as events carrying form-control values. So the calculation module takes plain parameters and each runtime has an adapter: `src/cli.js` reads `process.argv`, `web/js/planner.mjs` reads `input.value` in a submit handler. Full answer with the input-shape difference (argv words vs one free-text field): report section 10.

**Explain a closure used by a handler (R5).** `onSubmit` is created inside `wirePlanner(form)` and keeps that call's variables alive after it returns: the element look-ups (`fields`, `status`, `result`), `handlerNumber` and the counter `runs`. Each submit increments the same `runs`, and nothing outside the two handlers can touch it. Section 3.3.

**Identify a DOM change that triggers layout and a visual change that only needs painting (R6).** Layout: `onSubmit` inserting the result table (`replaceChildren`), un-hiding the result and filling the status box (which un-collapses its padding): 1 Layout with 39 dirty objects. Paint only: keyboard focus moving to Reset, which adds an outline: 0 Layout, 2 Paint. Section 3.4 and report section 7.

## 8. Self-quiz

1. Why does the planner listen for `submit` on the form instead of `click` on the "Plan my weeks" button?
2. What would happen, step by step, if `onSubmit` forgot to call `event.preventDefault()`?
3. `form.addEventListener('submit', f); form.addEventListener('submit', f);` - how many times does `f` run per submit? And with `wirePlanner(form); wirePlanner(form);`? Why the difference?
4. After `wirePlanner()` returns, where does the variable `runs` live, and who can change it?
5. A visitor types `<b>Exams</b>` as the goal name. What appears on the page, and which line of code guarantees that?
6. Why is the `role="status"` element written into the HTML (empty) instead of being created by JavaScript when the first result is ready?
7. Why `type="text" inputmode="numeric"` instead of `type="number"` for the hour fields?
8. Which of these needs layout and which only paint: (a) `result.hidden = false`, (b) changing an input's `border-color`, (c) adding a 3 px `outline`, (d) changing the status box's `padding`?
9. Why does opening `web/index.html` directly from disk no longer show a working planner, and how does `npm run serve` fix it?
10. `planner.mjs` imports `'./calculation.mjs'`. Why not `'./calculation'`, and why not `'js/calculation.mjs'`?
11. How does Node load `web/js/calculation.mjs` for the CLI without changing any `require('./calculation')` call?
12. In the drill, the page looked correct with two submit handlers. What evidence revealed the duplicate, and what pointed at its cause?

<details>
<summary>Answers</summary>

1. A form can be submitted by clicking the button, by Space/Enter on it, or by Enter in a text field. All routes fire one `submit` event on the form; a `click` listener would miss Enter-in-a-field and would need extra listeners for the same action.
2. The listener would run and draw the result, then the browser would perform the default action: build `<page URL>?goalName=...&totalHours=...&weeklyHours=...` (for example `/studytrack-platform/?goalName=...`, since the form has no `action`) from the fields and navigate to it. The page reloads, the result disappears, and the values end up in the URL.
3. Once: `addEventListener` ignores a second registration of the same function with the same type and capture flag. Twice: each `wirePlanner()` call evaluates the inner `function onSubmit` again, creating a new function object, so the two registrations are different listeners.
4. In the environment created for that `wirePlanner()` call, kept alive because `onSubmit` (held by the form's listener list) refers to it. Only `onSubmit` can change it (and `onReset` could read it); no other code has a reference.
5. The literal characters `<b>Exams</b>` appear inside the status sentence and the table caption; no bold element is created. `status.textContent = describePlan(...)` and `textElement()` (`el.textContent = text`) set text, never HTML.
6. Screen readers start watching a live region when it appears in the accessibility tree. If it were inserted together with its first message, many screen readers would not announce that message. Present-but-empty from load means the first change is announced.
7. A number input sanitises its value: invalid text such as `twelve` reads back as `""`, and some browsers block typing letters. Then P1's separate "invalid" and "missing" cases could not be told apart. A text input passes the raw text to `isPositiveInteger`; `inputmode="numeric"` still shows a numeric keyboard on phones.
8. (a) layout: boxes are added. (b) paint only: the border already exists with the same width. (c) paint only: outlines do not take up space. (d) layout: padding changes the box size and moves what follows.
9. A `file://` page has an opaque origin and module scripts are fetched with CORS, so Chrome blocks `planner.mjs` and the form does nothing (the native submit reloads the page). `npm run serve` serves the files over `http://127.0.0.1:8080/studytrack-platform/`, a real origin, with `text/javascript` for `.mjs`.
10. Browsers fetch exactly the URL written; they do not try extensions, so `'./calculation'` would request a file that does not exist (404). `'js/calculation.mjs'` is not a valid relative module specifier (it must start with `./`, `../` or `/`, or be a full URL), and even as `'./js/calculation.mjs'` it would resolve against `.../js/` and point at `.../js/js/calculation.mjs`.
11. `src/calculation.js` contains `module.exports = require('../web/js/calculation.mjs')`. Node 22.12+ can `require()` an ES module without top-level `await` synchronously and returns its namespace object, whose properties are the exported functions.
12. The console showed two lines per click (`handler #1 (run 1)`, `handler #2 (run 1)`), and `DOMDebugger.getEventListeners` listed two `submit` listeners. Both listeners pointed at the same source line (141, `function onSubmit`), meaning the same code had been registered twice as two objects, so the search was for a second call of the function that creates them: `grep -n "wirePlanner("` found the `DOMContentLoaded` block.

</details>
