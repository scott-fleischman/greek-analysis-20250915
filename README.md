# Greek Analysis

This repository hosts a growing analysis pipeline for Koine Greek texts, starting with the SBL Greek New Testament. It combines
structured datasets, processing scripts, and a web viewer so linguistic insights can be explored interactively.

## Quick Links

- [Project Description](description.md) – scope of the datasets, reporting expectations, and data sources.
- [SBLGNT Data Access Notes](docs/sblgnt-data-access.md) – how to load and inspect the source text locally.
- [LLM Gap Log](docs/sblgnt-llm-gap-log.md) – outstanding data preparation or cleanup tasks suited for language models.
- [GitHub Pages Deployment Guide](docs/github-pages-deployment.md) – workflow that publishes the viewer after successful tests on `main`.
- [Hosted Viewer on GitHub Pages](https://<github-username>.github.io/greek-analysis-20250915/) – the static site built from the [`viewer/`](viewer) directory once GitHub Pages is enabled.

## Work Plan Overview

The [Gospel of Mark viewer plan](plans/gospel-of-mark-plan.md) drives the near-term roadmap. Highlights include:

1. **Text Access and Verification** – document SBLGNT coverage, ship inspection scripts, and track any content gaps.
2. **Core HTML Viewer** – evolve the Mark viewer with manifest generation, book selection UI, navigation indexes, and chapter/verse shortcuts.
3. **Clause-Level Overlay** – define the clause schema, validate sample data (starting with Mark 1), and experiment with toggleable overlays.
4. **Analysis Browser by Category** – catalog analysis dimensions, prepare backend counts/snippets, and integrate synchronized highlighting in the UI.
5. **Quality Gates and Automation** – select lint/test tooling, bootstrap configs, and describe the CI sequence that enforces reliability.
6. **Data Generation via LLM Agents** – outline clause, morphology, and apparatus tracks with validation workflows before scaling beyond Mark.

These resources collectively describe the project’s direction and how to access both the raw data and the published viewer.
