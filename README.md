# StudyTrack — Study-Time Calculator & Persistent Study Log

> **About this repository.** `studytrack-platform` continues StudyTrack from **Project 3 onward** (Projects 3-52 of the curriculum). It was cloned from the original `studytrack` repository, which stays at Projects 1-2, with the full Git history preserved, so the Project 1 and Project 2 code and commits are still here.

A terminal application for planning study goals, logging study sessions, and tracking progress over time.

StudyTrack began as a stateless study-time calculator (**Project 1**) and has been extended into a persistent study log that survives process restarts (**Project 2**). **Project 3** adds a second runnable artifact: a static, accessible public study profile page in `web/` (HTML and CSS only, no JavaScript).

---

## Purpose

- **Project 1**: Understand terminal environments, Node CLI execution, pure calculations, input validation, and Git version control.
- **Project 2**: Build modular JavaScript/Node applications, design JSON data models, implement file persistence, handle absent and corrupted data safely, and write thorough unit and integration test suites.
- **Project 3**: Learn the browser document model with semantic HTML (landmarks, headings, lists, labels), the CSS cascade and box model, one responsive layout technique (flexbox), and keyboard and contrast accessibility checks.

### Learning Topics

- **Frontend > JS / TS / Node**: Arrays, objects, modules (CommonJS), JSON serialization, file system persistence (`fs`), and pure functions.
- **Common > Testing and Performance**: Unit testing with Node's native test runner (`node:test`), assertions (`node:assert`), boundary value analysis, and process-level integration testing.
- **Common > Documentation**: Comprehensive setup, reproducible examples, and failure drills.

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher (built and verified with `v24.14.0`).
- **Git**: `v2.0.0` or higher (built and verified with `2.50.1`).
- Operating system: macOS, Linux, or Windows.
- **Zero third-party dependencies**: Uses only Node.js standard libraries (`node:fs`, `node:path`, `node:os`, `node:child_process`, `node:test`, `node:assert`).

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
├── web/                    # Project 3 static study profile (no JavaScript)
│   ├── index.html          # Semantic page structure: landmarks, headings, lists, table, form
│   └── styles.css          # Hand-written CSS: cascade, flexbox layout, focus styles
├── docs/
│   └── projects/
│       └── p03/
│           ├── prd.md      # Project 3 brief as a checklist, plus build decisions
│           ├── report.md   # Viewport, keyboard, contrast checks and failure report
│           ├── learning.md # Concept notes, code walkthrough, self-quiz
│           └── screenshots/ # 360px/1280px pages, focus states, break before/after
├── src/
│   ├── calculation.js      # Pure calculation functions, unit conversions, validation
│   ├── storage.js          # File persistence, load/save, and corrupt data protection
│   └── cli.js              # Command dispatch, argument parsing, and console output
└── test/
    ├── acceptance.js       # Project 1 acceptance test runner (13 test cases)
    ├── calculation.test.js # Unit tests for pure calculation and validation functions
    ├── storage.test.js     # Unit tests for file persistence and corrupt file safety
    └── p2.test.js          # Integration tests for multi-run persistence and commands
```

### Module Separation (Requirement 3)

1. **`src/calculation.js`**: Contains pure, deterministic functions with no side effects and no file/terminal I/O. Handles week estimations, accumulated minute totals, hours conversions, rounding, and input validation.
2. **`src/storage.js`**: Manages file read/write operations using Node's `fs` module. Encapsulates single-writer persistence, generates sequential IDs, handles missing files gracefully, and detects corrupted JSON without overwriting it.
3. **`src/cli.js`**: Parses flags and arguments, coordinates calculations and storage, formats human-readable terminal output, and sets proper process exit codes.
4. **`planner.js`**: The main executable script that passes `process.argv` to `src/cli.js`.

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

A static web page in `web/` showing a learner's goal, weekly availability, three resources, a sample weekly plan, and a preview goal form. It is plain HTML and CSS, so there is nothing to install, build, or serve.

Open it from the repository root:

```bash
open web/index.html          # macOS
xdg-open web/index.html      # Linux
start web\index.html         # Windows
```

Or drag `web/index.html` into any browser window. The stylesheet is linked with a relative path, so the page works straight from disk.

The sample plan matches the calculator: `node planner.js 30 12` gives 3 weeks with 6 hours in the final week, and the page shows 12 + 12 + 6 hours.

The goal form is a **preview until Project 5**. Its button is `type="button"` and it has more than one field with no submit button, so neither clicking nor pressing Enter submits anything.

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
```

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

# 6. Cleanup verification clone
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