"""Validation tests for the Mark clause sample."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CLAUSE_PATH = PROJECT_ROOT / "viewer" / "data" / "mark.clauses.json"
MARK_PATH = PROJECT_ROOT / "viewer" / "data" / "mark.json"


@pytest.fixture(scope="module")
def mark_payload() -> dict:
    return json.loads(MARK_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def clause_payload() -> dict:
    return json.loads(CLAUSE_PATH.read_text(encoding="utf-8"))


def test_clause_payload_top_level(clause_payload: dict) -> None:
    assert clause_payload["book_id"] == "mark"
    assert clause_payload["display_name"] == "Gospel of Mark"
    assert clause_payload["generated"]["agent"]
    assert clause_payload["generated"]["timestamp"].endswith("Z")


def test_verse_registry_alignment(clause_payload: dict, mark_payload: dict) -> None:
    verses = clause_payload["verses"]
    assert len(verses) == 45

    by_reference = {entry["reference"]: entry for entry in verses}
    mark_verses = mark_payload["verses"]

    for idx, verse in enumerate(mark_verses[:45]):
        ref = verse["reference"]
        entry = by_reference[ref]
        assert entry["index"] == idx
        chapter_str, verse_str = ref.split()[1].split(":")
        assert entry["chapter"] == int(chapter_str)
        assert entry["verse"] == int(verse_str)
        assert entry["character_count"] == len(verse["text"])


def _clause_sort_key(clause: dict) -> tuple[int, int, str]:
    start = clause["start"]
    return start["verse_index"], start["offset"], clause["clause_id"]


def test_clauses_are_sorted_and_aligned(clause_payload: dict) -> None:
    verses = clause_payload["verses"]
    verse_lookup = {entry["reference"]: entry for entry in verses}

    clauses = clause_payload["clauses"]
    assert clauses, "Expected at least one clause entry"

    clause_ids = set()

    for clause in clauses:
        assert re.match(r"^mark-01-\d{2}-[a-z]$", clause["clause_id"])
        assert clause["clause_id"] not in clause_ids
        clause_ids.add(clause["clause_id"])

        start = clause["start"]
        end = clause["end"]
        assert start["reference"] == end["reference"]
        verse_entry = verse_lookup[start["reference"]]
        assert 0 <= start["offset"] <= verse_entry["character_count"]
        assert 0 <= end["offset"] <= verse_entry["character_count"]
        assert start["verse_index"] == verse_entry["index"]
        assert end["verse_index"] == verse_entry["index"]
        assert end["offset"] >= start["offset"]
        assert clause["references"] == [start["reference"]]
        assert clause["source"]["method"] == "manual"
        assert clause["source"]["validation"]["alignment"] == "pass"

    # Ensure sorted order is stable
    sorted_clauses = sorted(clauses, key=_clause_sort_key)
    assert sorted_clauses == clauses


def test_category_registry_consistency(clause_payload: dict) -> None:
    categories = clause_payload["categories"]
    assert categories == sorted(categories)

    clause_tags = {
        tag
        for clause in clause_payload["clauses"]
        for tag in clause["category_tags"]
    }
    assert clause_tags == set(categories)

    for clause in clause_payload["clauses"]:
        tags = clause["category_tags"]
        assert tags[0] == "main"
        if "speech" in tags:
            analysis = clause.get("analysis")
            assert analysis and analysis.get("speaker")
        if "quotation" in tags:
            analysis = clause.get("analysis")
            assert analysis and analysis.get("source")


def test_clause_payload_references(mark_payload: dict, clause_payload: dict) -> None:
    valid_refs = {verse["reference"] for verse in mark_payload["verses"][:45]}
    for clause in clause_payload["clauses"]:
        for ref in clause["references"]:
            assert ref in valid_refs
