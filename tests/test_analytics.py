import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import loyalty, reviews, contacts, storage, analytics


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(loyalty, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(loyalty, "COUNTERS_FILE", str(test_data_dir / "counters.json"))
    monkeypatch.setattr(loyalty, "VOUCHERS_FILE", str(test_data_dir / "vouchers.json"))
    monkeypatch.setattr(reviews, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(reviews, "REVIEWS_FILE", str(test_data_dir / "reviews.json"))
    monkeypatch.setattr(contacts, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(contacts, "CONTACTS_FILE", str(test_data_dir / "contacts.json"))
    monkeypatch.setattr(storage, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(storage, "CONTENT_FILE", str(test_data_dir / "contents.json"))
    monkeypatch.setattr(storage, "AUDIT_FILE", str(test_data_dir / "audit_log.jsonl"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_brand_summary_empty():
    summary = analytics.brand_summary(brand="Lenny")
    assert summary["brand"] == "Lenny"
    assert summary["vouchers"]["total"] == 0
    assert summary["reviews"]["total"] == 0
    assert summary["contacts"]["total"] == 0


def test_brand_summary_with_data():
    v = loyalty.issue_voucher("+37800001", "Stazione", "Lenny", "lavaggio", "10% sconto")
    loyalty.redeem_voucher(v["code"])
    loyalty.issue_voucher("+37800002", "Stazione", "Lenny", "lavaggio", "10% sconto")

    reviews.create_review(brand="Stazione", author_name="Mario", rating=5, text="Ottimo")
    reviews.create_review(brand="Stazione", author_name="Luigi", rating=2, text="Lento")

    contacts.register_contact(brand="Stazione", visitor_type="residente", full_name="Anna")
    contacts.register_contact(brand="Stazione", visitor_type="turista", full_name="Bob")

    storage.create_content(brand="Stazione", channel="Email", prompt="Promo", author="owner")

    summary = analytics.brand_summary(brand="Stazione")
    assert summary["vouchers"]["total"] == 2
    assert summary["vouchers"]["redeemed"] == 1
    assert summary["vouchers"]["redemption_rate_pct"] == 50.0

    assert summary["reviews"]["total"] == 2
    assert summary["reviews"]["by_category"]["positiva"] == 1
    assert summary["reviews"]["by_category"]["negativa"] == 1
    assert summary["reviews"]["avg_rating"] == 3.5

    assert summary["contacts"]["total"] == 2
    assert summary["contacts"]["by_type"]["residente"] == 1
    assert summary["contacts"]["by_type"]["turista"] == 1

    assert summary["contents"]["total"] == 1
    assert summary["contents"]["by_state"]["bozza"] == 1


def test_brand_summary_all_brands_aggregates():
    loyalty.issue_voucher("+1", "Lenny", "Stazione", "cibo", "V1")
    loyalty.issue_voucher("+2", "Stazione", "Lenny", "lavaggio", "V2")
    summary = analytics.brand_summary(brand=None)
    assert summary["brand"] == "Tutti i marchi"
    assert summary["vouchers"]["total"] == 2


def test_cross_brand_voucher_flow():
    v1 = loyalty.issue_voucher("+1", "Stazione", "Lenny", "lavaggio", "V1")
    loyalty.redeem_voucher(v1["code"])
    loyalty.issue_voucher("+2", "Stazione", "Lenny", "lavaggio", "V2")
    loyalty.issue_voucher("+3", "Lenny", "Stazione", "cibo", "V3")

    flows = analytics.cross_brand_voucher_flow()
    routes = {f["route"]: f for f in flows}

    assert routes["Stazione → Lenny"]["issued"] == 2
    assert routes["Stazione → Lenny"]["redeemed"] == 1
    assert routes["Lenny → Stazione"]["issued"] == 1
    assert routes["Lenny → Stazione"]["redeemed"] == 0
