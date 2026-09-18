# StudyTrack — Study-time calculator

A terminal program that calculates how many weeks a study goal will
take and how many study hours are needed in the final week.

This is Project 1 of the full-stack curriculum and the first step
toward StudyTrack. Later projects extend this application.

## Purpose

Learn to turn a small requirement into a working program, run it
from the terminal, and preserve changes using Git.

### Learning topics

- Terminal: directories, files, current working directory, and paths.
- JavaScript: values, conditions, functions, and arguments.
- Node.js: running JavaScript and reading command-line arguments.
- Git: working tree, staging, commits, diffs, history, and cloning.

## Prerequisites

- Node.js installed.
- Git installed.
- A terminal and text editor.

Check your installed versions:

```bash
node --version
git --version
```

Record the versions actually used:

- Node.js: `v24.14.0`
- Git: `2.50.1`
- Operating system: `macOS (Darwin 25.6.0 arm64)`

## Project files

```text
studytrack/
├── planner.js    # Input handling, calculation, and terminal output
├── prd.md        # Product requirements document
├── README.md     # Requirements, usage, and verification notes
└── test/
    └── acceptance.js # Automated acceptance test runner
```

The project must have a local Git repository.

## Usage

From the project directory:

```bash
node planner.js <total-hours> <weekly-hours>
```

Example:

```bash
node planner.js 30 12
```

Expected information:

```text
Total hours: 30 hours
Weekly hours: 12 hours
Required weeks: 3 weeks
Final-week hours: 6 hours
```

The exact output wording may differ, but all four values must be clear.

## Input rules

Accept exactly two arguments, in this order:

1. Total hours needed to complete the study goal.
2. Available study hours per week.

Both arguments must be positive whole numbers.

Reject:

- Missing or extra arguments.
- Zero or negative values.
- Fractional values.
- Nonnumeric text, including partially numeric values such as `12hours`.

For invalid input, print a clear error and a usage example.
Do not print a study plan.

## Calculation requirements

- Print total hours, weekly hours, required weeks, and final-week hours.
- Count a partial week as a whole required week.
- For exact multiples, show a full final week rather than zero hours.
- Keep the calculation in a named function, separate from printing.

## Acceptance checks

### Valid inputs

| Arguments | Required weeks | Final-week hours | Verified |
| --------- | -------------: | ---------------: | -------- |
| `30 12`   |              3 |                6 | [x]      |
| `24 12`   |              2 |               12 | [x]      |
| `5 12`    |              1 |                5 | [x]      |
| `1 1`     |              1 |                1 | [x]      |

### Invalid inputs

Each case must produce a clear error and usage example, without a plan.

| Arguments    | Reason                      | Verified |
| ------------ | --------------------------- | -------- |
| `0 12`       | Total hours cannot be zero  | [x]      |
| `30 0`       | Weekly hours cannot be zero | [x]      |
| `-5 12`      | Negative value              | [x]      |
| `30 2.5`     | Fractional value            | [x]      |
| `30 twelve`  | Nonnumeric value            | [x]      |
| `30 12hours` | Partially numeric text      | [x]      |
| `30`         | Missing argument            | [x]      |
| `30 12 4`    | Extra argument              | [x]      |

---

## Constraints

- Use JavaScript and Node.js without npm packages or frameworks.
- No browser interface, persistence, or accounts.
- Use the terminal to run the program and perform basic Git work.
- Write the application code yourself.
- Use documentation, hints, and review; do not submit a copied or
  generated complete solution.
- Be able to explain every submitted line.
- This project runs locally and requires no paid infrastructure.

## Git and reproducibility

- Make at least four meaningful commits.
- Use diffs to inspect changes before committing.
- Keep prerequisites, usage, input rules, and examples accurate.
- Verify that the program runs from a fresh local clone using this README.
- Finish with a clean Git working tree.

---

## Deliberate failure exercises

Perform these experiments in your own local project.
Repair each failure before considering the project finished.

### 1. Incorrect rounding

Temporarily round the required weeks down.

Run the calculator with `30 12`, observe the result, explain the
failure, repair it, and rerun both partial-week and exact-week cases.

Record:

- **Change made**: Replaced `Math.ceil(totalHours / weeklyHours)` with `Math.floor(totalHours / weeklyHours)`.
- **Observed output**:
  ```text
  Total hours: 30 hours
  Weekly hours: 12 hours
  Required weeks: 2 weeks
  Final-week hours: 6 hours
  ```
- **Why it failed**: \(30 / 12 = 2.5\). `Math.floor` rounds down to 2 weeks. In 2 weeks at 12 hours per week, the learner only finishes 24 hours of study. The remaining 6 hours cannot fit into the first 2 weeks, which means they must spill over into a 3rd calendar week. Partial weeks must count as an entire additional calendar week.
- **Repair**: Restored `Math.ceil(totalHours / weeklyHours)`.
- **Verification commands and results**:
  - `node planner.js 30 12` ➔ `Required weeks: 3 weeks`, `Final-week hours: 6 hours` (PASS)
  - `node planner.js 5 12` ➔ `Required weeks: 1 week`, `Final-week hours: 5 hours` (PASS)
  - `node planner.js 24 12` ➔ `Required weeks: 2 weeks`, `Final-week hours: 12 hours` (PASS)
  - `node planner.js 1 1` ➔ `Required weeks: 1 week`, `Final-week hours: 1 hour` (PASS)

### 2. Incorrect working directory

Run the usual command from the project's parent directory.

Explain where Node looked for the file, then repair the path or
change the current directory.

Record:

- **Command and working directory**: `node planner.js 30 12` executed from parent folder `/Users/itsbhavinrey/greenfield`.
- **Observed error**:
  ```text
  Error: Cannot find module '/Users/itsbhavinrey/greenfield/planner.js'
    code: 'MODULE_NOT_FOUND'
  ```
- **Why it failed**: When given a relative path like `planner.js`, Node resolves it against the process's Current Working Directory (`process.cwd()`). In the parent directory, Node looked for `/Users/itsbhavinrey/greenfield/planner.js`, where no such file exists.
- **Repair**:
  1. Change directory to the repository root: `cd studytrack && node planner.js 30 12`
  2. Or specify the relative path from the parent directory: `node studytrack/planner.js 30 12`
- **Verification command and result**:
  `node studytrack/planner.js 30 12` executed from `/Users/itsbhavinrey/greenfield` ran successfully and outputted the 3-week study plan.

---

## Learning approach

- Read only the concepts needed for the current requirement.
- Repeat the cycle: change, run, inspect, and commit.
- Ask for clarification, hints, and review when needed.
- Record confusing cases, your explanation, and any help used.
- Treat working code and demonstrated understanding as separate things.
- Preserve useful behavior and checks as later projects extend StudyTrack.

### Concepts to look up

- Current working directory; relative and absolute paths.
- `process.argv`.
- Strings versus numbers.
- `Number.isInteger`.
- Functions and conditions.
- Rounding up and remainder.
- Git working tree, staging, commit, diff, log, and clone.

## Suggested pacing

The curriculum estimates 3 weeks, or 30–45 hours total.
At my planned 15 hours per week, that allows up to 45 hours.

This is an estimate, not a deadline. Time includes reading, building,
debugging, verification, and reporting.

- Week 1: terminal practice, small JavaScript experiments, and commits.
- Week 2: calculation and input validation.
- Week 3: failure exercises, acceptance checks, and fresh-clone verification.

---

## Definition of done

- [x] All four valid and eight invalid acceptance cases pass.
- [x] Both deliberate failures have observation, explanation, repair,
      and verification notes.
- [x] Calculation and printing are separate.
- [x] I can explain every line.
- [x] At least four meaningful commits exist.
- [x] Git status is clean.
- [x] A fresh local clone runs using this README.

---

## Report-back checklist

- [x] Repository path or link: `/Users/itsbhavinrey/greenfield/studytrack`
- [x] `planner.js` and `README.md`.
- [x] Actual output from all twelve acceptance examples.
- [x] Output of `git log --oneline` and `git status`.
- [x] Both failure reports.
- [x] Any help used: Node.js standard runtime documentation (`process.argv`, `child_process`).
- [x] My explanation of why 30 hours at 12 hours/week needs three weeks:
  - In weeks 1 and 2, studying 12 hours each week yields \(12 + 12 = 24\) hours. Because \(30 - 24 = 6\) hours remains, the learner cannot finish within 2 weeks. Even though 6 hours is less than the 12-hour weekly capacity, it extends into a 3rd calendar week. Whole weeks must round up (\(\lceil 2.5 \rceil = 3\)).
- [x] My explanation of how `"12"` differs from `12`:
  - `"12"` is a primitive String (sequence of characters). In JavaScript, `process.argv` delivers all CLI arguments as strings. Adding `"12" + 5` produces string concatenation (`"125"`).
  - `12` is a primitive Number (IEEE-754 double precision float). Adding `12 + 5` performs arithmetic addition (`17`). Validating with `Number(arg)` and `Number.isInteger()` ensures proper numerical operations.
- [x] My explanation of staging versus committing:
  - Working tree: The local files in your directory containing your active modifications.
  - Staging (`git add`): Places selected file modifications into Git's "Index", curating the exact snapshot of changes ready to be saved.
  - Committing (`git commit`): Permanently writes the staged snapshot to Git's local history with an immutable commit hash, author info, timestamp, and log message.

---

## Optional stretch goals

These do not block completion:

- [x] Add `--help` (and `-h`): prints usage instructions and exits with code 0.
- [x] Use singular `week` and `hour` correctly (e.g., `1 week`, `1 hour`, `3 weeks`, `6 hours`).

---

## Verification from Fresh Clone

```bash
git clone /Users/itsbhavinrey/greenfield/studytrack /tmp/studytrack-fresh
cd /tmp/studytrack-fresh
node test/acceptance.js
node planner.js 30 12
rm -rf /tmp/studytrack-fresh
```

---

## Source

Adapted from Project 1, “Study-time calculator,” and the shared
guidance in `full-stack-project-curriculum.md`.