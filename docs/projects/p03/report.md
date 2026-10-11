# Project 3 report - Public study profile

All numbers and outputs below were observed on 2026-10-11 with Google Chrome 155.0.8059.39 (headless) on macOS, Node v24.14.0. Nothing in this report was produced by a human pressing keys. The keyboard route was driven by real `Tab` key events sent through the Chrome DevTools Protocol (see "How the checks were run").

## 1. Repository and files

- Repository: this repository (`studytrack-platform`, branch `main`); all paths below are relative to its root. The Node CLI from P1/P2 is unchanged and `npm test` still passes.
- Web files:
  - `web/index.html`: the page structure (landmarks, headings, lists, data table, form).
  - `web/styles.css`: base cascade and typography, the flexbox layout, focus styles.
- Docs: `docs/projects/p03/prd.md` (brief and decisions), this report, `docs/projects/p03/learning.md` (study notes).
- Screenshots: `docs/projects/p03/screenshots/`.

Open the page with `open web/index.html` (macOS) from the repository root, or drag the file into any browser. There is no build step and no server.

## 2. Requirements and evidence

| # | Requirement | Evidence |
| --- | --- | --- |
| R1 | Landmarks, one descriptive title, logical headings | The accessibility tree reports `banner`, `navigation "Profile sections"`, `main`, `contentinfo`. Title: `StudyTrack learner profile: goal, weekly availability and study plan`. Headings in DOM order: h1 "Study profile: learning to build for the web", then h2 "Goal", "Weekly availability", "Resources", "Sample weekly plan", "Set a study goal". One h1 and no skipped levels. |
| R2 | Goal, availability, resources and plan in appropriate HTML; meaningful link text | Goal: `<section>` with paragraphs. Availability: `<dl>` of day and hours (sums to 12). Resources: `<ul>` of three links named after their destination. Plan: data `<table>` with `<caption>`, `scope="col"`/`scope="row"` headers, 12 + 12 + 6 = 30 h over 3 weeks (the same result as `node planner.js 30 12`). No link says "click here" or "read more". The page has 10 links (1 skip link + 5 nav links + 3 resource links + 1 back-to-top link), and all 10 link names are listed in the tab route below; the other 4 tab stops are the three inputs and the button. |
| R3 | 360px and 1280px without horizontal scroll | See section 4. At both widths `scrollWidth == clientWidth`, and no element's right edge passes the viewport. |
| R4 | Labelled, non-submitting form, marked as preview until P5 | Three inputs with visible `<label for>`; accessible names "Goal name", "Total hours needed", "Hours available per week". The form's accessible description is the visible note "Preview until Project 5. This form does not submit or save anything yet..." Pressing Enter in "Total hours needed" and clicking the button both left the URL unchanged (`file:///.../web/index.html`, no `?total-hours=...`), so nothing was submitted. |
| R5 | Keyboard reachable with visible focus; contrast verified with a browser tool | All 14 focusable elements are reached in DOM order, each with a 3px solid outline while `:focus-visible` (section 3). Contrast was measured from Chrome's computed styles (section 5). |
| R6 | Opening instructions and keyboard results documented | README "Project 3" section and this report. |
| C1 | No JS, framework or template | `web/` holds only `index.html` and `styles.css`. There is no `<script>` tag and no `on*=` attribute. The CSS is hand-written. |
| C2 | No layout tables or absolute positioning | The only `<table>` holds the plan data. `styles.css` contains no `position:` declaration at all. The layout is normal flow plus flexbox. |
| C3 | No placeholder-only labels | No `placeholder` attribute is used. Every input has a visible `<label>`. |

## 3. Keyboard check

Route: the page was loaded at 1280x900, and `Tab` was pressed repeatedly from the top of the document. For each stop the script recorded the element, its accessible role and name from Chrome's accessibility tree, its visible `<label>` text, and the computed outline.

| Tab | Element | Role | Accessible name | Focus outline (computed) |
| --- | --- | --- | --- | --- |
| 1 | `a.skip-link` -> `#main` | link | Skip to main content | solid 3px rgb(194,65,12) with 2px offset, and the link turns dark with white text. An 8px margin keeps the whole ring on screen and on the light page background, 3px clear of the navy header |
| 2 | nav `a` -> `#goal` | link | Goal | solid 3px rgb(255,191,71) |
| 3 | nav `a` -> `#availability` | link | Weekly availability | solid 3px rgb(255,191,71) |
| 4 | nav `a` -> `#resources` | link | Resources | solid 3px rgb(255,191,71) |
| 5 | nav `a` -> `#plan` | link | Sample weekly plan | solid 3px rgb(255,191,71) |
| 6 | nav `a` -> `#goal-form` | link | Goal form preview | solid 3px rgb(255,191,71) |
| 7 | resource link (MDN) | link | MDN reference: HTML elements | solid 3px rgb(194,65,12) |
| 8 | resource link (MDN) | link | MDN guide: basic concepts of flexbox | solid 3px rgb(194,65,12) |
| 9 | resource link (W3C) | link | W3C: Understanding WCAG contrast (minimum) | solid 3px rgb(194,65,12) |
| 10 | `input#goal-name` | textbox | Goal name | solid 3px rgb(194,65,12) |
| 11 | `input#total-hours` | spinbutton | Total hours needed | solid 3px rgb(194,65,12) |
| 12 | `input#weekly-hours` | spinbutton | Hours available per week | solid 3px rgb(194,65,12) |
| 13 | `button` (type="button") | button | Plan my weeks (available in Project 5) | solid 3px rgb(194,65,12) |
| 14 | footer `a` -> `#main` | link | Back to the top of the profile | solid 3px rgb(255,191,71) |

The next `Tab` moved focus out of the document. The order matches the visual reading order, because nothing uses `tabindex` or reorders content with CSS. Focus screenshots: `screenshots/focus-skip-link-360.png`, `screenshots/focus-skip-link-1280.png`, `screenshots/focus-nav-link.png`, `screenshots/focus-goal-name-input.png`, `screenshots/focus-footer-link.png`, `screenshots/break-after-repair-*.png`.

What this does **not** cover, and still needs the owner:

- A human pass with a real keyboard: Tab, Shift+Tab, Enter on each in-page link to confirm it scrolls to its section, and Space on the button. The script proves reachability and the computed focus style. It does not prove the experience feels right, or that in-page link activation moves focus as expected in Safari and Firefox.
- Safari: by default macOS Safari does **not** move Tab focus to links unless "Press Tab to highlight each item on a webpage" is enabled (or Option+Tab is used). That is a browser setting, not a page bug, but it is worth knowing when testing.
- A screen-reader pass (VoiceOver: Cmd+F5) was not done.

## 4. Viewport checks

Method: Chrome DevTools Protocol `Emulation.setDeviceMetricsOverride` at exactly 360 and 1280 CSS pixels. Measured on the page: `document.documentElement.scrollWidth` compared with `clientWidth`, plus a scan for any element whose right edge is past `clientWidth`.

```text
360  {"innerWidth":360,"clientWidth":360,"scrollWidth":360,"bodyScrollWidth":360,"horizontalScroll":false,"overflowingElements":[]}
1280 {"innerWidth":1280,"clientWidth":1280,"scrollWidth":1280,"bodyScrollWidth":1280,"horizontalScroll":false,"overflowingElements":[]}
```

Screenshots: `screenshots/profile-360.png`, `screenshots/profile-1280.png` (full page).

A note on tooling: the first 360px screenshot was taken with the plain command `chrome --headless=new --screenshot --window-size=360,2600`. It showed text cut off at the right edge. The same page under exact device-metrics emulation measured `scrollWidth == 360` with no overflowing elements. The likely cause is that headless Chrome on macOS does not honour a window narrower than its minimum, so it lays out wider than 360 and then crops the image. I did not confirm that cause. Because of this, the committed screenshots come from the emulated 360px viewport. A manual check in DevTools device mode (Cmd+Opt+M, width 360) is a quick way for the owner to confirm.

## 5. Contrast

Ratios use the WCAG 2.x relative-luminance formula. Text pairs were collected **from the browser**: for every element with its own text, Chrome's computed `color` and the nearest non-transparent ancestor `background-color`. The ratios were then computed in Node. Non-text pairs (focus rings, borders) come from the stylesheet values.

| Foreground | Background | Ratio | Where | Needs | Pass |
| --- | --- | --- | --- | --- | --- |
| #1f2933 text | #ffffff surface | 14.76:1 | card text, table, dt, caption | 4.5 | yes |
| #1f2933 text | #f5f7fa page | 13.75:1 | h1, h2, body paragraphs, code | 4.5 | yes |
| #1f2933 text | #fff4d6 note | 13.46:1 | preview note | 4.5 | yes |
| #4a5562 muted | #ffffff | 7.59:1 | availability hours, resource descriptions | 4.5 | yes |
| #4a5562 muted | #f5f7fa | 7.07:1 | intro paragraph | 4.5 | yes |
| #0b5cad link | #ffffff / #f5f7fa | 6.67:1 / 6.21:1 | links on light backgrounds | 4.5 | yes |
| #ffffff | #12324f navy | 13.17:1 | header, nav, footer text and links, button text | 4.5 | yes |
| #ffffff | #1f2933 | 14.76:1 | skip link while focused | 4.5 | yes |
| #c2410c focus ring | #f5f7fa / #ffffff | 4.83:1 / 5.18:1 | focus ring on light backgrounds | 3 | yes |
| #ffbf47 focus ring | #12324f | 8.02:1 | focus ring in header and footer | 3 | yes |
| #c2410c focus ring | #12324f | 2.54:1 | *rejected*: this is why the header/footer override exists | 3 | no (not used) |
| #4a5562 input border | #ffffff / #f5f7fa | 7.59:1 / 7.07:1 | input boundary | 3 | yes |
| #8a5a00 note border | #fff4d6 | 5.41:1 | preview note stripe (decorative) | n/a | - |
| #c5ccd6 card border | #f5f7fa page | 1.51:1 | card outlines, measured against the page colour outside the card; decorative only, cards are also separated by spacing and their white fill | n/a | - |

Skip-link focus ring: the skip link was first placed at the very top-left corner (0,0). Its ring was then partly cut off by the viewport edge, and its bottom edge overlapped the navy header, where the orange ring is only 2.54:1. The skip link now has an 8px margin. The ring reaches 5px outside the link (3px outline + 2px offset), so it sits fully on screen and touches only the `#f5f7fa` page background on both sides (4.83:1), with 3px of page background between it and the header. Measured with device emulation at 360px and 1280px: ring outer box from (3,3), header top at 57.6px, ring bottom at 54.6px.

Owner follow-up: open DevTools, inspect any text, and click the colour swatch to see Chrome's own contrast readout. Lighthouse's accessibility audit is also worth running. Both are browser tools that take a few seconds by hand.

## 6. Failure report: removed label and focus style

**Fault (introduced on the temporary branch `break/p03-label-focus`, since deleted):**

- `c5e313b` removed `<label for="total-hours">Total hours needed</label>`. It also removed `input:focus-visible` from the focus-ring rule and deleted the `.field input:focus-visible` border rule.
- `54e343d` added the common reset `input:focus { outline: none; }`.

The first step was not enough on its own. Removing my rule only exposed the browser's built-in ring. After `c5e313b`, Chrome still drew its default `outline: auto 1px rgb(0,95,204)` around the focused input (`screenshots/break-step1-browser-default-ring.png`). That ring is thin and easy to confuse with the input's own 2px border, but it is there. A focus indicator actually disappears only when CSS sets `outline: none`. That is what the second commit did, and it is the usual real-world cause of this bug.

**Symptom (same route: Tab x11 from the top of the page, landing on the second form field):**

- Visible: the second field shows "30" with no label above it. Is it hours, weeks, minutes, or days? The page no longer says. Focus has no ring and no border change. The only hints that this field is active are Chrome's select-all highlight on "30" and the number spinner appearing. A sighted keyboard user who looks away and back cannot reliably tell which field is active. `screenshots/break-before-repair-360.png`, `screenshots/break-before-repair-1280.png`.
- Accessibility tree: the field's accessible name became the empty string.

```text
11. <input id=total-hours> role=spinbutton name="" visibleLabel=[] outline=[none 3px rgb(31, 41, 51)] :focus-visible=true
```

(`none 3px` means the outline style is `none`, so nothing is drawn. The width and colour values are leftovers.) A screen reader would announce this stop as roughly "spin button, 30" with no name. I did not run a screen reader. That sentence is inferred from the empty accessible name that Chrome computed, not heard.

- Unchanged: the other two fields kept their names. Enter in the field still did not submit the form. The viewport checks still passed.

**Evidence:** the Tab-route output above, plus the two before screenshots. The step-1 screenshot shows the browser default ring.

**Repair:** switched back to `main`, which never contained the break. That restores the label and the `input:focus-visible` outline and border rules. The branch was then deleted with `git branch -D break/p03-label-focus`.

**Verification (same route on `main`):**

```text
11. <input id=total-hours> role=spinbutton name="Total hours needed" visibleLabel=["Total hours needed"] outline=[solid 3px rgb(194, 65, 12)] :focus-visible=true
```

The label is visible again and the 3px ring plus the darker border are back: `screenshots/break-after-repair-360.png`, `screenshots/break-after-repair-1280.png`. The full 14-stop route was rerun and matches section 3.

**What I could not observe:** how confusing the missing ring feels to a real keyboard user over a whole session, and what a real screen reader says. Both need a human.

## 7. Why a visual heading is not necessarily an HTML heading

How text **looks** and what it **is** are controlled separately. CSS controls looks. The element controls meaning. A `<p>` can be made big and bold with CSS, and it still reads as a paragraph. A `<h2>` can be made small, and it is still a level-2 heading.

Browsers build the accessibility tree and the page outline from the elements (`h1` to `h6`), not from font size. Screen-reader users jump between headings, and search engines read structure, using those elements only. So bold, large text is not a heading to them unless it is marked up as one. The reverse also holds: a real heading does not have to look like a big headline.

This page has a deliberate example. The header's "StudyTrack" is styled at 1.5rem and bold, so it looks like a heading. It is a `<p class="site-name">`, because it is branding that repeats on every page, not the title of this page's content. The real `<h1>` is "Study profile: learning to build for the web" in `<main>`. Chrome's accessibility tree confirms it: it lists only the h1 and the five h2s as headings, and "StudyTrack" is not among them. Likewise the bold "Preview until Project 5." inside the form note is `<strong>`, not a heading. It looks emphatic, but it is part of the sentence.

## 8. How the checks were run

Scratch scripts outside the repository (not committed) launched headless Chrome with `--remote-debugging-port` and used the DevTools Protocol:

- `Emulation.setDeviceMetricsOverride` for exact viewport widths.
- `Input.dispatchKeyEvent` to press the real `Tab` and `Enter` keys.
- `Accessibility.getFullAXTree` / `getPartialAXTree` for roles, accessible names and descriptions.
- `Runtime.evaluate` only to *read* state (`document.activeElement`, computed styles, `scrollWidth`, `location.href`). No script was added to the page itself.
- `Page.captureScreenshot` for full-page and cropped focus screenshots.

Contrast ratios were computed with the WCAG relative-luminance formula in a Node one-off.
