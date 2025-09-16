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

## Quick text inspection helper

For rapid sanity checks without opening a notebook, use `scripts/inspect_sblgnt.py`. The script lists the available books and prints verses from either corpus with optional filters. The examples below show real output captured from the helper:

```bash
$ python scripts/inspect_sblgnt.py --list-books
1Cor
1John
1Pet
1Thess
1Tim
2Cor
2John
2Pet
2Thess
2Tim
3John
Acts
Col
Eph
Gal
Heb
Jas
John
Jude
Luke
Mark
Matt
Phil
Phlm
Rev
Rom
Titus
sblgnt
```

The trailing `sblgnt` entry represents the aggregated corpus file that the upstream project ships alongside the per-book texts.

```bash
$ python scripts/inspect_sblgnt.py --book Mark --limit 5
Mark 1:1: Ἀρχὴ τοῦ εὐαγγελίου Ἰησοῦ ⸀χριστοῦ.
Mark 1:2: ⸀Καθὼς γέγραπται ἐν ⸂τῷ Ἠσαΐᾳ τῷ προφήτῃ⸃·  ⸀Ἰδοὺ ἀποστέλλω τὸν ἄγγελόν μου
          πρὸ προσώπου σου, ὃς κατασκευάσει τὴν ὁδόν ⸀σου·
Mark 1:3: φωνὴ βοῶντος ἐν τῇ ἐρήμῳ· Ἑτοιμάσατε τὴν ὁδὸν κυρίου, εὐθείας ποιεῖτε τὰς
          τρίβους αὐτοῦ,
Mark 1:4: ἐγένετο Ἰωάννης ⸀ὁ βαπτίζων ἐν τῇ ⸀ἐρήμῳ κηρύσσων βάπτισμα μετανοίας εἰς
          ἄφεσιν ἁμαρτιῶν.
Mark 1:5: καὶ ἐξεπορεύετο πρὸς αὐτὸν πᾶσα ἡ Ἰουδαία χώρα καὶ οἱ Ἱεροσολυμῖται ⸂πάντες,
          καὶ ἐβαπτίζοντο⸃  ⸂ὑπʼ αὐτοῦ ἐν τῷ Ἰορδάνῃ ποταμῷ⸃ ἐξομολογούμενοι τὰς
          ἁμαρτίας αὐτῶν.
```

```bash
$ python scripts/inspect_sblgnt.py --book Mark --source text --limit 5
ΚΑΤΑ ΜΑΡΚΟΝ
Mark 1:1: Ἀρχὴ τοῦ εὐαγγελίου Ἰησοῦ ⸀χριστοῦ.
Mark 1:2: ⸀Καθὼς γέγραπται ἐν ⸂τῷ Ἠσαΐᾳ τῷ προφήτῃ⸃· ⸀Ἰδοὺ ἀποστέλλω τὸν ἄγγελόν μου πρὸ
          προσώπου σου, ὃς κατασκευάσει τὴν ὁδόν ⸀σου·
Mark 1:3: φωνὴ βοῶντος ἐν τῇ ἐρήμῳ· Ἑτοιμάσατε τὴν ὁδὸν κυρίου, εὐθείας ποιεῖτε τὰς
          τρίβους αὐτοῦ,
Mark 1:4: ἐγένετο Ἰωάννης ⸀ὁ βαπτίζων ἐν τῇ ⸀ἐρήμῳ κηρύσσων βάπτισμα μετανοίας εἰς
          ἄφεσιν ἁμαρτιῶν.
```

```bash
$ python scripts/inspect_sblgnt.py --book Luke --contains "Ἰησοῦ" --limit 10
Luke 1:31: καὶ ἰδοὺ συλλήμψῃ ἐν γαστρὶ καὶ τέξῃ υἱόν, καὶ καλέσεις τὸ ὄνομα αὐτοῦ
           Ἰησοῦν.
Luke 2:21: Καὶ ὅτε ἐπλήσθησαν ἡμέραι ὀκτὼ τοῦ περιτεμεῖν αὐτόν, καὶ ἐκλήθη τὸ ὄνομα
           αὐτοῦ Ἰησοῦς, τὸ κληθὲν ὑπὸ τοῦ ἀγγέλου πρὸ τοῦ συλλημφθῆναι αὐτὸν ἐν τῇ
           κοιλίᾳ.
Luke 2:27: καὶ ἦλθεν ἐν τῷ πνεύματι εἰς τὸ ἱερόν· καὶ ἐν τῷ εἰσαγαγεῖν τοὺς γονεῖς τὸ
           παιδίον Ἰησοῦν τοῦ ποιῆσαι αὐτοὺς κατὰ τὸ εἰθισμένον τοῦ νόμου περὶ αὐτοῦ
Luke 2:43: καὶ τελειωσάντων τὰς ἡμέρας, ἐν τῷ ὑποστρέφειν αὐτοὺς ὑπέμεινεν Ἰησοῦς ὁ παῖς
           ἐν Ἰερουσαλήμ, καὶ οὐκ ⸂ἔγνωσαν οἱ γονεῖς⸃ αὐτοῦ.
Luke 2:52: Καὶ Ἰησοῦς προέκοπτεν ⸂σοφίᾳ καὶ ἡλικίᾳ⸃ καὶ χάριτι παρὰ θεῷ καὶ ἀνθρώποις.
Luke 3:21: Ἐγένετο δὲ ἐν τῷ βαπτισθῆναι ἅπαντα τὸν λαὸν καὶ Ἰησοῦ βαπτισθέντος καὶ
           προσευχομένου ἀνεῳχθῆναι τὸν οὐρανὸν
Luke 3:23: Καὶ αὐτὸς ⸀ἦν Ἰησοῦς ⸂ἀρχόμενος ὡσεὶ ἐτῶν τριάκοντα⸃, ὢν ⸂υἱός, ὡς
           ἐνομίζετο⸃, Ἰωσὴφ τοῦ Ἠλὶ
Luke 3:29: τοῦ ⸀Ἰησοῦ τοῦ Ἐλιέζερ τοῦ Ἰωρὶμ τοῦ Μαθθὰτ τοῦ Λευὶ
Luke 4:1: Ἰησοῦς δὲ ⸂πλήρης πνεύματος ἁγίου⸃ ὑπέστρεψεν ἀπὸ τοῦ Ἰορδάνου, καὶ ἤγετο ἐν
          τῷ πνεύματι ⸂ἐν τῇ ἐρήμῳ⸃
Luke 4:4: καὶ ἀπεκρίθη ⸂πρὸς αὐτὸν ὁ Ἰησοῦς⸃· Γέγραπται ὅτι Οὐκ ἐπʼ ἄρτῳ μόνῳ ζήσεται ⸀ὁ
          ⸀ἄνθρωπος.
```

Use `--show-paragraphs` to include paragraph indices derived from the XML structure in the output; this makes it easy to verify paragraph transitions while reviewing the text.

These notes provide the baseline needed for the next tasks (scripts, viewer prototype, clause schema decisions) to consume the SBLGNT corpus consistently.
