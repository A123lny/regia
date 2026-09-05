import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import admin


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(admin, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(admin, "BRANDS_FILE", str(test_data_dir / "brands.json"))
    monkeypatch.setattr(admin, "SETTINGS_FILE", str(test_data_dir / "admin_settings.json"))
    monkeypatch.setattr(admin, "COSTS_FILE", str(test_data_dir / "costs.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_get_brands_seeds_defaults():
    brands = admin.get_brands()
    assert brands == admin.DEFAULT_BRANDS


def test_add_brand():
    admin.add_brand("Nuovo Marchio")
    brands = admin.get_brands()
    assert "Nuovo Marchio" in brands


def test_add_brand_no_duplicates():
    admin.add_brand("Lenny")  # già esistente
    brands = admin.get_brands()
    assert brands.count("Lenny") == 1


def test_remove_brand():
    admin.add_brand("Temporaneo")
    admin.remove_brand("Temporaneo")
    assert "Temporaneo" not in admin.get_brands()


def test_system_paused_default_false():
    assert admin.is_system_paused() is False


def test_set_system_paused():
    admin.set_system_paused(True)
    assert admin.is_system_paused() is True
    admin.set_system_paused(False)
    assert admin.is_system_paused() is False


def test_autonomy_default_all_disabled():
    autonomy = admin.get_autonomy_settings()
    assert all(v is False for v in autonomy.values())


def test_set_autonomy_valid_category():
    admin.set_autonomy("recensioni_positive", True)
    autonomy = admin.get_autonomy_settings()
    assert autonomy["recensioni_positive"] is True


def test_set_autonomy_invalid_category_raises():
    with pytest.raises(ValueError):
        admin.set_autonomy("categoria_inesistente", True)


def test_record_cost_invalid_category_raises():
    with pytest.raises(ValueError):
        admin.record_cost("categoria_inesistente", 10.0)


def test_record_cost_and_monthly_total():
    admin.record_cost("ai", 15.0, "chiamate generazione")
    admin.record_cost("ai", 5.0)
    totals = admin.get_monthly_costs()
    assert totals["ai"] == 20.0


def test_cost_alerts_triggered_over_threshold():
    admin.set_cost_threshold("email", 10.0)
    admin.record_cost("email", 15.0)
    alerts = admin.get_cost_alerts()
    categories = [a["category"] for a in alerts]
    assert "email" in categories


def test_cost_alerts_not_triggered_under_threshold():
    admin.set_cost_threshold("whatsapp", 100.0)
    admin.record_cost("whatsapp", 5.0)
    alerts = admin.get_cost_alerts()
    categories = [a["category"] for a in alerts]
    assert "whatsapp" not in categories
