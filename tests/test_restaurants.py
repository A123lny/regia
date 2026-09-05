import sys
import os
import shutil
import datetime
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import restaurants


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(restaurants, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(restaurants, "RESTAURANTS_FILE", str(test_data_dir / "restaurants.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_register_restaurant():
    r = restaurants.register_restaurant(name="Pizzeria Da Mario", category="pizzeria")
    assert r["name"] == "Pizzeria Da Mario"
    assert r["orders"] == []
    assert r["last_contact_at"] is None


def test_new_restaurant_is_cooling_by_default():
    r = restaurants.register_restaurant(name="Sushi Bar", category="sushi")
    assert restaurants.is_cooling(r) is True  # nessun ordine ancora


def test_record_order_reduces_cooling():
    r = restaurants.register_restaurant(name="Griglieria", category="griglia")
    restaurants.record_order(r["id"])
    updated = restaurants.get_restaurant(r["id"])
    assert len(updated["orders"]) == 1
    assert restaurants.is_cooling(updated) is False


def test_record_contact_updates_last_contact_and_notes():
    r = restaurants.register_restaurant(name="Trattoria X", category="trattoria")
    updated = restaurants.record_contact(r["id"], note="Chiamato per aggiornamento menu")
    assert updated["last_contact_at"] is not None
    assert len(updated["notes"]) == 1
    assert updated["notes"][0]["text"] == "Chiamato per aggiornamento menu"


def test_orders_last_30_days_counts_recent_only():
    r = restaurants.register_restaurant(name="Old Orders", category="pizzeria")
    restaurants.record_order(r["id"])
    updated = restaurants.get_restaurant(r["id"])
    assert restaurants.orders_last_30_days(updated) == 1


def test_priority_score_higher_for_cooling_restaurant():
    fresh = restaurants.register_restaurant(name="Fresh", category="pizzeria")
    restaurants.record_order(fresh["id"])
    fresh = restaurants.get_restaurant(fresh["id"])

    cooling = restaurants.register_restaurant(name="Cooling", category="pizzeria")
    # nessun ordine registrato -> is_cooling True

    score_fresh = restaurants.contact_priority_score(fresh)
    score_cooling = restaurants.contact_priority_score(cooling)
    assert score_cooling > score_fresh


def test_list_restaurants_by_priority_sorted_descending():
    a = restaurants.register_restaurant(name="A", category="pizzeria")
    b = restaurants.register_restaurant(name="B", category="sushi")
    restaurants.record_order(b["id"])  # B ha un ordine, meno prioritario di A

    ranked = restaurants.list_restaurants_by_priority()
    scores = [r["priority_score"] for r in ranked]
    assert scores == sorted(scores, reverse=True)
    assert ranked[0]["name"] == "A"  # A è più "freddo" quindi più prioritario


def test_get_restaurant_not_found_returns_none():
    assert restaurants.get_restaurant("id-inesistente") is None
