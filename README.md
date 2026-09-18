# Study-Time Calculator (`studytrack`)

A clean, zero-dependency Node.js CLI calculator that calculates how many weeks a study goal will take to complete, including the exact study hours needed in the final week.

---

## 1. Prerequisites

- **Node.js**: v18.0.0 or higher (standard JavaScript runtime without external packages)
- **Git**: v2.20 or higher (for version control and history tracking)

Verify installation with:
```bash
node -v
git --version
```

---

## 2. CLI Command Format

Run `planner.js` with Node using the following syntax:

```bash
node planner.js <totalHours> <weeklyHours>
```

### Parameters
1. `<totalHours>`: Total study hours required to reach the goal.
2. `<weeklyHours>`: Hours available to study per week.

---

## 3. Input Validation Rules

The CLI enforces strict input rules:
- **Exactly two arguments**: Missing arguments or extra arguments are rejected.
- **Positive whole numbers only**: Both arguments must be positive integers (`> 0`).
- **Rejected inputs**:
  - Zero (`0`)
  - Negative numbers (`-5`)
  - Decimal / fractional numbers (`2.5`, `12.0`)
  - Non-numeric strings or words (`twelve`, `12hours`)
  - Missing or surplus parameters (`30`, `30 12 4`)

When invalid input is supplied, the program exits with code `1`, logs a descriptive error message, and provides command usage and an example **without printing a study plan**.

---

## 4. Usage Examples

### Valid Cases

#### Case 1: Partial week (`30` total hours, `12` hours/week)
```bash
node planner.js 30 12
```
Output:
```text
Total hours: 30 hours
Weekly hours: 12 hours
Required weeks: 3 weeks
Final-week hours: 6 hours
```

#### Case 2: Exact multiple (`24` total hours, `12` hours/week)
```bash
node planner.js 24 12
```
Output:
```text
Total hours: 24 hours
Weekly hours: 12 hours
Required weeks: 2 weeks
Final-week hours: 12 hours
```

#### Case 3: Small goal within one week (`5` total hours, `12` hours/week)
```bash
node planner.js 5 12
```
Output:
```text
Total hours: 5 hours
Weekly hours: 12 hours
Required weeks: 1 week
Final-week hours: 5 hours
```

#### Case 4: Minimal boundary condition (`1` total hour, `1` hour/week)
```bash
node planner.js 1 1
```
Output:
```text
Total hours: 1 hour
Weekly hours: 1 hour
Required weeks: 1 week
Final-week hours: 1 hour
```

---

### Invalid Cases (Rejection & Usage Display)

```bash
# Missing argument
$ node planner.js 30
Error: Expected exactly 2 arguments, but received 1.

Usage: node planner.js <totalHours> <weeklyHours>
  totalHours:  Total required study hours (positive whole number)
  weeklyHours: Available study hours per week (positive whole number)

Example:
  node planner.js 30 12

# Zero value
$ node planner.js 30 0
Error: Weekly hours must be a positive whole number. Received: "0".

Usage: node planner.js <totalHours> <weeklyHours>
  ...

# Decimals / Fractions
$ node planner.js 30 2.5
Error: Weekly hours must be a positive whole number. Received: "2.5".

Usage: node planner.js <totalHours> <weeklyHours>
  ...

# Alphanumeric text
$ node planner.js 30 12hours
Error: Weekly hours must be a positive whole number. Received: "12hours".

Usage: node planner.js <totalHours> <weeklyHours>
  ...
```

---

## 5. Stretch Goals Implemented

1. **`--help` Flag**:
   Run `node planner.js --help` or `node planner.js -h` to inspect command syntax and examples. Exits with code `0`.
2. **Grammatically Correct Units**:
   Correctly pluralizes units based on quantity (`1 week` vs `3 weeks`, `1 hour` vs `6 hours`).

---

## 6. Architecture & Code Structure

In accordance with good software engineering practices and PRD requirements, calculation logic is completely decoupled from printing:

- **`calculateStudyPlan(totalHours, weeklyHours)`**:
  Pure calculation function.
  - Computes required whole weeks: `Math.ceil(totalHours / weeklyHours)`.
  - Computes final week hours: When `totalHours % weeklyHours === 0`, the remainder is `0`, but the final week takes the full `weeklyHours`. Otherwise, it takes `totalHours % weeklyHours`.
  - Returns a plain data object `{ totalHours, weeklyHours, totalWeeks, finalWeekHours }`.
- **`printStudyPlan(plan)`**:
  Responsible solely for formatting and writing output to standard output (`stdout`).
- **`isPositiveInteger(value)`**:
  Validates that inputs are genuine positive whole numbers using regex `/^\d+$/` and `Number.isInteger()`.
- **`printUsage(errorMessage)`**:
  Responsible for routing error notifications to standard error (`stderr`) and usage hints to `stdout`.

---

## 7. Failure Drills ("Break It on Purpose")

### Drill 1: Rounding Down Weeks (`Math.floor`)
- **Action**: Temporarily replaced `Math.ceil(totalHours / weeklyHours)` with `Math.floor(totalHours / weeklyHours)`.
- **Observation**:
  Running `node planner.js 30 12` produced:
  ```text
  Total hours: 30 hours
  Weekly hours: 12 hours
  Required weeks: 2 weeks
  Final-week hours: 6 hours
  ```
- **Explanation of Failure**:
  \(\frac{30}{12} = 2.5\). Rounding down with `Math.floor` truncates the decimal to `2` weeks. In 2 weeks at 12 hours/week, only 24 hours of study can be completed. The remaining 6 hours cannot fit into those 2 weeks and require a 3rd calendar week. Any partial week must count as an entire additional calendar week.
- **Repair**:
  Restored `Math.ceil(totalHours / weeklyHours)`.
- **Verification**:
  Reran both partial and exact cases:
  - `30 12` ➔ 3 weeks, final week 6 hours (Verified)
  - `5 12` ➔ 1 week, final week 5 hours (Verified)
  - `24 12` ➔ 2 weeks, final week 12 hours (Verified)
  - `1 1` ➔ 1 week, final week 1 hour (Verified)

---

### Drill 2: Running from Parent Folder
- **Action**: Ran `node planner.js 30 12` from the parent directory (`/Users/itsbhavinrey/greenfield`).
- **Observation**:
  Node threw:
  ```text
  Error: Cannot find module '/Users/itsbhavinrey/greenfield/planner.js'
    code: 'MODULE_NOT_FOUND'
  ```
- **Explanation of Failure**:
  When a relative path like `planner.js` is passed to the Node CLI, Node resolves the path against the process's **Current Working Directory** (`process.cwd()`), not the location of the repository or user's intent. Because the CWD was `.../greenfield`, Node looked for `planner.js` directly inside `greenfield/`, where it does not exist.
- **Repair**:
  1. Change directory into the repository root: `cd studytrack && node planner.js 30 12`
  2. Or provide the relative path to the script: `node studytrack/planner.js 30 12`
- **Verification**:
  Executing `node studytrack/planner.js 30 12` from the parent directory ran successfully and produced the expected plan.

---

## 8. Verification from a Fresh Local Clone

To verify that the repository is completely self-contained and reproducible without lingering local state:

```bash
# 1. Clone into a fresh temporary directory
git clone /Users/itsbhavinrey/greenfield/studytrack /tmp/studytrack-fresh

# 2. Enter the cloned repository
cd /tmp/studytrack-fresh

# 3. Run the automated acceptance test suite
node test/acceptance.js

# 4. Verify a manual CLI run
node planner.js 30 12

# 5. Clean up temporary clone
rm -rf /tmp/studytrack-fresh
```

---

## 9. Conceptual Reference

### Why 30/12 Needs 3 Weeks
In weeks 1 and 2, studying 12 hours each week yields \(12 + 12 = 24\) hours. Because \(30 - 24 = 6\) hours remains, the learner cannot finish within 2 weeks. Even though 6 hours is less than the 12-hour weekly capacity, it extends into a 3rd calendar week. Therefore, whole weeks must round up (\(\lceil 2.5 \rceil = 3\)).

### How `'12'` Differs from `12`
- `'12'` is a primitive **String**—a sequence of characters (`'1'` and `'2'`). In JavaScript, `process.argv` delivers all CLI parameters as strings. Adding `'12' + 5` results in string concatenation (`'125'`).
- `12` is a primitive **Number** (IEEE-754 double precision float). Adding `12 + 5` performs arithmetic addition (`17`).
- Converting and validating input with `Number(arg)` and `Number.isInteger(num)` ensures the program operates on true numerical values.

### What Staging Changes versus Committing
- **Working Tree**: Your active files on disk with unrecorded edits.
- **Staging (`git add`)**: Prepares and indexes specific changes into the "index" or changeset area. This lets you select exactly what modifications will belong to the next snapshot.
- **Committing (`git commit`)**: Permanently seals the staged snapshot into the repository's immutable DAG history with an author, timestamp, and descriptive message.
