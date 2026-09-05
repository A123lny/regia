import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import storage


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(storage, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(storage, "CONTENT_FILE", str(test_data_dir / "contents.json"))
    monkeypatch.setattr(storage, "AUDIT_FILE", str(test_data_dir / "audit_log.jsonl"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_contents_grouped_by_date():
    storage.create_content(brand="Lenny", channel="Email", prompt="A", author="owner")
    storage.create_content(brand="Officina", channel="SMS", prompt="B", author="owner")

    grouped = storage.contents_grouped_by_date()
    assert len(grouped) == 1
    date_key = list(grouped.keys())[0]
    assert len(grouped[date_key]) == 2


def test_contents_grouped_by_date_filtered_by_brand():
    storage.create_content(brand="Lenny", channel="Email", prompt="A", author="owner")
    storage.create_content(brand="Officina", channel="SMS", prompt="B", author="owner")

    grouped = storage.contents_grouped_by_date(brand="Lenny")
    date_key = list(grouped.keys())[0]
    assert len(grouped[date_key]) == 1
    assert grouped[date_key][0]["brand"] == "Lenny"


def test_editorial_balance_counts_per_brand():
    for _ in range(18):
        storage.create_content(brand="Lenny", channel="Email", prompt="A", author="owner")
    for _ in range(2):
        storage.create_content(brand="Officina", channel="SMS", prompt="B", author="owner")

    counts = storage.editorial_balance(["Lenny", "Officina", "Eni Cafè"])
    assert counts["Lenny"] == 18
    assert counts["Officina"] == 2
    assert counts["Eni Cafè"] == 0


def test_editorial_balance_empty_when_no_content():
    counts = storage.editorial_balance(["Lenny", "Officina"])
    assert counts == {"Lenny": 0, "Officina": 0}
