# Clause Interaction UX Notes

This note captures the current user experience for clause overlays in the Gospel of Mark viewer so future work can build on the existing affordances.

## Availability and Toggle States
- The clause controls panel stays hidden until clause data is available; once data loads the toggle becomes enabled and mirrors the stored `clauseOverlayEnabled` flag while exposing an `aria-pressed` state for assistive tech.【F:viewer/js/main.js†L556-L567】
- The status line inside the panel communicates the current availability: it reports when clauses are missing for a book, when the overlay is disabled, prompts the user to choose a highlight, or confirms which clause is in focus.【F:viewer/js/main.js†L572-L593】

## Highlight Rendering and Accessibility
- When verses are rendered with clause data, each clause range becomes a `<span class="clause-highlight">` that is positioned inline with the verse text; the surrounding verse gains a `data-has-clauses="true"` flag to trigger relative positioning in CSS.【F:viewer/js/main.js†L1198-L1237】【F:viewer/styles/main.css†L325-L363】【F:viewer/styles/main.css†L455-L464】
- Clause highlights are given button semantics (`role="button"`, `tabindex="0"`, and `aria-pressed`) plus an accessible label derived from the clause description or ID, and a native `title` tooltip for mouse users.【F:viewer/js/main.js†L1100-L1125】
- When the overlay is toggled off, the highlights remain visually present but lose their interactive affordances (`tabindex` removed, `aria-pressed` cleared), preventing accidental focus while the feature is hidden.【F:viewer/js/main.js†L708-L729】【F:viewer/js/main.js†L799-L807】

## Selection Flow
- Clicking a highlight or pressing Enter/Space while it is focused triggers the shared selection handler, which normalizes the clause ID, stores it as the active selection, and then refreshes the details panel and status text.【F:viewer/js/main.js†L738-L780】
- Active highlights receive a `data-active="true"` marker so the styling can intensify the background and show focus, while inactive spans clear the flag.【F:viewer/js/main.js†L718-L731】【F:viewer/styles/main.css†L459-L478】

## Clause Details Panel
- The details container clears and then branches on state: if overlays are off it invites the user to re-enable them; if no clause is selected it prompts for a highlight; if metadata is missing it reports the gap.【F:viewer/js/main.js†L595-L635】
- When metadata is present the panel renders an optional function summary, followed by a definition list that surfaces the clause ID, a comma-separated list of references, categorized tags rendered as pill chips, and an optional source summary assembled from method and reviewer information.【F:viewer/js/main.js†L633-L689】【F:viewer/js/main.js†L965-L1012】【F:viewer/styles/main.css†L394-L446】

## Overlay Reset Behavior
- Disabling the overlay clears the active clause selection and re-renders the verses so no highlight remains marked as active; if clause details are absent after a reload, the state also resets and the status panel communicates the change.【F:viewer/js/main.js†L799-L818】【F:viewer/js/main.js†L1239-L1253】

These notes should guide future UX enhancements (e.g., richer tooltips or synchronized analysis panes) without duplicating exploratory work.
