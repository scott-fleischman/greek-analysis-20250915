# SBLGNT LLM Gap Log

## Purpose
While validating access to the SBLGNT corpora we catalogued data features that are either missing or formatted too loosely to feed straight into the forthcoming viewer. The items below will need LLM-assisted extraction or cleaning so that downstream agents can deliver clause, lexical, and apparatus experiences without manual transcription.

## Gap inventory

### 1. Clause segmentation and analysis metadata are absent
- **Evidence.** The existing access notes explicitly state that the SBLGNT source lacks clause segmentations or IDs, which blocks any downstream clause-level annotations.【F:docs/sblgnt-data-access.md†L81-L84】 The project description also expects clause-level datasets with references and structural analyses that the raw XML does not provide out of the box.【F:description.md†L7-L13】
- **Impact.** Without explicit clause boundaries and labels we cannot attach viewer overlays, syntactic categories, or valency summaries to Mark’s text, nor can we keep those annotations aligned when navigation jumps between verses.
- **LLM follow-ups.**
  - [ ] Define a clause schema (IDs, verse linkage, label slots) that future agents can target when segmenting Mark.
  - [ ] Draft and test an LLM prompting workflow that proposes clause boundaries and clause-type tags for Mark 1 as a pilot.
  - [ ] Establish a validation checklist (spot-check verses, compare against reference grammars) before promoting the full-Gospel clause set.

### 2. Word-level lemmas and morphology are missing from the corpus
- **Evidence.** The XML files expose only `<w>`, `<prefix>`, and `<suffix>` elements with no lemma, part-of-speech, or morphology attributes for any token.【F:external-data/SBLGNT/data/sblgnt/xml/Mark.xml†L1-L60】 Yet the project brief calls for a per-word lemma dataset that groups inflected forms under shared dictionary entries.【F:description.md†L9-L10】
- **Impact.** Viewer tooling cannot offer lemma lookups, vocabulary filters, or lexicon rollups without augmenting each token with at least lemma and morph-tag information.
- **LLM follow-ups.**
  - [ ] Specify the lemma/morph feature set (lemma, POS, person, number, tense, voice, mood, case, gender, etc.) and serialization format expected by the viewer.
  - [ ] Build an LLM-driven tagging routine that consumes the verse token stream (including prefixes/suffixes) and emits the enriched token records.
  - [ ] Create a QA harness that cross-checks sampled LLM tags against published morphological parsers to gauge accuracy before bulk ingestion.

### 3. Text-critical sigla and apparatus notes require normalization
- **Evidence.** The surface text embeds textual-critical sigla such as ⸀ and ⸂ that will need explanation or remapping for most readers.【F:external-data/SBLGNT/data/sblgnt/text/Mark.txt†L2-L10】 The companion apparatus file encodes variant readings in semi-structured prose with bullets and bracket conventions that are not immediately machine-actionable.【F:external-data/SBLGNT/data/sblgntapp/text/Mark.txt†L3-L34】
- **Impact.** Rendering the raw glyphs makes the viewer difficult to read, while ignoring the apparatus forfeits critical variant information. We need clean spans and structured notes to power tooltips or side panels.
- **LLM follow-ups.**
  - [ ] Decide on the user-facing treatment for sigla (e.g., inline spans with tooltips, or normalized reading plus a footnote) and document the mapping.
  - [ ] Prototype an LLM prompt that rewrites each apparatus entry into structured JSON (base reading, variant, supporting witnesses, commentary) tied to verse/clause IDs.
  - [ ] Verify the converted apparatus on a representative sample (e.g., Mark 1–2) to ensure glyph-to-span alignment before scaling.
