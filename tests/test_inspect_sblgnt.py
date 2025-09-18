from __future__ import annotations

"""Tests for the SBLGNT inspection utility."""

import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts import inspect_sblgnt as inspect


@pytest.fixture
def fake_corpus(tmp_path, monkeypatch):
    """Create a lightweight corpus for exercising the inspector."""

    text_dir = tmp_path / "text"
    xml_dir = tmp_path / "xml"
    text_dir.mkdir()
    xml_dir.mkdir()

    text_content = "\n".join(
        [
            "KATA MARKON",
            "Mark 1:1 Λόγος Θεοῦ",
            "  καὶ Πατρός",
            "",
            "Mark 1:2 Καθὼς γέγραπται",
            " continuation line",
            "Oops",
            "Mark 1:3 Φωνὴ βοῶντος",
            "  ἐν τῇ ἐρήμῳ",
            "",
        ]
    )
    (text_dir / "Mark.txt").write_text(text_content, encoding="utf-8")
    (text_dir / "Empty.txt").write_text("", encoding="utf-8")
    (text_dir / "Another.txt").write_text(
        "Another Heading\nAnother 1:1 Παῦλος δοῦλος\n", encoding="utf-8"
    )

    xml_content = """
    <book>
      <p>
        <verse-number id="Mark 1:1">Mark 1:1</verse-number>
        <w>Ἀρχή</w>
        <suffix>·</suffix>
      </p>
      <p>
        <verse-number id="Mark 1:2">Mark 1:2</verse-number>
        <prefix>Καθ</prefix>
        <w>ὼς</w>
        <w>ἐστίν </w>
        <w>γέγραπται</w>
        <suffix>·</suffix>
      </p>
    </book>
    """.strip()
    (xml_dir / "Mark.xml").write_text(xml_content, encoding="utf-8")

    monkeypatch.setattr(inspect, "TEXT_DIR", text_dir)
    monkeypatch.setattr(inspect, "XML_DIR", xml_dir)
    return text_dir, xml_dir


def test_list_books_returns_sorted(fake_corpus):
    text_dir, _ = fake_corpus
    books = inspect.list_books(text_dir, ".txt")

    assert books == sorted(books)
    assert books[0] == "Another"
    assert "Mark" in books


def test_ensure_book_validates_presence(fake_corpus):
    inspect.ensure_book("Mark", "text")
    inspect.ensure_book("Mark", "xml")


def test_ensure_book_raises_for_missing(fake_corpus):
    with pytest.raises(SystemExit) as exc:
        inspect.ensure_book("Missing", "text")

    message = str(exc.value)
    assert "Unknown book 'Missing'" in message
    assert "Available options" in message
    assert "Mark" in message


def test_iter_plain_verses_parses_lines(fake_corpus, capfd):
    verses = list(inspect.iter_plain_verses("Mark"))

    assert [verse.reference for verse in verses[:3]] == [
        "TITLE",
        "Mark 1:1",
        "Mark 1:2",
    ]
    assert "καὶ Πατρός" in verses[1].text
    assert verses[-1].reference == "Mark 1:3"
    assert "ἐν τῇ ἐρήμῳ" in verses[-1].text

    captured = capfd.readouterr()
    assert "Skipping unexpected line" in captured.err


def test_iter_plain_verses_empty_file(fake_corpus):
    assert list(inspect.iter_plain_verses("Empty")) == []


def test_iter_xml_verses_handles_tokens(fake_corpus):
    verses = list(inspect.iter_xml_verses("Mark"))

    assert [verse.reference for verse in verses] == ["Mark 1:1", "Mark 1:2"]
    assert verses[0].text == "Ἀρχή·"
    assert verses[1].text == "Καθὼς ἐστίν γέγραπται·"
    assert verses[1].paragraph_index == 1


def test_filter_verses_start_and_contains():
    verses = [
        inspect.Verse(reference="Mark 1:1", text="Καθὼς"),
        inspect.Verse(reference="Mark 1:2", text="Ἰωάννης"),
    ]

    filtered = inspect.filter_verses(verses, start="Mark 1:2")
    assert filtered == [verses[1]]

    contains_filtered = inspect.filter_verses(verses, contains="Καθ")
    assert contains_filtered == [verses[0]]


def test_filter_verses_start_not_found():
    verses = [inspect.Verse(reference="Mark 1:1", text="Καθὼς")]

    with pytest.raises(SystemExit, match="Start reference 'Mark 2' not found"):
        inspect.filter_verses(verses, start="Mark 2")


def test_format_verse_supports_paragraphs():
    verse = inspect.Verse(reference="Mark 1:1", text="Καθὼς ἐστίν", paragraph_index=3)

    formatted = inspect.format_verse(verse, width=40, show_paragraphs=True)

    assert formatted.startswith("Mark 1:1 [¶3]: Καθὼς ἐστίν")


def test_parse_args_accepts_overrides():
    args = inspect.parse_args(
        [
            "--book",
            "Luke",
            "--source",
            "text",
            "--limit",
            "5",
            "--start",
            "Mark 1:2",
            "--contains",
            "Ἰησοῦ",
            "--list-books",
            "--show-paragraphs",
            "--width",
            "72",
        ]
    )

    assert args.book == "Luke"
    assert args.source == "text"
    assert args.limit == 5
    assert args.start == "Mark 1:2"
    assert args.contains == "Ἰησοῦ"
    assert args.list_books is True
    assert args.show_paragraphs is True
    assert args.width == 72


def test_main_lists_books(fake_corpus, capsys):
    exit_code = inspect.main(["--list-books", "--source", "text"])

    captured = capsys.readouterr()
    assert "Another" in captured.out
    assert "Mark" in captured.out
    assert exit_code == 0


def test_main_filters_plain_text(fake_corpus, capsys):
    exit_code = inspect.main(
        [
            "--source",
            "text",
            "--book",
            "Mark",
            "--contains",
            "Καθ",
            "--limit",
            "1",
            "--width",
            "60",
        ]
    )

    captured = capsys.readouterr()
    assert "Mark 1:2" in captured.out
    assert "Καθὼς γέγραπται" in captured.out
    assert "KATA MARKON" not in captured.out
    assert exit_code == 0


def test_main_reports_no_matches(fake_corpus, capsys):
    exit_code = inspect.main(
        ["--source", "text", "--book", "Mark", "--contains", "NotPresent"]
    )

    captured = capsys.readouterr()
    assert "No verses matched" in captured.out
    assert exit_code == 0


def test_main_limit_zero_outputs_all(fake_corpus, capsys):
    exit_code = inspect.main(["--source", "text", "--book", "Mark", "--limit", "0"])

    captured = capsys.readouterr()
    assert "KATA MARKON" in captured.out
    assert "Mark 1:3" in captured.out
    assert exit_code == 0


def test_main_renders_xml_with_paragraphs(fake_corpus, capsys):
    exit_code = inspect.main(
        [
            "--source",
            "xml",
            "--book",
            "Mark",
            "--limit",
            "1",
            "--show-paragraphs",
            "--width",
            "50",
        ]
    )

    captured = capsys.readouterr()
    assert "[¶0]" in captured.out
    assert "Ἀρχή·" in captured.out
    assert exit_code == 0


def test_main_instructs_when_corpus_missing(monkeypatch, tmp_path):
    missing = tmp_path / "absent"
    monkeypatch.setattr(inspect, "TEXT_DIR", missing)

    with pytest.raises(SystemExit) as exc:
        inspect.main(["--source", "text"])

    message = str(exc.value)
    assert "SBLGNT text corpus not found" in message
    assert "git submodule update --init --recursive" in message


def test_resolve_source_paths_requires_populated_directory(tmp_path, monkeypatch):
    empty_dir = tmp_path / "text"
    empty_dir.mkdir()
    monkeypatch.setattr(inspect, "TEXT_DIR", empty_dir)

    with pytest.raises(SystemExit) as exc:
        inspect._resolve_source_paths("text")

    assert "does not contain any .txt files" in str(exc.value)

    xml_dir = tmp_path / "xml"
    monkeypatch.setattr(inspect, "XML_DIR", xml_dir)

    with pytest.raises(SystemExit) as exc:
        inspect._resolve_source_paths("xml")

    assert "not found" in str(exc.value)
