# Gospel of Mark Viewer-Focused Plan

## 1. Text Access and Verification
- [x] Confirm the SBLGNT text for all books is available in the repository and document how to load it (verses, clauses, metadata). See `docs/sblgnt-data-access.md` for coverage notes and loading examples.
- [x] Provide a lightweight script/notebook to inspect raw text for sanity checks before building the viewer. (`scripts/inspect_sblgnt.py` renders verses from both the plain-text and XML corpora, with filters for substring search and starting references.)
- [x] Identify any gaps that require LLM-assisted extraction or cleaning and log them for follow-up tasks.

## 2. Core HTML Viewer
- [x] Draft a minimal HTML/CSS scaffold that renders beautifully formatted Greek text for a selected book (start with Mark).
- [x] Generate a manifest of available viewer JSON payloads as part of the build step.
- [x] Add a UI control that surfaces the manifest and lets readers choose a book.
- [x] Wire the loader to fetch the selected book, with loading/empty states for clarity.
- [x] Index chapter and verse boundaries so navigation controls know their targets.
- [x] Implement direct chapter/verse jump inputs backed by the index.
- [x] Add next/previous navigation shortcuts and verify they sync with the main text view.

## 3. Clause-Level Overlay
- [x] Draft a clause schema document (IDs, boundaries, category tags) that future agents can reference.
- [ ] Produce and validate a small clause sample (e.g., Mark 1) that conforms to the schema.
- [ ] Render static clause highlights in the viewer using the sample data to confirm styling.
- [ ] Add toggleable overlays and metadata displays (tooltips or panel) for clause interactions.
- [ ] Capture UX notes on how clause selections surface the applied analyses (tooltips, side panel, etc.).

## 4. Analysis Browser by Category
- [ ] Document the analysis categories and context rules, aligned with the clause schema.
- [ ] Shape backend data (counts plus context snippets) required to populate the browser.
- [ ] Build the category listing panel with counts per text and drill-down affordances.
- [ ] Link instance views back to the main text with synchronized highlighting to keep context clear.

## 5. Quality Gates and Automation
- [ ] Select linting, typing, and test tooling for the viewer (documenting the rationale).
- [ ] Bootstrap the configurations and add smoke tests so linting and unit tests run in CI.
- [ ] Ratchet code coverage expectations up to 80% once the suite is stable, enforcing the threshold in CI.
- [ ] Outline CI steps (lint, type check, test, coverage report) so future agents can wire them into the pipeline.

## 6. Data Generation via LLM Agents
- **Clause Analysis Track**
  - [ ] Specify prompts/workflows for clause analyses that align with the agreed schema.
  - [ ] Document validation expectations (spot checks, schema enforcement) before ingesting clause data.
  - [ ] Plan incremental delivery for clauses: start with Mark, then extend to additional books once validated.
- **Morphology Track**
  - [ ] Specify prompts/workflows for lemma and morphology enrichment compatible with viewer needs.
  - [ ] Document validation and reconciliation steps against existing lexicon resources.
  - [ ] Stage rollout beginning with Mark, expanding as validation procedures mature.
- **Apparatus Track**
  - [ ] Define prompts/workflows for textual apparatus notes, including required metadata fields.
  - [ ] Establish validation expectations for apparatus outputs prior to viewer integration.
  - [ ] Sequence delivery from a pilot chapter toward full-book coverage as confidence grows.
