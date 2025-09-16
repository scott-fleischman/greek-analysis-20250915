# SBLGNT Data Access Notes

This document captures the current state of the SBLGNT corpus that ships as a git submodule in this repository and explains how to load it for downstream analysis.

## Data layout and coverage

All source files live under [`external-data/SBLGNT`](../external-data/SBLGNT), which tracks the upstream [`SBLGNT`](https://github.com/LogosBible/SBLGNT) project. The submodule exposes two parallel representations:

- `external-data/SBLGNT/data/sblgnt/text` – verse-per-line UTF-8 plain text
- `external-data/SBLGNT/data/sblgnt/xml` – token-level XML with prefixes/suffixes and paragraph breaks
- `external-data/SBLGNT/data/sblgntapp` – textual apparatus notes (plain text + XML)

The repository contains the full 27-book corpus of the Greek New Testament. The following list is generated from the plain-text directory and applies equally to the XML mirror:

```
1Cor, 1John, 1Pet, 1Thess, 1Tim,
2Cor, 2John, 2Pet, 2Thess, 2Tim,
3John, Acts, Col, Eph, Gal, Heb,
Jas, John, Jude, Luke, Mark, Matt,
Phil, Phlm, Rev, Rom, Titus
```

A quick sanity check in Python confirms both the presence and the count of these books:

```python
from pathlib import Path
books = sorted(p.stem for p in Path("external-data/SBLGNT/data/sblgnt/text").glob("*.txt"))
assert len(books) == 27
print(books)
```

## Loading verses from the XML corpus

For most analysis tasks we will want access to the structured XML because it retains token-level metadata. Each `<p>` element holds one paragraph, `<verse-number>` elements mark verse boundaries, `<w>` stores the surface form, while optional `<prefix>` and `<suffix>` nodes capture punctuation, critical signs (⸀, ⸂ …), and spacing that surround the word.

The snippet below demonstrates how to load a single book, returning normalized verse strings while preserving the prefixed/suffixed glyphs supplied by the editors:

```python
from xml.etree import ElementTree as ET
from pathlib import Path

def load_book(book_name: str):
    path = Path("external-data/SBLGNT/data/sblgnt/xml") / f"{book_name}.xml"
    root = ET.parse(path).getroot()
    verses = []
    current_ref = None
    parts = []
    prefix_buffer = ""

    for node in root.iter():
        if node.tag == "verse-number":
            if current_ref is not None:
                verses.append((current_ref, ''.join(parts).strip()))
                parts = []
            current_ref = node.attrib["id"]
            prefix_buffer = ""
        elif node.tag == "prefix" and node.text:
            prefix_buffer += node.text
        elif node.tag == "w" and node.text:
            if prefix_buffer:
                token = prefix_buffer + node.text
            else:
                needs_space = bool(parts) and not parts[-1].endswith(' ')
                token = (' ' if needs_space else '') + node.text
            parts.append(token)
            prefix_buffer = ""
        elif node.tag == "suffix" and node.text:
            parts.append(node.text)

    if current_ref is not None:
        verses.append((current_ref, ''.join(parts).strip()))
    return verses

mark = load_book("Mark")
print(mark[0])        # ('Mark 1:1', 'Ἀρχὴ τοῦ εὐαγγελίου Ἰησοῦ ⸀χριστοῦ.')
print(len(mark))      # 673 verses in Mark (with editorial paragraphing preserved)
```

The same pattern works for any other book name in the list above. Because the XML stores paragraph information (`<p>`), the loader can also be extended to preserve paragraph boundaries by resetting `parts` when a `</p>` is encountered or by tracking paragraph indices alongside verse IDs.

## Clause-level status

The SBLGNT source does **not** contain clause segmentations or IDs. Future clause analyses will therefore need to be layered on top of the verse-level text shown above, either by importing a separate clause dataset or by generating clause boundaries algorithmically. When that resource is available we should extend the loader to merge the clause metadata with the verse content via shared references such as `Mark 1:2a`.

## Additional metadata resources

- The textual apparatus under `external-data/SBLGNT/data/sblgntapp` mirrors the verse structure and can be parsed in the same fashion; each `<note>` conveys a textual variant for the preceding `<verse>` tag.
- The plain-text files in `external-data/SBLGNT/data/sblgnt/text` are convenient for quick manual inspection or diffing, but they do not expose the token-level metadata found in the XML.

These notes provide the baseline needed for the next tasks (scripts, viewer prototype, clause schema decisions) to consume the SBLGNT corpus consistently.
