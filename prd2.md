## PROJECT 2 - Study log that survives restarts

**Size:** 3 week(s), 30-45 hours total | **Mode:** Extends Project 1.

### Why now

A calculator forgets everything when it exits. Saving a small history makes data modelling and testable functions useful immediately.

### New topics

- Frontend > JS / TS / Node: arrays/objects, modules, JSON, and one-process file persistence.
- Common > Testing and performance: unit tests for pure calculation and validation functions.
- Common > Documentation: a README another person can follow.

### Reinforced topics

- P1 functions: reuse the calculator without copying its logic.
- P1 CLI: support multiple commands and a data-file path.
- P1 Git: separate extraction, storage, and testing into reviewable commits.

### The build

A learner adds study sessions and sees completed hours and an updated estimate of the weeks remaining.

### Requirements

1. Keep the P1 calculator command working. Add add <minutes> <note> and summary <goal-hours> <weekly-hours>; use positive integer minutes and a nonempty note.
2. Save sessions as JSON with an ID, minutes, note, and timestamp; show accumulated minutes accurately across three separate process runs.
3. Store calculation, storage, and command handling in separate modules. Convert minutes to hours deliberately and state the display rounding rule.
4. Handle an absent data file as an empty log; handle invalid JSON as a visible error without overwriting it.
5. Add unit tests for the P1 boundary cases, minute totals, empty history, and a completed goal.
6. Document setup, commands, data location, and how to run tests; verify from a fresh clone.

### Constraints

- No database or third-party packages: see the file boundary first.
- One running writer only: concurrency is explicitly out of scope until P6/P8.
- No happy-path-only tests: boundary behavior is part of the contract.

### Break it on purpose

- Corrupt a disposable copy of the JSON file. Observe the parse failure, preserve the bad file, restore a known-good copy, and verify the original session count.

### Definition of done

- [ ] Data survives restarts and existing calculator cases still pass.
- [ ] Tests cover empty, partial, and completed goals.
- [ ] Corrupt data is not silently replaced.
- [ ] A fresh clone works using only the README.

### Stretch goals

- Optional: list the latest five sessions.

### Concepts to read up on

- JavaScript arrays objects modules
- JSON parse stringify; Node file system
- pure functions; Node test runner; assertions
- README prerequisites and reproducible examples

### Report back with

- Repository; calculation, storage, CLI, and test files.
- Three-run transcript and test output.
- Corrupt-file failure report and fresh-clone notes.
- Explain why a unit test should not depend on your personal data file.

---