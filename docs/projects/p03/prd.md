# PROJECT 3 - Public study profile

**Size:** 2 weeks, 20-30 hours total | **Mode:** Greenfield, kept in the same repository under `web/`.

Source: *sixty-week-spine* curriculum, section "PROJECT 3 - Public study profile". This file restates the brief as a checklist and records the decisions taken while building it.

## Why now

The P1/P2 tools run in a terminal. Browser interfaces have their own structure (the document model, the cascade, layout, focus). A single static page introduces that structure before any browser scripting arrives in P5.

## New topics

- Frontend > CSS: semantic HTML for headings, navigation, forms, and lists.
- Frontend > CSS: cascade, box model, responsive layout with one layout technique.
- Common > Testing and performance: keyboard and basic accessibility checks.

## Reinforced topics

- P1 CLI: create and navigate a second runnable artifact (`web/index.html`, opened from the terminal).
- P1-P2 Git: review structural (HTML) and visual (CSS) changes in separate commits.

## The build

A public study profile showing a learner's goal, weekly availability, three resources, and a sample weekly plan.

## Requirements checklist

- [ ] R1. `header`, `nav`, `main`, and `footer` landmarks; exactly one descriptive `<title>`; logical heading order (one `h1`, then `h2`s, no skipped levels).
- [ ] R2. Goal, availability, resources, and sample plan shown with appropriate HTML (paragraphs, lists, description list, data table); every link has meaningful text (no "click here").
- [ ] R3. Responsive layout that works at 360px and 1280px with no horizontal scrolling.
- [ ] R4. A labelled, non-submitting sample goal form, clearly marked as a preview until P5.
- [ ] R5. All links and form controls keyboard reachable with a visible focus indicator; text contrast verified with a browser tool.
- [ ] R6. Page-opening instructions and keyboard-check results documented (README + `report.md`).

## Constraints checklist

- [ ] C1. No JavaScript, no CSS framework, no copied template.
- [ ] C2. No layout tables and no absolute positioning for the overall page; normal flow plus one layout technique.
- [ ] C3. No placeholder-only labels: every control has a visible `<label>`.

## Break it on purpose

- [ ] On a temporary branch remove one form label and one focus style, observe the ambiguity during keyboard navigation, restore both, repeat the same route. Record fault, symptom, evidence, repair, verification with before/after screenshots. Delete the branch afterward.

## Definition of done

- [ ] Required content and semantic structure are present.
- [ ] Both viewport checks pass.
- [ ] Keyboard operation and visible labels pass.
- [ ] The README and before/after screenshots explain the accessibility repair.

## Report back with

- Repository; web HTML and CSS files.
- 360px and 1280px screenshots; keyboard-check notes.
- Failure report.
- Explain why a visual heading is not necessarily an HTML heading.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Location | `web/index.html` + `web/styles.css` in the existing `studytrack` repo | The brief says "same repository under web/". The Node CLI and its tests are untouched; `npm test` only globs `test/*.test.js`, so the web files cannot break it. |
| Layout technique | **Flexbox only** (no CSS Grid anywhere) | The page is mostly one column of sections in normal flow. The only places that need side-by-side placement are one-dimensional rows: the nav links, the goal/availability pair, and the three resource cards. `flex-wrap` with a `flex-basis` lets those rows wrap to a single column at 360px with very little code, and flexbox is the technique the brief's reading list names. |
| Breakpoint | One `min-width: 48em` media query (mobile-first) | Base styles are the 360px layout; the wide layout is layered on top. Using `em` means the breakpoint follows the user's font size. |
| Sample plan numbers | 30 total hours at 12 hours/week -> 3 weeks: 12, 12, final week 6 | Matches the P1 calculator: `node planner.js 30 12` prints `Required weeks: 3 weeks`, `Final-week hours: 6 hours`. |
| Weekly availability | 12 hours: Mon-Thu 2 h each, Sat 4 h | Sums to the 12 weekly hours used by the plan. |
| Sample plan markup | A data `<table>` with `<caption>` and `scope` headers | The plan is genuinely tabular (week x hours x focus). The ban is on *layout* tables, not data tables. |
| Availability markup | Description list (`<dl>`) | Name/value pairs (day -> hours). |
| Resources | Unordered list of three links to MDN and W3C WAI pages; the link text is the page's subject | Meaningful link text; order does not matter so `<ul>`. |
| Non-submitting form | `<form>` with no `action`, no submit button, two or more text-like fields, and a `type="button"` button | Without a submit button and with more than one field, HTML's implicit submission (Enter key) does nothing, so the form cannot submit even without JavaScript. Controls stay enabled so they remain keyboard reachable (a `disabled` fieldset would remove them from the tab order). |
| Preview marking | A visible "Preview until Project 5" note referenced by `aria-describedby` on the form | Visible to sighted users and announced to screen-reader users. |
| Focus style | `:focus-visible` outline, 3px, high-contrast, with offset | Keyboard focus is always visible; mouse clicks on buttons do not show a ring in browsers that support `:focus-visible`. |
| Skip link | "Skip to main content" as the first focusable element | Lets keyboard users jump past the header and nav. It is visible (not hidden off-screen) to avoid any positioning tricks. |
| Learner content | Neutral sample learner ("StudyTrack learner"), no personal name | Publishing a real name is the owner's decision for P4. Content is sample data the owner can personalize. |
| Contrast target | WCAG 2.x AA: at least 4.5:1 for body text, 3:1 for focus indicator against adjacent colours | Ratios computed and recorded in `report.md`; also re-measured from the browser's computed styles. |
