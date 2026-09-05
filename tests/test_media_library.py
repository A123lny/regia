import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import media_library


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    test_media_dir = test_data_dir / "media"
    monkeypatch.setattr(media_library, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(media_library, "MEDIA_DIR", str(test_media_dir))
    monkeypatch.setattr(media_library, "LIBRARY_FILE", str(test_data_dir / "media_library.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_save_media_creates_file_and_entry():
    entry = media_library.save_media(brand="Lenny", image_bytes=b"fake-png-data", tags=["promo", "estate"])
    assert entry["brand"] == "Lenny"
    assert entry["tags"] == ["promo", "estate"]
    assert entry["used_count"] == 0

    path = media_library.get_media_path(entry["id"])
    assert path is not None
    assert os.path.exists(path)


def test_get_media_bytes_roundtrip():
    entry = media_library.save_media(brand="Stazione", image_bytes=b"binary-content-123")
    data = media_library.get_media_bytes(entry["id"])
    assert data == b"binary-content-123"


def test_tags_normalized_lowercase_and_stripped():
    entry = media_library.save_media(brand="Lenny", image_bytes=b"x", tags=[" Promo ", "ESTATE"])
    assert entry["tags"] == ["promo", "estate"]


def test_list_media_filters_by_brand():
    media_library.save_media(brand="Lenny", image_bytes=b"a")
    media_library.save_media(brand="Stazione", image_bytes=b"b")
    lenny_media = media_library.list_media(brand="Lenny")
    assert len(lenny_media) == 1
    assert lenny_media[0]["brand"] == "Lenny"


def test_list_media_filters_by_tag():
    media_library.save_media(brand="Lenny", image_bytes=b"a", tags=["officina"])
    media_library.save_media(brand="Lenny", image_bytes=b"b", tags=["bar"])
    officina_media = media_library.list_media(tag="officina")
    assert len(officina_media) == 1
    assert "officina" in officina_media[0]["tags"]


def test_mark_used_increments_counter():
    entry = media_library.save_media(brand="Lenny", image_bytes=b"x")
    updated = media_library.mark_used(entry["id"])
    assert updated["used_count"] == 1
    assert updated["last_used_at"] is not None

    updated2 = media_library.mark_used(entry["id"])
    assert updated2["used_count"] == 2


def test_mark_used_unknown_id_returns_none():
    assert media_library.mark_used("id-inesistente") is None


def test_all_tags_returns_unique_sorted():
    media_library.save_media(brand="Lenny", image_bytes=b"a", tags=["promo", "estate"])
    media_library.save_media(brand="Lenny", image_bytes=b"b", tags=["estate", "bar"])
    tags = media_library.all_tags(brand="Lenny")
    assert tags == ["bar", "estate", "promo"]
