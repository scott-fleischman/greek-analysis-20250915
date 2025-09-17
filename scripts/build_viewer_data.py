#!/usr/bin/env python3
"""Generate JSON payloads for the Gospel viewer from SBLGNT plain-text files."""

from __future__ import annotations

import argparse
import json
import re
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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


def _manifest_sort_key(entry: dict[str, Any]) -> tuple[str, str]:
    display_name = entry.get("display_name")
    book_id = entry.get("book_id")
    primary = display_name.casefold() if isinstance(display_name, str) else ""
    secondary = book_id.casefold() if isinstance(book_id, str) else ""
    return primary, secondary


def update_manifest(manifest_path: Path, payload_path: Path, payload: dict[str, Any]) -> None:
    """Insert or refresh a manifest entry for the generated payload."""

    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    if manifest_path.exists():
        try:
            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Manifest file '{manifest_path}' contains invalid JSON") from exc
        if not isinstance(manifest_data, dict):
            raise ValueError(f"Manifest file '{manifest_path}' must contain a JSON object")
    else:
        manifest_data = {}

    books = manifest_data.get("books")
    if not isinstance(books, list):
        books = []

    try:
        relative_path = payload_path.relative_to(manifest_path.parent)
        relative_path_str = relative_path.as_posix()
    except ValueError:
        relative_path_str = payload_path.name

    manifest_dir_name = manifest_path.parent.name
    if manifest_dir_name:
        data_url_path = Path(manifest_dir_name) / Path(relative_path_str)
    else:
        data_url_path = Path(relative_path_str)
    data_url_str = data_url_path.as_posix()

    new_entry: dict[str, Any] = {
        "book_id": payload.get("book_id"),
        "display_name": payload.get("display_name"),
        "data_path": relative_path_str,
        "data_url": data_url_str,
    }

    if payload.get("header") is not None:
        new_entry["header"] = payload.get("header")
    if payload.get("source_path") is not None:
        new_entry["source_path"] = payload.get("source_path")

    filtered_books = []
    for entry in books:
        if not isinstance(entry, dict):
            continue
        if (
            entry.get("book_id") == new_entry.get("book_id")
            or entry.get("data_path") == new_entry.get("data_path")
            or entry.get("data_url") == new_entry.get("data_url")
        ):
            continue
        filtered_books.append(entry)

    filtered_books.append(new_entry)
    filtered_books.sort(key=_manifest_sort_key)

    manifest_data["books"] = filtered_books
    manifest_data.setdefault("version", 1)
    manifest_data["generated_at"] = datetime.now(timezone.utc).isoformat()

    manifest_path.write_text(
        json.dumps(manifest_data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


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
    parser.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="Manifest JSON file to update; defaults to <output dir>/manifest.json.",
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

    manifest_path = args.manifest or args.output.parent / "manifest.json"
    update_manifest(manifest_path, args.output, payload)


if __name__ == "__main__":
    main()
