# Gospel of Mark Viewer-Focused Plan

## 1. Text Access and Verification
- [x] Confirm the SBLGNT text for all books is available in the repository and document how to load it (verses, clauses, metadata). See `docs/sblgnt-data-access.md` for coverage notes and loading examples.
- [ ] Provide a lightweight script/notebook to inspect raw text for sanity checks before building the viewer.
- [ ] Identify any gaps that require LLM-assisted extraction or cleaning and log them for follow-up tasks.

## 2. Core HTML Viewer
- [ ] Draft a minimal HTML/CSS scaffold that renders beautifully formatted Greek text for a selected book (start with Mark).
- [ ] Build a small, modular JavaScript loader that lists all available texts (Gospels and Pauline letters) and swaps the displayed text on selection.
- [ ] Add basic navigation (chapter/verse jump, next/previous buttons) to verify interaction requirements.

## 3. Clause-Level Overlay
- [ ] Decide on the clause-level data format supplied by the LLM (IDs, boundaries, category tags) and document it for future agents.
- [ ] Implement highlighting in the viewer that toggles clause-level analyses on/off and visually links text spans to their analysis metadata.
- [ ] Capture UX notes on how clause selections surface the applied analyses (tooltips, side panel, etc.).

## 4. Analysis Browser by Category
- [ ] Define the list of analysis categories and what context (10-20 words or full clause) should be displayed for each hit.
- [ ] Create a viewer panel that lists categories with counts per text and allows drilling down into specific instances.
- [ ] Ensure each instance view links back to the main text with synchronized highlighting to keep context clear.

## 5. Quality Gates and Automation
- [ ] Configure linting plus JSDoc-based type checking (or equivalent stock JS checks) for the viewer code.
- [ ] Establish an automated test suite for the JavaScript with at least 80% coverage and fail the build when coverage drops below that threshold.
- [ ] Outline CI steps (lint, type check, test, coverage report) so future agents can wire them into the pipeline.

## 6. Data Generation via LLM Agents
- [ ] Specify prompts/workflows for LLM agents to produce clause analyses, category labels, and context snippets consistent with the viewer requirements.
- [ ] Document validation expectations for LLM outputs (spot-checking, schema checks) before they are ingested into the viewer.
- [ ] Plan incremental delivery: start with Mark, then extend to the remaining Gospels and Pauline letters once the workflow proves solid.
