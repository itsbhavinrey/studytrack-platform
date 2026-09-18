# PROJECT 1 - Study-time calculator

Size: 3 week(s), 30-45 hours total | Mode: Greenfield - your first program.

## Why now
You need to turn a small requirement into a program, run it yourself, and preserve changes you can explain. This connects those activities before adding a browser or database.

## New topics
- **Common > Fundamentals > OS and CLI:** directories, paths, files, and running commands.
- **Frontend > JS / TS / Node:** values, conditions, functions, arguments, and running JavaScript in Node.
- **Common > VCS and hosting > Git:** working directory, staging, commits, diffs, and history.

## Reinforced topics
None yet. Project 1 is the necessary exception to the earlier-project requirement; repeat change, run, inspect, and commit within this assignment.

## The build
A terminal calculator that tells a learner how many weeks a study goal will take, including the hours needed in the final week.

## Requirements
- Create `studytrack` with `planner.js`, `README.md`, and a local Git repository. The command format is: `node planner.js <totalHours> <weeklyHours>`; for example, `node planner.js 30 12`.
- Accept exactly two arguments: total required hours, then available hours per week. Both must be positive whole numbers; reject missing/extra arguments, zero, negatives, fractions, and nonnumeric text.
- Print total hours, weekly hours, required whole weeks, and final-week hours. Partial weeks count as whole required weeks; exact multiples must not show zero final-week hours.
- Keep calculation in a named function, separate from printing. Invalid input produces a clear error and usage example, without a plan.
- Pass these valid cases:
  - `30 12` -> 3 weeks, final 6 hours
  - `24 12` -> 2, final 12
  - `5 12` -> 1, final 5
  - `1 1` -> 1, final 1
- Reject these argument sets:
  - `0 12`
  - `30 0`
  - `-5 12`
  - `30 2.5`
  - `30 twelve`
  - `30 12hours`
  - `30`
  - `30 12 4`
- Make at least four meaningful commits. Document prerequisites, command, input rules, and a valid example; verify them from a fresh local clone.

## Constraints
- No npm packages or frameworks: expose what JavaScript and Node provide.
- No UI, persistence, or accounts: complete one input-to-answer path.
- Use terminal commands for running and basic Git work; do not hide paths or repository state.
- No copied/generated complete solution. Use documentation and hints, and explain every submitted line.

## Break it on purpose
- Temporarily round weeks down. Observe the wrong answer for `30 12`, explain why it fails, repair it, and rerun partial and exact-week cases.
- Run the usual command from the parent folder. Explain where Node looked after the missing-file error; repair the path or current directory.

## Definition of done
- [ ] All four valid and eight invalid cases pass.
- [ ] Both failures have observation, explanation, repair, and verification notes.
- [ ] Calculation and printing are separate; every line can be explained.
- [ ] Four meaningful commits exist, Git status is clean, and a fresh local clone runs from the README.

## Stretch goals
- Optional: add `--help`.
- Optional: use singular 'week' and 'hour' correctly.

## Concepts to read up on
- Current working directory; relative and absolute paths
- Node `process.argv`; strings versus numbers; `Number.isInteger`
- Functions; conditions; rounding up; remainder
- Git working tree, staging, commit, diff, log, clone

## Report back with
- Repository path or link; `planner.js` and `README.md`.
- Output for all twelve acceptance examples; `git log --oneline` and `git status`.
- Both failure reports; identify any help you used.
- Explain why 30/12 needs three weeks, how `'12'` differs from 12, and what staging changes versus committing.

## Suggested pacing
- **Week 1:** CLI, tiny JavaScript experiments, and commits.
- **Week 2:** calculations and validation.
- **Week 3:** failure drills, acceptance cases, and fresh-clone verification.
