# Clause Schema for the SBLGNT Viewer

This document defines a clause-level data contract that future agents can target when preparing overlays for the SBLGNT viewer. The schema is intentionally conservative: it keeps a tight coupling with the existing verse-oriented payloads (`viewer/data/*.json`) while leaving room for rich linguistic tagging and analytical annotations.

## Design goals

1. **Stable identifiers.** Every clause receives a reproducible ID so later datasets (analysis categories, LLM outputs, QA reports) can refer to the same unit of text without ambiguity.
2. **Precise boundaries.** Clause ranges are tied to ordered verse references _and_ to character offsets within each verse, enabling pixel-accurate highlights in the web UI regardless of typography.
3. **Extensible tagging.** Category tags and metadata are modeled as additive arrays/objects so new analytical dimensions can plug in without forcing a breaking change.
4. **Source transparency.** Provenance and validation metadata ride alongside the clause definitions so downstream automation knows which generations are trustworthy.

## File naming & placement

Clause datasets should live beside their verse payload counterparts under `viewer/data/`. For example, the clause overlay for Mark should be stored at `viewer/data/mark.clauses.json`. Keeping the files co-located allows the build to co-ship both verse and clause artifacts.

## Top-level structure

Each clause file is a single JSON object with the following keys:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `book_id` | `string` | ✅ | Lowercase snake ID that matches the manifest (e.g., `"mark"`). |
| `display_name` | `string` | ✅ | Human-readable name for the text (e.g., `"Gospel of Mark"`). Mirrors the verse payload. |
| `source_path` | `string` | ✅ | Relative path to the underlying SBLGNT plain text or XML source used for segmentation. |
| `generated` | `object` | ✅ | Metadata about how the file was produced. See [Generation metadata](#generation-metadata). |
| `verses` | `array` of objects | ✅ | Lightweight verse registry keyed by reference. Enables consumers to resolve verse order without reloading the verse payload. See [Verse registry](#verse-registry). |
| `clauses` | `array` of objects | ✅ | Clause entries ordered by their appearance in the text. See [Clause entries](#clause-entries). |
| `categories` | `array` of strings | ⭕️ | Optional normalized list of category IDs present in the dataset. Useful for quickly scanning available analyses. |

### Generation metadata

The `generated` object surfaces provenance information. Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `timestamp` | `string` (ISO 8601) | UTC timestamp representing when the clauses were generated or last revised. |
| `agent` | `string` | Identifier for the workflow or script (e.g., `"llm.clause-segmenter.v1"`). |
| `confidence` | `string` | One of `"high"`, `"medium"`, `"low"`. Downstream automation can require higher confidence before publishing. |
| `notes` | `string` | Free-form comments, including validation summaries or reviewers. Optional but recommended. |

### Verse registry

Each entry in the `verses` array provides the minimum necessary info for overlay alignment:

```json
{
  "reference": "Mark 1:1",
  "index": 0,
  "chapter": 1,
  "verse": 1,
  "character_count": 33
}
```

- `index` is the zero-based position that mirrors the ordering in `viewer/data/mark.json`. Consumers can map this directly to `navigationIndex.orderedReferences`.
- `character_count` counts Unicode code points in the verse text. It enables quick validation that clause offsets fall within bounds.

## Clause entries

Clauses are stored in the `clauses` array. Each object adheres to the schema below:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `clause_id` | `string` | ✅ | Stable identifier formed as `{book_id}-{chapter:02d}-{verse:02d}-{suffix}` (e.g., `mark-01-01-a`). Suffixes progress alphabetically within the verse. Cross-verse clauses repeat the final verse number (e.g., `mark-01-02c`). |
| `start` | `object` | ✅ | Starting boundary. See [Boundaries](#boundaries). |
| `end` | `object` | ✅ | Ending boundary. Same shape as `start`. |
| `references` | `array` of strings | ✅ | Canonical references covered by the clause (e.g., `["Mark 1:1"]` or `["Mark 1:2", "Mark 1:3"]`). |
| `category_tags` | `array` of strings | ✅ | Normalized tags that classify the clause (e.g., `"main"`, `"subordinate"`, `"quotation"`). Define tag semantics in the analysis-category documentation. |
| `function` | `string` | ⭕️ | Short description of the clause role (e.g., `"Narrative introduction"`). Optional but helpful for UX surfaces. |
| `parent_clause_id` | `string` | ⭕️ | Identifier of a broader clause or discourse segment that this clause belongs to. Enables hierarchy modeling for indirect discourse and other nested structures. |
| `analysis` | `object` | ⭕️ | Arbitrary key-value store for richer annotations (semantic roles, discourse markers, etc.). |
| `source` | `object` | ✅ | Provenance for this specific clause (data provenance can vary even within the same file). See [Per-clause source metadata](#per-clause-source-metadata). |

### Boundaries

The `start` and `end` objects capture both verse order and character offsets relative to the verse text:

```json
{
  "reference": "Mark 1:1",
  "verse_index": 0,
  "offset": 0
}
```

- `reference` uses the same formatting as the verse payload (`"Book X:Y"`).
- `verse_index` is zero-based and must align with the entry in the `verses` registry.
- `offset` counts Unicode code points from the start of the verse string. Overlays can convert this offset into spans within the rendered HTML. By storing offsets in code points (rather than UTF-16 units), the values remain stable across rendering environments.

For multi-verse clauses, `start.reference` and `end.reference` bracket the span. Offsets are inclusive at the start and exclusive at the end, mirroring JavaScript's `slice` conventions.

### Per-clause source metadata

Each clause has a `source` object with the following shape:

| Field | Type | Description |
| --- | --- | --- |
| `method` | `string` | `"manual"`, `"llm"`, `"hybrid"`, etc. |
| `reviewed_by` | `array` of strings | Optional list of human reviewers. |
| `validation` | `object` | Keyed summary of QA checks (e.g., `{ "alignment": "pass", "schema": "pass" }`). |

### Hierarchical relationships

Clauses that summarise a larger discourse (e.g., an indirect speech frame) can group their dependent clauses using two optional fields:

- **`parent_clause_id`** on a child clause points to its immediate container clause. This enables the UI to surface “parent clause” navigation links.
- **`analysis.sub_clauses`** on the parent clause lists subordinate clause IDs along with optional `role`/`label` metadata. Each entry is an object like `{ "clause_id": "mark-01-07-b", "role": "introduction", "label": "Speech introduction" }`.

When a clause serves purely as a grouping header, set `analysis.group_only` to `true`. Group-only clauses retain their metadata and relationships but are skipped by the highlight renderer so nested spans do not overlap in the UI. Downstream consumers should still include these clauses in details panels and status summaries.

Storing provenance per clause allows gradual improvement: early chapters may be hand-curated while later chapters rely on LLM segmentation pending review.

## Example clause payload (Mark 1:1–3 excerpt)

```json
{
  "book_id": "mark",
  "display_name": "Gospel of Mark",
  "source_path": "external-data/SBLGNT/data/sblgnt/text/Mark.txt",
  "generated": {
    "timestamp": "2025-09-18T00:00:00Z",
    "agent": "spec.author.v1",
    "confidence": "high",
    "notes": "Template document only. No clauses generated yet."
  },
  "verses": [
    { "reference": "Mark 1:1", "index": 0, "chapter": 1, "verse": 1, "character_count": 33 },
    { "reference": "Mark 1:2", "index": 1, "chapter": 1, "verse": 2, "character_count": 86 },
    { "reference": "Mark 1:3", "index": 2, "chapter": 1, "verse": 3, "character_count": 70 }
  ],
  "clauses": [
    {
      "clause_id": "mark-01-01-a",
      "start": { "reference": "Mark 1:1", "verse_index": 0, "offset": 0 },
      "end": { "reference": "Mark 1:1", "verse_index": 0, "offset": 33 },
      "references": ["Mark 1:1"],
      "category_tags": ["main", "narrative"],
      "function": "Narrative title statement",
      "analysis": { "subject": "Ἀρχὴ", "focus": "τοῦ εὐαγγελίου" },
      "source": {
        "method": "manual",
        "reviewed_by": ["analyst.alice"],
        "validation": { "alignment": "pass" }
      }
    },
    {
      "clause_id": "mark-01-02-a",
      "start": { "reference": "Mark 1:2", "verse_index": 1, "offset": 0 },
      "end": { "reference": "Mark 1:2", "verse_index": 1, "offset": 43 },
      "references": ["Mark 1:2"],
      "category_tags": ["quotation", "citation-intro"],
      "analysis": { "source_text": "Isa 40:3" },
      "source": {
        "method": "llm",
        "reviewed_by": [],
        "validation": { "alignment": "pending" }
      }
    }
  ],
  "categories": ["main", "narrative", "quotation", "citation-intro"]
}
```

## Validation checklist

Before accepting a clause payload:

1. **Schema validation:** Ensure every clause includes the required keys and that `start`/`end` references exist in the verse registry.
2. **Boundary sanity:** Offsets must satisfy `0 ≤ offset ≤ character_count`. For multi-verse clauses the `start` index must be ≤ the `end` index.
3. **Ordering:** `clauses` should be sorted by `(start.verse_index, start.offset)` to align with the rendered order. Enforce a stable secondary sort on `clause_id` for deterministic diffs.
4. **Tag hygiene:** `category_tags` must draw from the curated category list (to be documented separately in the analysis-browser plan).
5. **Provenance coverage:** No clause should omit the `source.method`. When method ≠ `manual`, capture the validation state to guide reviewers.

## Next steps

- Build a sample clause payload for Mark 1 that conforms to this specification (Plan §3.2).
- Extend the viewer to read clause files, highlight spans, and surface tooltip metadata (Plan §3.3–§3.4).
- Capture UX guidance on presenting clause analyses (Plan §3.5) once overlays render reliably.
