import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import contacts


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(contacts, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(contacts, "CONTACTS_FILE", str(test_data_dir / "contacts.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_register_contact_resident():
    c = contacts.register_contact(
        brand="Stazione", visitor_type="residente", full_name="Mario Rossi",
        phone="+37800001", consents={"whatsapp": True}
    )
    assert c["visitor_type"] == "residente"
    assert c["consents"]["whatsapp"]["granted"] is True
    assert c["consents"]["email"]["granted"] is False


def test_register_contact_invalid_visitor_type():
    with pytest.raises(ValueError):
        contacts.register_contact(brand="Stazione", visitor_type="alieno", full_name="X")


def test_consent_recorded_with_date_and_source():
    c = contacts.register_contact(
        brand="Lenny", visitor_type="turista", full_name="Anna",
        email="anna@example.com", consents={"email": True}, source="QR-colonnina-3"
    )
    assert c["consents"]["email"]["date"] is not None
    assert c["consents"]["email"]["source"] == "QR-colonnina-3"
    # canale non consentito: nessuna data
    assert c["consents"]["sms"]["date"] is None


def test_has_consent_true_and_false():
    c = contacts.register_contact(
        brand="Lenny", visitor_type="residente", full_name="Luca",
        phone="+37800002", consents={"whatsapp": True, "sms": False}
    )
    assert contacts.has_consent(c["id"], "whatsapp") is True
    assert contacts.has_consent(c["id"], "sms") is False


def test_has_consent_unknown_contact_returns_false():
    assert contacts.has_consent("id-inesistente", "email") is False


def test_set_welcome_voucher():
    c = contacts.register_contact(brand="Stazione", visitor_type="turista", full_name="Test")
    updated = contacts.set_welcome_voucher(c["id"], "ABCD1234")
    assert updated["welcome_voucher_code"] == "ABCD1234"


def test_list_contacts_filters_by_brand_and_type():
    contacts.register_contact(brand="Lenny", visitor_type="residente", full_name="A")
    contacts.register_contact(brand="Stazione", visitor_type="turista", full_name="B")
    contacts.register_contact(brand="Stazione", visitor_type="residente", full_name="C")

    stazione = contacts.list_contacts(brand="Stazione")
    assert len(stazione) == 2

    residenti = contacts.list_contacts(visitor_type="residente")
    assert len(residenti) == 2
