import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import brand_identity


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(brand_identity, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(brand_identity, "IDENTITY_FILE", str(test_data_dir / "brand_identity.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_get_identity_creates_default_when_missing():
    identity = brand_identity.get_identity("Lenny")
    assert identity["brand"] == "Lenny"
    assert identity["tone_of_voice"] == ""
    assert identity["pillars"] == []


def test_update_identity_basic_fields():
    brand_identity.update_identity("Lenny", tone_of_voice="Giovane e veloce", font="Poppins")
    identity = brand_identity.get_identity("Lenny")
    assert identity["tone_of_voice"] == "Giovane e veloce"
    assert identity["font"] == "Poppins"


def test_update_identity_strategic_context_merges():
    brand_identity.update_identity("Lenny", strategic_context={"purpose_audience": "Giovani professionisti"})
    brand_identity.update_identity("Lenny", strategic_context={"year_goal": "Crescere del 20%"})
    identity = brand_identity.get_identity("Lenny")
    assert identity["strategic_context"]["purpose_audience"] == "Giovani professionisti"
    assert identity["strategic_context"]["year_goal"] == "Crescere del 20%"


def test_add_and_remove_pillar():
    brand_identity.add_pillar("Stazione", "Consigli stagionali", weight=3)
    identity = brand_identity.get_identity("Stazione")
    assert len(identity["pillars"]) == 1
    assert identity["pillars"][0]["weight"] == 3

    brand_identity.remove_pillar("Stazione", "Consigli stagionali")
    identity = brand_identity.get_identity("Stazione")
    assert identity["pillars"] == []


def test_add_forbidden_word_deduplicates():
    brand_identity.add_forbidden_word("Lenny", "Gratis")
    brand_identity.add_forbidden_word("Lenny", "gratis")
    identity = brand_identity.get_identity("Lenny")
    assert identity["forbidden_words"] == ["gratis"]


def test_check_text_against_constraints_detects_forbidden_word():
    brand_identity.add_forbidden_word("Lenny", "miglior")
    result = brand_identity.check_text_against_constraints("Lenny", "Siamo il miglior servizio della città")
    assert result["requires_human_review"] is True
    assert "miglior" in result["forbidden_words_found"]


def test_check_text_against_constraints_clean_text():
    result = brand_identity.check_text_against_constraints("Lenny", "Ordina ora la tua pizza preferita")
    assert result["requires_human_review"] is False


def test_get_generation_context_includes_all_fields():
    brand_identity.update_identity(
        "Officina",
        tone_of_voice="Affidabile",
        strategic_context={"purpose_audience": "Automobilisti locali", "year_goal": "Prime recensioni", "future_direction": "Espansione"},
    )
    context = brand_identity.get_generation_context("Officina")
    assert "Officina" in context
    assert "Affidabile" in context
    assert "Automobilisti locali" in context


def test_list_all_identities():
    brand_identity.get_identity("Lenny")
    brand_identity.get_identity("Stazione")
    all_identities = brand_identity.list_all_identities()
    assert len(all_identities) == 2
