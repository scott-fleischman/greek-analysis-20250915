#!/usr/bin/env python3
"""Utility helpers for quick inspection of the SBLGNT corpus.

This script is intentionally lightweight so that editors can spot-check
verse content before investing time in UI work. It supports two modes:

* listing the available books in the repository
* printing selected verses from either the plain-text or XML corpora

Examples
--------
List the book identifiers shipped with the repository::

    python scripts/inspect_sblgnt.py --list-books

Preview the first few verses of Mark from the XML corpus::

    python scripts/inspect_sblgnt.py --book Mark --limit 5

Show the same verses from the plain text file for comparison::

    python scripts/inspect_sblgnt.py --book Mark --source text --limit 5

Search for a phrase anywhere in the book and print the matching verses::

    python scripts/inspect_sblgnt.py --book Mark --contains "Ἰησοῦ" --limit 10
"""

from __future__ import annotations

import argparse
import sys
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, List, Optional, Sequence
from xml.etree import ElementTree as ET

REPO_ROOT = Path(__file__).resolve().parents[1]
TEXT_DIR = REPO_ROOT / "external-data" / "SBLGNT" / "data" / "sblgnt" / "text"
XML_DIR = REPO_ROOT / "external-data" / "SBLGNT" / "data" / "sblgnt" / "xml"


@dataclass
class Verse:
    """Structured representation of a verse for display."""

    reference: str
    text: str
    paragraph_index: Optional[int] = None


def list_books(directory: Path, suffix: str) -> List[str]:
    """Return sorted book identifiers found in ``directory``."""

    return sorted(path.stem for path in directory.glob(f"*{suffix}"))


def ensure_book(book: str, source: str) -> None:
    """Validate that the selected book exists for the requested source."""

    directory = TEXT_DIR if source == "text" else XML_DIR
    suffix = ".txt" if source == "text" else ".xml"
    if not (directory / f"{book}{suffix}").exists():
        options = list_books(directory, suffix)
        message = (
            f"Unknown book '{book}' for source '{source}'.\n"
            f"Available options: {', '.join(options)}"
        )
        raise SystemExit(message)


def iter_plain_verses(book: str) -> Iterator[Verse]:
    """Yield verses from the plain-text corpus.

    The verse files align verses on the left margin and indent continuation
    lines. We capture the book/chapter identifier as the first two tokens and
    treat any indented lines as continuations of the current verse.
    """

    path = TEXT_DIR / f"{book}.txt"
    with path.open(encoding="utf-8") as handle:
        lines = handle.readlines()

    if not lines:
        return

    # The first line is always the title in uppercase (e.g. ΚΑΤΑ ΜΑΡΚΟΝ).
    title = lines[0].strip()
    if title:
        yield Verse(reference="TITLE", text=title, paragraph_index=None)

    current_ref: Optional[str] = None
    buffer: List[str] = []

    for raw_line in lines[1:]:
        if not raw_line.strip():
            continue

        if raw_line[0].isspace():
            # Continuation of the current verse; just append trimmed text.
            buffer.append(raw_line.strip())
            continue

        # Encountered a new verse header. Flush the previous verse first.
        if current_ref is not None:
            verse_text = " ".join(buffer).strip()
            yield Verse(reference=current_ref, text=verse_text)
            buffer = []

        parts = raw_line.strip().split()
        if len(parts) < 3:
            # Not a verse line; skip but warn so the user can investigate.
            print(
                f"Skipping unexpected line in {book}.txt: {raw_line.rstrip()}",
                file=sys.stderr,
            )
            current_ref = None
            buffer = []
            continue

        current_ref = f"{parts[0]} {parts[1]}"
        buffer.append(" ".join(parts[2:]))

    if current_ref is not None:
        verse_text = " ".join(buffer).strip()
        yield Verse(reference=current_ref, text=verse_text)


def iter_xml_verses(book: str) -> Iterator[Verse]:
    """Yield verses from the XML corpus with prefixes and suffixes merged."""

    path = XML_DIR / f"{book}.xml"
    root = ET.parse(path).getroot()

    verses: List[Verse] = []
    current_ref: Optional[str] = None
    parts: List[str] = []
    prefix_buffer = ""
    current_paragraph = -1
    paragraph_index = -1

    for node in root.iter():
        tag = node.tag
        if tag == "p":
            paragraph_index += 1
        elif tag == "verse-number":
            if current_ref is not None:
                verses.append(
                    Verse(
                        reference=current_ref,
                        text="".join(parts).strip(),
                        paragraph_index=current_paragraph,
                    )
                )
                parts = []
            current_ref = node.attrib.get("id", node.text or "")
            current_paragraph = paragraph_index
            prefix_buffer = ""
        elif tag == "prefix":
            if node.text:
                prefix_buffer += node.text
        elif tag == "w":
            if not node.text:
                continue
            if prefix_buffer:
                token = f"{prefix_buffer}{node.text}"
            else:
                needs_space = bool(parts) and not parts[-1].endswith(" ")
                token = (" " if needs_space else "") + node.text
            parts.append(token)
            prefix_buffer = ""
        elif tag == "suffix":
            if node.text:
                parts.append(node.text)

    if current_ref is not None:
        verses.append(
            Verse(
                reference=current_ref,
                text="".join(parts).strip(),
                paragraph_index=current_paragraph,
            )
        )

    return iter(verses)


def filter_verses(
    verses: Iterable[Verse],
    *,
    start: Optional[str] = None,
    contains: Optional[str] = None,
) -> List[Verse]:
    """Apply optional filters to a verse sequence and return a list."""

    collected = list(verses)
    if start:
        start_lower = start.lower()
        for index, verse in enumerate(collected):
            if verse.reference.lower().startswith(start_lower):
                collected = collected[index:]
                break
        else:
            raise SystemExit(f"Start reference '{start}' not found in selection")

    if contains:
        collected = [verse for verse in collected if contains in verse.text]

    return collected


def format_verse(verse: Verse, *, width: int = 88, show_paragraphs: bool = False) -> str:
    """Format a verse for console output."""

    reference = verse.reference
    if show_paragraphs and verse.paragraph_index is not None:
        reference = f"{reference} [¶{verse.paragraph_index}]"

    indent = " " * (len(reference) + 2)
    wrapped = textwrap.fill(
        verse.text,
        width=width,
        initial_indent=f"{reference}: ",
        subsequent_indent=indent,
        replace_whitespace=False,
    )
    return wrapped


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--book", default="Mark", help="Book identifier to inspect")
    parser.add_argument(
        "--source",
        choices=("xml", "text"),
        default="xml",
        help="Corpus to use for verse extraction",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum number of verses to display (0 shows everything)",
    )
    parser.add_argument(
        "--start",
        help="Start output at the first verse whose reference starts with this value",
    )
    parser.add_argument(
        "--contains",
        help="Filter verses to those containing this exact substring",
    )
    parser.add_argument(
        "--list-books",
        action="store_true",
        help="Only list the available books for the selected source",
    )
    parser.add_argument(
        "--show-paragraphs",
        action="store_true",
        help="Include paragraph indices when rendering XML verses",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=88,
        help="Wrap verse output to this column width",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)

    directory = TEXT_DIR if args.source == "text" else XML_DIR
    suffix = ".txt" if args.source == "text" else ".xml"

    if args.list_books:
        books = list_books(directory, suffix)
        for book in books:
            print(book)
        return 0

    ensure_book(args.book, args.source)

    if args.source == "text":
        verses = list(iter_plain_verses(args.book))
    else:
        verses = list(iter_xml_verses(args.book))

    # TITLE entries make sense for the plain text output but we hide them if the
    # caller applies substring filtering since the title is rarely relevant.
    if args.contains and verses and verses[0].reference == "TITLE":
        verses = verses[1:]

    verses = filter_verses(verses, start=args.start, contains=args.contains)

    to_render: Iterable[Verse]
    if args.limit and args.limit > 0:
        to_render = verses[: args.limit]
    else:
        to_render = verses

    if not to_render:
        print("No verses matched the requested filters.")
        return 0

    for verse in to_render:
        if verse.reference == "TITLE":
            print(verse.text)
        else:
            print(format_verse(verse, width=args.width, show_paragraphs=args.show_paragraphs))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
