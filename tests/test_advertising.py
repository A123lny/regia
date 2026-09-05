import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import advertising


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(advertising, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(advertising, "SWITCHES_FILE", str(test_data_dir / "ad_switches.json"))
    monkeypatch.setattr(advertising, "BUDGETS_FILE", str(test_data_dir / "ad_budgets.json"))
    monkeypatch.setattr(advertising, "SPEND_FILE", str(test_data_dir / "ad_spend.json"))
    monkeypatch.setattr(advertising, "CLASSIFICATIONS_FILE", str(test_data_dir / "ad_classifications.json"))
    monkeypatch.setattr(advertising, "OVERSHOOT_FILE", str(test_data_dir / "ad_overshoot_requests.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_all_switches_off_by_default():
    switches = advertising.list_switches("Lenny")
    assert all(v is False for v in switches.values())


def test_set_switch_explicit_on():
    advertising.set_switch("Lenny", "sponsorizzate_social", True)
    assert advertising.is_switch_on("Lenny", "sponsorizzate_social") is True
    assert advertising.is_switch_on("Lenny", "google_ads_ricerca") is False


def test_invalid_category_raises():
    with pytest.raises(ValueError):
        advertising.set_switch("Lenny", "categoria_inesistente", True)


def test_record_spend_blocked_when_switch_off():
    with pytest.raises(PermissionError):
        advertising.record_spend("Lenny", "sponsorizzate_social", 10.0)


def test_record_spend_allowed_within_budget():
    advertising.set_switch("Lenny", "sponsorizzate_social", True)
    advertising.set_budget_cap("Lenny", "sponsorizzate_social", 100.0)
    entry = advertising.record_spend("Lenny", "sponsorizzate_social", 30.0)
    assert entry["amount"] == 30.0
    assert advertising.get_month_to_date_spend("Lenny", "sponsorizzate_social") == 30.0


def test_record_spend_blocked_over_budget():
    advertising.set_switch("Lenny", "sponsorizzate_social", True)
    advertising.set_budget_cap("Lenny", "sponsorizzate_social", 50.0)
    advertising.record_spend("Lenny", "sponsorizzate_social", 40.0)
    with pytest.raises(PermissionError):
        advertising.record_spend("Lenny", "sponsorizzate_social", 20.0)


def test_classify_content():
    entry = advertising.classify_content("c1", "Lenny", "spinto_entro_budget", estimated_spend=15.0)
    assert entry["classification"] == "spinto_entro_budget"
    fetched = advertising.get_classification("c1")
    assert fetched["estimated_spend"] == 15.0


def test_invalid_classification_raises():
    with pytest.raises(ValueError):
        advertising.classify_content("c1", "Lenny", "invalida")


def test_overshoot_never_automatic_requires_explicit_approval():
    advertising.set_switch("Lenny", "google_ads_ricerca", True)
    advertising.set_budget_cap("Lenny", "google_ads_ricerca", 50.0)

    request = advertising.request_overshoot(
        "Lenny", "google_ads_ricerca", requested_amount=30.0, reason="Picco di stagione"
    )
    assert request["state"] == "in_attesa"

    # Il tetto non cambia finché non c'è decisione esplicita
    assert advertising.get_budget_cap("Lenny", "google_ads_ricerca") == 50.0

    decided = advertising.decide_overshoot(request["id"], approve=True)
    assert decided["state"] == "approvato"
    assert advertising.get_budget_cap("Lenny", "google_ads_ricerca") == 80.0


def test_overshoot_rejected_does_not_change_budget():
    advertising.set_budget_cap("Lenny", "google_ads_display", 20.0)
    request = advertising.request_overshoot("Lenny", "google_ads_display", 10.0, "Test")
    advertising.decide_overshoot(request["id"], approve=False)
    assert advertising.get_budget_cap("Lenny", "google_ads_display") == 20.0
