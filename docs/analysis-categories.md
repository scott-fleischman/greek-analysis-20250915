# Clause Analysis Categories for the Gospel of Mark

This reference defines the initial analysis categories that ride alongside the clause overlay for Mark.
It extends the `category_tags` guidance from `docs/clause-schema.md` so future agents can annotate
clauses consistently and the planned analysis browser (Plan §4) can summarize results without additional
reverse engineering.

## How categories integrate with the clause schema

- **Storage location.** Clause tags live inside the `category_tags` array for each clause entry.
  Keep the order stable (`main` first, followed by contextual tags in alphabetical order) so diffs remain predictable.
- **Vocabulary control.** All tags must come from the controlled list below. The top-level `categories` array
  in each clause file mirrors the unique set of tags present so the viewer manifest can advertise the available analyses.
- **Combination friendly.** Tags are intentionally non-exclusive: a single clause may carry multiple
  categories when its function spans several contexts (e.g., a scripture quotation delivered within speech).
- **Validation hook.** Schema checks should fail if a clause introduces a tag that is missing from this document;
  downstream automation can parse this file to seed acceptable values.

## Category inventory and context rules

| ID | Display label | Definition | Context rules |
| --- | --- | --- | --- |
| `main` | Main narrative thread | Marks the canonical clause segmentation unit. Every clause receives `main` so analytical layers can assume at least one baseline category. | Apply to **all** clause entries. Additional tags refine the context but never replace `main`. |
| `narrative` | Narrative action | Describes storyline clauses outside of direct quotations—introductions, descriptions, travel summaries, and editorial framing. | Use when the clause advances or comments on events in the narrator's voice. Exclude when the words are attributed speech (`speech`) or formal citations (`quotation`). |
| `speech` | Direct speech | Flags clauses representing words spoken by a character (dialogue, proclamations, commands). | Apply to clauses enclosed by quotation markers or otherwise identified as spoken content. Speech-introductory clauses ("he said") stay `narrative`. |
| `quotation` | Scripture citation | Identifies clauses that quote or paraphrase earlier Scripture or authoritative sources. | Tag the clause that contains the citation itself. Narrative framing around the citation remains `narrative` without `quotation`. |

## Application patterns

- **Baseline expectation:** Because `main` is universal, UI surfaces can treat it as the default filter and offer
  specialized toggles for the contextual tags (`narrative`, `speech`, `quotation`).
- **Narrative chains:** Multi-clause narrative sequences may include setup, action, and aftermath. Keep each clause
  tagged `narrative` unless it is direct speech or a formal citation.
- **Speech overlays:** Speech content often alternates with narrative framing. Keep `speech` on the quoted words
  themselves; introductory or closing formulae remain `narrative` to preserve discourse boundaries.
- **Citation handling:** When a quotation spans several clauses, apply `quotation` to each clause in the quotation block
  so browsers can count complete coverage rather than partial references.

## Extending the vocabulary

1. Propose the new category (ID and rationale) in this document, including clear context rules.
2. Update clause payloads so the top-level `categories` list and per-clause `category_tags` use the new ID.
3. Add validation coverage in tests (e.g., guarding against typos and ensuring combinations remain consistent).
4. Document any downstream viewer or analysis-browser changes that rely on the new tag so UI work stays aligned.

Maintaining this document alongside the clause schema keeps category semantics explicit,
ensuring future data generation or LLM-assisted annotation aligns with the intended analytical structure.
