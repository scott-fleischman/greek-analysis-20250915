"""Tests for the viewer data build script."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.build_viewer_data import build_payload, parse_verses


@pytest.fixture
def sample_lines() -> list[str]:
    return [
        "The Gospel according to Mark",
        "Mark 1:1 Αρχὴ τοῦ εὐαγγελίου",
        "",
        "Mark 1:2 Καθὼς γέγραπται",
    ]


def test_parse_verses_basic(sample_lines: list[str]) -> None:
    header, verses = parse_verses(sample_lines)

    assert header == "The Gospel according to Mark"
    assert verses == [
        {"reference": "Mark 1:1", "text": "Αρχὴ τοῦ εὐαγγελίου"},
        {"reference": "Mark 1:2", "text": "Καθὼς γέγραπται"},
    ]


def test_parse_verses_multiline() -> None:
    header, verses = parse_verses(
        [
            "Mark heading",
            "Mark 1:1 Αρχὴ",
            "τοῦ εὐαγγελίου Ἰησοῦ Χριστοῦ",
            "Mark 1:2 Καθὼς",
            "γέγραπται ἐν τῷ Ἠσαΐᾳ",
        ]
    )

    assert header == "Mark heading"
    assert verses == [
        {
            "reference": "Mark 1:1",
            "text": "Αρχὴ τοῦ εὐαγγελίου Ἰησοῦ Χριστοῦ",
        },
        {
            "reference": "Mark 1:2",
            "text": "Καθὼς γέγραπται ἐν τῷ Ἠσαΐᾳ",
        },
    ]


def test_parse_verses_empty_input() -> None:
    with pytest.raises(ValueError, match="Input file is empty"):
        parse_verses([])


def test_parse_verses_no_verses() -> None:
    with pytest.raises(ValueError, match="No verses were parsed"):
        parse_verses(["Header only"])


def test_parse_verses_unexpected_text_before_verse() -> None:
    with pytest.raises(ValueError, match="Unexpected line before any verse content"):
        parse_verses(["Header", "", "stray words without verse"])


def test_build_payload_reads_file(tmp_path: Path, sample_lines: list[str]) -> None:
    input_file = tmp_path / "mark.txt"
    input_file.write_text("\n".join(sample_lines), encoding="utf-8")

    header, verses = build_payload(input_file)

    assert header == "The Gospel according to Mark"
    assert verses[0]["text"].startswith("Αρχὴ")
    assert len(verses) == 2


def _run_cli(args: list[str]) -> subprocess.CompletedProcess:
    script_path = PROJECT_ROOT / "scripts" / "build_viewer_data.py"
    command = [sys.executable, str(script_path), *args]
    return subprocess.run(command, check=True, capture_output=True, text=True)


def test_main_writes_expected_payload(tmp_path: Path, sample_lines: list[str]) -> None:
    input_file = tmp_path / "Mark_Greek.txt"
    input_file.write_text("\n".join(sample_lines), encoding="utf-8")
    output_file = tmp_path / "data" / "mark.json"

    _run_cli([str(input_file), str(output_file)])

    payload = json.loads(output_file.read_text(encoding="utf-8"))
    assert payload["book_id"] == "mark_greek"
    assert payload["display_name"] == "Mark_Greek"
    assert payload["header"] == "The Gospel according to Mark"
    assert payload["verses"][1]["reference"] == "Mark 1:2"


def test_main_supports_overrides(tmp_path: Path, sample_lines: list[str]) -> None:
    input_file = tmp_path / "Mark.txt"
    input_file.write_text("\n".join(sample_lines), encoding="utf-8")
    output_file = tmp_path / "output.json"

    _run_cli(
        [
            str(input_file),
            str(output_file),
            "--display-name",
            "Κατὰ Μᾶρκον",
            "--book-id",
            "GospelMark",
        ]
    )

    payload = json.loads(output_file.read_text(encoding="utf-8"))
    assert payload["book_id"] == "GospelMark"
    assert payload["display_name"] == "Κατὰ Μᾶρκον"
    assert payload["source_path"].endswith("Mark.txt")
