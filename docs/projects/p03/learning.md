# Project 3 learning notes - Public study profile

These notes explain every new idea in Project 3 using the real files: `web/index.html` and `web/styles.css`. Open both next to this file. Open the page with `open web/index.html` and keep it open while you read.

---

## Part 1 - The concepts, explained against this code

### 1. Semantic HTML: choosing elements for meaning

"Semantic" means the element says **what the content is**, not how it should look. The browser turns the HTML into two trees:

- the **DOM**, which CSS styles, and
- the **accessibility tree**, which screen readers, voice control and keyboard tools read.

The accessibility tree is built from element meanings. A `<div>` means nothing. A `<nav>` means "a set of navigation links".

In `index.html`:

| Content | Element | Why this one |
| --- | --- | --- |
| Weekly availability (day -> hours) | `<dl>`, `<dt>`, `<dd>` | A description list is for name/value pairs. "Monday" is a name, "2 hours" its value. |
| Three resources | `<ul>` of `<li>` | An unordered list: the three items are a group, and order does not matter. A screen reader announces "list, 3 items". |
| Sample plan | `<table>` with `<caption>`, `<th scope>` | The plan really is a grid of data (week x hours x focus). `scope="col"` tells assistive tech that "Hours" labels its column. `scope="row"` makes "1", "2", "3" label their rows. |
| Calculator command | `<code>` | Marks computer text. |
| Emphasis like "30 study hours" | `<strong>` | Strong importance, not just bold. |

### 2. Landmarks

Landmarks are the big regions of a page. Screen-reader users can list them and jump straight to one, much like skipping to a chapter.

| Element in this page | Landmark role | What it holds |
| --- | --- | --- |
| `<header class="site-header">` (direct child of `body`) | banner | Site name and navigation |
| `<nav aria-label="Profile sections">` | navigation | The five in-page links |
| `<main id="main">` | main | Everything unique to this page; exactly one per page |
| `<footer class="site-footer">` (direct child of `body`) | contentinfo | Small print and the back-to-top link |
| `<section aria-labelledby="...">` | region | Each named section becomes a landmark, because `aria-labelledby` gives it a name taken from its own `h2` |

The `aria-label` on `<nav>` matters once a page has more than one nav. Even with one, it gives the landmark a clear name ("Profile sections navigation").

### 3. Headings and heading order

Headings form the outline of the page. Many screen-reader users navigate by pressing "H" to jump from heading to heading. The rules used here:

- Exactly **one `h1`**, which names the page's main content: "Study profile: learning to build for the web".
- Each major section starts with an **`h2`**. There are no `h3`s, because no section has sub-sections.
- **No skipped levels.** You never go from `h1` straight to `h3`. Choose the level by position in the outline, never by size. Size is CSS's job.

### 4. Labels

Every `<input>` has a `<label for="id">` whose `for` matches the input's `id`:

```html
<label for="total-hours">Total hours needed</label>
<input id="total-hours" ...>
```

That one link does three things:

1. It gives the input its **accessible name**: a screen reader says "Total hours needed, spin button, 30".
2. It makes the **label clickable**: clicking the text focuses the field (a bigger target).
3. It stays **visible**, so nobody has to remember what a field was for.

A `placeholder` disappears as soon as you type and is usually low contrast. That is why the brief bans placeholder-only labels. Section 6 of `report.md` shows what happens when the label is removed: Chrome computed the field's name as `""`.

### 5. The cascade

"Cascading" describes how the browser picks one value when several rules target the same element and property. Roughly, in priority order:

1. **Origin and importance**: browser default styles < your styles (ignoring `!important`).
2. **Specificity**: the more specific selector wins.
3. **Order**: if specificity ties, the later rule wins.

Order example in `styles.css`: the base section sets `.site-name { margin: 0 0 var(--space-2); }`. The layout section, further down, sets `.site-name { margin: 0; }`. Same selector, same specificity, so the later rule wins and the site name has no margin. That is why the file is arranged general -> specific and base -> layout -> focus.

Origin example (seen in the break exercise): when `input:focus-visible` was deleted from our rule, the **browser's own** style took effect again, a thin blue `outline: auto 1px`. Our rules only *override* the browser defaults; delete ours and the defaults show through.

**Inheritance** is a cousin of the cascade. Some properties, like `color`, `font-family` and `line-height`, flow down from parents. `body` sets `color` and `font-family` once, and every paragraph inherits them. Form controls do **not** inherit fonts by default, which is why `.field input` and `.goal-form button` say `font: inherit`.

### 6. Specificity

Specificity is a score with three columns: (IDs, classes / attributes / pseudo-classes, elements).

| Selector in `styles.css` | Score | Note |
| --- | --- | --- |
| `a` | (0,0,1) | one element |
| `a:focus-visible` | (0,1,1) | pseudo-class counts as a class |
| `.site-header a:focus-visible` | (0,2,1) | wins over the line above |
| `.field input:focus-visible` | (0,2,1) | |

This is exactly how the dark-header focus ring works. The general rule `a:focus-visible { outline: 3px solid var(--color-focus); }` paints an orange ring. Inside the navy header that ring would only reach 2.54:1 contrast. So `.site-header a:focus-visible { outline-color: var(--color-focus-on-dark); }` is **more specific** (0,2,1 beats 0,1,1) and swaps just the colour to yellow. Width and style still come from the general rule. Two rules cooperate through the cascade.

The page has no `id` selectors in CSS and no `!important`. That keeps every score low and easy to override later.

### 7. The box model

Every element is a box made of layers: **content -> padding -> border -> margin**.

- `.card` has `padding: var(--space-3)` (space inside the border), `border: 1px solid` (the visible edge), and gets space *outside* from `gap` in its flex container.
- `*, *::before, *::after { box-sizing: border-box; }` near the top changes how `width` is measured. With the default `content-box`, `width: 100%` plus padding plus border makes the box **wider than its parent**. That is a classic cause of horizontal scrolling. With `border-box`, `width` includes padding and border. So `.field input { width: 100%; }` fits its column exactly even though the input has padding and a 2px border.

### 8. Flexbox (the one layout technique)

A **flex container** (`display: flex`) lays its direct children (the **flex items**) along one line, the main axis (left to right by default). The properties used here:

- `flex-wrap: wrap`: when items do not fit on one line, start a new line. This is what makes the layout responsive without many media queries.
- `gap`: space between items, without margins on the items.
- `flex: 1 1 18rem` is shorthand for `flex-grow: 1; flex-shrink: 1; flex-basis: 18rem`. In words: "I'd like to be 18rem wide, I may grow to share spare space, and I may shrink." Two cards need 2 x 18rem + gap. When the container is narrower than that, the second card wraps below. At 1280px they sit side by side. At 360px they stack.
- `min-width: 0` on flex items: by default a flex item will not shrink below its content's minimum width (for example a long word). Setting `0` lets it shrink, so it never pushes the page wider.
- `justify-content: space-between`: pushes the first and last items to the ends. It puts "Monday" left and "2 hours" right in the availability rows, and the site name left and nav right in the header.
- `align-items`: alignment on the cross axis. `center` in the header, `flex-end` in the form so the button lines up with the bottoms of the inputs.

**Why flexbox and not grid?** Every row on this page is one-dimensional: a single line of things that may wrap. Grid shines when you need rows *and* columns to line up together. Flexbox with `flex-wrap` and a `flex-basis` gets the same result here with less code. The brief also says to use only one technique, so there is no grid at all.

### 9. Responsive design

Responsive means one page that adapts to any screen width. This page uses three tools:

1. **The viewport meta tag**: `<meta name="viewport" content="width=device-width, initial-scale=1">`. Without it, phones pretend to be about 980px wide and shrink the page to fit. Then nothing responsive happens.
2. **Mobile-first, intrinsic layout**: the base CSS is the phone layout (one column in normal flow). Flexbox wrapping makes items go side by side only when there is room. No fixed pixel widths are used for layout.
3. **One media query**: `@media (min-width: 48em)` adds extra padding on wide screens. It uses `em`, so if someone sets a larger default font, the breakpoint moves with it.

There are also small safety nets. `overflow-wrap: break-word` on `body` lets long words or code break instead of overflowing. `h1` uses `clamp(1.6rem, 1.2rem + 2vw, 2.4rem)` so the title scales with the viewport but stays between a minimum and a maximum.

The centring trick: `padding-inline: max(var(--space-3), calc((100% - 64rem) / 2));`. On a wide screen, `(100% - 64rem) / 2` is the space either side of a 64rem column, so the content is centred. On a phone that number is negative, so `max()` falls back to 1rem. The header's navy background still stretches edge to edge, because padding is inside the box.

How we checked: in Chrome DevTools device mode (or the scripted emulation in `report.md`), `document.documentElement.scrollWidth` equals the viewport width (360 and 1280). If any element were wider, `scrollWidth` would be larger and a horizontal scrollbar would appear.

### 10. Keyboard focus

Keyboard users press **Tab** to move to the next interactive element and **Shift+Tab** to go back. Enter activates a link, and Space or Enter activates a button. Only interactive elements receive focus: `<a href>`, `<input>`, `<button>`, `<select>`, `<textarea>`. Normal text does not.

- **Tab order = DOM order** when you avoid `tabindex` and CSS reordering. That is why the order in `report.md` matches the reading order.
- **Skip link**: "Skip to main content" is the very first stop, so keyboard users can jump past the header and nav. It points to `#main`.
- **Focus indicator**: `a:focus-visible, input:focus-visible, button:focus-visible { outline: 3px solid ...; outline-offset: 2px; }`. `:focus-visible` matches when the browser decides focus should be shown. It always does for keyboard focus and for text inputs. It usually does not for a mouse click on a button. `outline` does not take up layout space, so the ring never shifts the page. `outline-offset` leaves a small gap so the ring does not merge with the element's own border.
- **Never write `outline: none` without a replacement.** The break exercise shows the result: the active field became nearly impossible to spot.

### 11. Contrast

Contrast ratio compares the brightness (relative luminance) of two colours, from 1:1 (identical) to 21:1 (black on white). WCAG level AA asks for:

- **4.5:1** for normal text, and 3:1 for large text (about 24px, or 18.5px bold).
- **3:1** for non-text things you need to see, such as focus rings and input borders.

Every pair on this page is listed in `report.md` section 5. Examples: muted grey `#4a5562` on white is 7.59:1, which passes. The orange ring `#c2410c` on navy is only 2.54:1, which fails. That is why the header and footer use a yellow ring `#ffbf47` (8.02:1).

Check it yourself: in Chrome, right-click text, choose Inspect, then click the small colour square next to `color` in the Styles panel. Chrome shows the contrast ratio with ticks for AA and AAA.

---

## Part 2 - Walkthrough of `index.html`

1. **`<!DOCTYPE html>` and `<html lang="en">`**: standards mode, and the language tells screen readers which pronunciation to use.
2. **`<head>`**:
   - `charset="utf-8"` so any character displays.
   - The viewport meta tag (see section 9).
   - **One `<title>`**: "StudyTrack learner profile: goal, weekly availability and study plan". This is what a browser tab, a bookmark and a screen reader announce first. Descriptive titles say what is on the page, not just the site name.
   - `<link rel="stylesheet" href="styles.css">`: a relative path, so the page works when opened straight from disk.
3. **Skip link**: the first element in `<body>`, so it is the first Tab stop.
4. **`<header>`**: holds `<p class="site-name">StudyTrack</p>`. It is deliberately a paragraph, not a heading (see Part 3), followed by `<nav>` with a `<ul>` of five in-page links. A nav is a list of links, so `<ul>` lets assistive tech say "list, 5 items". Each `href="#goal"` matches a section's `id`.
5. **`<main id="main">`**:
   - The `h1` and an intro paragraph.
   - `<div class="summary">`: a plain `div` because it is only a layout wrapper with no meaning. It is the flex container that puts Goal and Weekly availability side by side.
   - **Goal section**: `<section id="goal" aria-labelledby="goal-heading">`. The `id` is the nav target, and `aria-labelledby` names the region after its `h2`.
   - **Availability section**: the `<dl>`, with each `dt` and `dd` pair wrapped in a `<div>`. HTML allows that wrapper, and it gives CSS one box per day to lay out as a row.
   - **Resources section**: `<ul class="resource-list">` with three `<li class="card">`. Each holds a link whose **text names the destination** ("MDN guide: basic concepts of flexbox") plus a one-line description.
   - **Plan section**: a sentence tying the numbers to the P1 calculator, then the table with `caption`, `thead`, `tbody` and `tfoot`, plus `scope` on the header cells.
   - **Form section**:
     - The note `<p id="preview-note">` starts with "Preview until Project 5."
     - `<form aria-describedby="preview-note">` links that note to the form, so assistive tech reads it as the form's description.
     - Each `.field` `div` pairs a label with its input.
     - The inputs use `type="number"` with `min="1" step="1"`, the same "positive whole number" rule as the P1 calculator, and `inputmode="numeric"` for phone keyboards.
     - The button is `type="button"`.
6. **Why the form cannot submit without JavaScript**: a `<button>` inside a form defaults to `type="submit"`. Making it `type="button"` turns it into a plain button that does nothing. The Enter key normally triggers "implicit submission". The HTML spec says that when a form has **no submit button** and **more than one** text-like field, pressing Enter does nothing. This form has three fields. `report.md` shows the test: pressing Enter left the URL unchanged. The fields stay enabled on purpose, because `disabled` controls are skipped by Tab and would fail the keyboard requirement.
7. **`<footer>`**: a sentence about the project and a meaningful "Back to the top of the profile" link.

## Part 3 - Walkthrough of `styles.css`

The file is in six numbered sections, ordered so the cascade reads top to bottom:

1. **Design tokens (`:root`)**: every colour, font stack, spacing step and radius is a custom property, for example `--color-text: #1f2933`. Change a value once and it updates everywhere. Each colour's comment says where it is used, and every text pair was contrast-checked.
2. **Reset and box model**: `box-sizing: border-box` for everything (see section 7). `body` drops the browser's 8px default margin and sets the page background, text colour, font, and a readable `line-height: 1.6`.
3. **Base typography**:
   - Heading sizes. `h1` uses `clamp()`.
   - Consistent bottom margins on `p`, `ul`, `dl` and `table`, so spacing flows in one direction.
   - Links keep their underline, with tuned thickness and offset, so they are identifiable without relying on colour.
4. **Components**:
   - `.skip-link` gets padding and a background.
   - `.site-header` gets navy with white text (13.17:1).
   - `.site-name` is big and bold, but it is still a `<p>`.
   - `.site-nav ul` removes bullets. Nav links are white and bold.
   - `.card` defines the box model of every card.
   - `.availability`, `.resource-list` and `.plan` style their content. The table uses `border-collapse: collapse` so cell borders merge into single lines.
   - `.preview-note` gets a pale yellow background and a dark stripe.
   - `.field label` is `display: block`, so the label sits above its input.
   - `.field input` and `.goal-form button` use `font: inherit`.
5. **Layout (flexbox, mobile first)**: covered in sections 8 and 9.
   - `body { overflow-wrap: break-word; }` and the centring `padding-inline`.
   - The flex containers: header, nav list, `.summary`, availability rows, resource list, form.
   - `.plan { width: 100%; }` so the table fills the column and its text wraps.
   - The one `@media (min-width: 48em)` block for extra space on wide screens.
6. **Focus and accessibility**:
   - Two focus colours (`--color-focus` for light areas, `--color-focus-on-dark` for the header and footer).
   - The shared `:focus-visible` outline rule.
   - The more specific header/footer override (see section 6).
   - A darker input border on focus, so the change does not depend on the ring colour alone.
   - A high-contrast skip link while focused.
   - A thicker underline on hover.

Notice what is **not** in the file: no `position`, no `float`, no grid, no `!important`, no `outline: none`, and no framework import.

---

## Part 4 - Why a visual heading is not necessarily an HTML heading

**Looking like a heading** is CSS: size, weight, spacing. **Being a heading** is HTML: an `h1` to `h6` element. They are independent. Browsers, screen readers and search engines build the page outline from the elements only.

So big bold text in a `<p>` or `<div>` does not appear in a screen reader's headings list, and cannot be jumped to with the "H" key. And a small `h2` styled to look like normal text *is* still a heading.

In this page, "StudyTrack" in the header is styled at 1.5rem bold and looks like a heading. It is a `<p class="site-name">` because it is branding, not the topic of this page's content. The real `h1` is "Study profile: learning to build for the web". Chrome's accessibility tree, recorded in `report.md`, lists only that `h1` and the five `h2`s as headings. The rule of thumb: choose the element for **meaning and outline position**, then use CSS for **appearance**.

---

## Part 5 - Self-quiz

1. Name the four landmark elements this page uses and the role each one becomes in the accessibility tree.
2. Why is "StudyTrack" in the header a `<p>` and not an `<h1>`?
3. Which HTML element holds the weekly availability, and why that one rather than a `<table>` or `<ul>`?
4. The brief bans "layout tables". Why is the `<table class="plan">` allowed?
5. What are the three jobs a `<label for="...">` does for its input?
6. What makes this form unable to submit even though it has no JavaScript? Give both reasons.
7. Two rules set `outline` on a focused nav link. Which wins, and why?
8. What problem does `box-sizing: border-box` solve for `.field input { width: 100%; }`?
9. Explain `flex: 1 1 18rem` on `.summary > .card` in plain words, and what happens at 360px.
10. Why does the media query use `48em` instead of `768px`?
11. In the break exercise, why was the first commit (deleting our focus rule) not enough to remove the focus ring?
12. What contrast ratio does body text need for WCAG AA, and why did the header need a different focus colour?

<details>
<summary>Answers</summary>

1. `<header>` -> banner, `<nav>` -> navigation, `<main>` -> main, `<footer>` -> contentinfo. Also, each `<section>` with `aria-labelledby` becomes a named region.
2. It is site branding that would repeat on every page, not the title of this page's content. Headings describe the outline of the content. The real `h1` is "Study profile: learning to build for the web". It is styled large with CSS, which does not change its meaning.
3. A description list `<dl>`, because each item is a name/value pair (day -> hours). A `<ul>` would lose the pairing. A two-column table would also work but adds more structure than needed.
4. Because it holds real tabular data (week x hours x focus), with a caption and header cells. A *layout* table uses table cells to position page regions, which is what is banned.
5. It gives the input an accessible name, it makes the label text clickable to focus the field, and it stays visible while the user types (unlike a placeholder).
6. The only button is `type="button"`, so it is not a submit button. And with no submit button plus more than one text-like field, the HTML spec says pressing Enter does not implicitly submit.
7. `.site-header a:focus-visible` (specificity 0,2,1) beats `a:focus-visible` (0,1,1) for `outline-color`, so the ring is yellow. The width and style still come from the less specific rule, because the override sets only the colour.
8. Without it, `width: 100%` sets the *content* width, and padding plus border are added on top. The input would end up wider than its column and could cause horizontal scrolling. With `border-box`, the 100% includes padding and border.
9. "Start at 18rem wide, grow to share extra space, shrink if needed." Two cards fit side by side only when the row is at least 2 x 18rem plus the gap. At 360px it is not, so they wrap and each takes the full width.
10. `em` media queries scale with the user's font-size setting. If someone enlarges text, the wide layout switches on later, which keeps the line length comfortable.
11. Removing our rule only removed *our* override. The browser's default focus style (`outline: auto 1px` in blue) applied again. Only `outline: none` removed every ring. That is why `outline: none` without a replacement is the real danger.
12. 4.5:1 for normal text. The orange ring is 4.83:1 on the light page but only 2.54:1 on the navy header, below the 3:1 needed for focus indicators. So the header and footer use yellow `#ffbf47` (8.02:1).

</details>
