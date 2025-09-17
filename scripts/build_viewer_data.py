#!/usr/bin/env python3
"""Generate JSON payloads for the Gospel viewer from SBLGNT plain-text files."""

from __future__ import annotations

import argparse
import json
import re
from collections.abc import Iterable
from pathlib import Path


VERSE_PATTERN = re.compile(
    r"^(?P<book>[1-3]?\s?[A-Za-z]+)\s+(?P<chapter>\d+):(?P<verse>\d+)\s+(?P<text>\S.*)$"
)


def parse_verses(lines: Iterable[str]) -> tuple[str, list[dict[str, str]]]:
    """Return the document header and a list of verse dictionaries."""

    lines_iter = iter(lines)
    try:
        header = next(lines_iter).strip()
    except StopIteration as exc:
        raise ValueError("Input file is empty") from exc

    verses: list[dict[str, str]] = []
    current: dict | None = None

    for raw_line in lines_iter:
        line = raw_line.rstrip()
        if not line.strip():
            continue

        match = VERSE_PATTERN.match(line)
        if match:
            if current:
                verses.append(current)
            reference = f"{match.group('book')} {match.group('chapter')}:{match.group('verse')}"
            current = {
                "reference": reference,
                "text": match.group("text").strip(),
            }
        else:
            if current is None:
                raise ValueError(f"Unexpected line before any verse content: {line}")
            current["text"] = f"{current['text']} {line.strip()}"

    if current:
        verses.append(current)

    if not verses:
        raise ValueError("No verses were parsed from the file")

    return header, verses


def build_payload(input_path: Path) -> tuple[str, list[dict[str, str]]]:
    content = input_path.read_text(encoding="utf-8").splitlines()
    return parse_verses(content)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Plain-text SBLGNT book file to parse")
    parser.add_argument("output", type=Path, help="Destination JSON file")
    parser.add_argument(
        "--display-name",
        type=str,
        default=None,
        help="Optional human-friendly book name; defaults to the input file stem.",
    )
    parser.add_argument(
        "--book-id",
        type=str,
        default=None,
        help="Stable identifier for the book; defaults to the lower-case file stem.",
    )

    args = parser.parse_args()

    book_id = args.book_id or args.input.stem.lower()
    display_name = args.display_name or args.input.stem

    header, verses = build_payload(args.input)

    payload = {
        "book_id": book_id,
        "display_name": display_name,
        "header": header,
        "source_path": str(args.input),
        "verses": verses,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
