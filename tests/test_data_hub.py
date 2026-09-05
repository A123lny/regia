import sys
import os
import shutil
import datetime
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import data_hub


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(data_hub, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(data_hub, "VEHICLES_FILE", str(test_data_dir / "vehicles.json"))
    monkeypatch.setattr(data_hub, "PRICES_FILE", str(test_data_dir / "price_history.json"))
    monkeypatch.setattr(data_hub, "DATA_REQUESTS_FILE", str(test_data_dir / "personal_data_requests.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


# --- Veicoli (RF-1.3) ---

def test_register_vehicle_creates_entry():
    entry = data_hub.register_vehicle(contact="mario@example.com", plate="ab123cd", model="Panda", mileage_km=50000)
    assert entry["plate"] == "AB123CD"
    assert data_hub.get_vehicle_by_plate("ab123cd")["id"] == entry["id"]


def test_register_vehicle_updates_existing_by_plate():
    data_hub.register_vehicle(contact="mario@example.com", plate="AB123CD", model="Panda", mileage_km=50000)
    updated = data_hub.register_vehicle(contact="mario@example.com", plate="AB123CD", model="Panda", mileage_km=55000)
    assert updated["mileage_km"] == 55000
    assert len(data_hub.list_vehicles()) == 1


def test_register_vehicle_invalid_tire_type_raises():
    with pytest.raises(ValueError):
        data_hub.register_vehicle(contact="c", plate="X1", model="Y", mileage_km=0, tire_type="slick")


def test_vehicles_due_for_reminder_no_service_date():
    data_hub.register_vehicle(contact="c", plate="X1", model="Y", mileage_km=0)
    due = data_hub.vehicles_due_for_reminder()
    assert len(due) == 1


def test_vehicles_due_for_reminder_old_service():
    old_date = (datetime.datetime.now() - datetime.timedelta(days=250)).isoformat()
    data_hub.register_vehicle(contact="c", plate="X1", model="Y", mileage_km=0, last_service_date=old_date)
    due = data_hub.vehicles_due_for_reminder(months_since_service=6)
    assert len(due) == 1


def test_vehicles_not_due_recent_service():
    recent_date = datetime.datetime.now().isoformat()
    data_hub.register_vehicle(contact="c", plate="X1", model="Y", mileage_km=0, last_service_date=recent_date)
    due = data_hub.vehicles_due_for_reminder(months_since_service=6)
    assert due == []


# --- Storico prezzi (RF-1.5) ---

def test_record_and_get_current_price():
    data_hub.record_price("Stazione", "Diesel", 1.75)
    current = data_hub.get_current_price("Stazione", "Diesel")
    assert current["price"] == 1.75


def test_price_history_ordered_desc():
    data_hub.record_price("Stazione", "Diesel", 1.70, valid_from="2026-01-01T00:00:00")
    data_hub.record_price("Stazione", "Diesel", 1.80, valid_from="2026-06-01T00:00:00")
    history = data_hub.get_price_history("Stazione", "Diesel")
    assert history[0]["price"] == 1.80


def test_get_current_price_none_when_no_history():
    assert data_hub.get_current_price("Stazione", "Benzina") is None


# --- Igiene liste (RF-1.7) ---

def test_find_duplicate_contacts():
    contacts_list = [
        {"email": "a@x.com"}, {"email": "A@X.com"}, {"email": "b@x.com"},
    ]
    duplicates = data_hub.find_duplicate_contacts(contacts_list)
    assert len(duplicates) == 1
    assert len(duplicates[0]) == 2


def test_is_valid_email():
    assert data_hub.is_valid_email("test@example.com") is True
    assert data_hub.is_valid_email("non-valida") is False


def test_find_invalid_emails():
    contacts_list = [{"email": "ok@x.com"}, {"email": "rotta"}]
    invalid = data_hub.find_invalid_emails(contacts_list)
    assert len(invalid) == 1


def test_find_inactive_contacts():
    old_activity = (datetime.datetime.now() - datetime.timedelta(days=200)).isoformat()
    contacts_list = [{"email": "a@x.com", "last_activity_at": old_activity}, {"email": "b@x.com", "last_activity_at": datetime.datetime.now().isoformat()}]
    inactive = data_hub.find_inactive_contacts(contacts_list, inactive_days=180)
    assert len(inactive) == 1
    assert inactive[0]["email"] == "a@x.com"


# --- Segmentazione (RF-1.8) ---

def test_compute_rfv_segment_nuovo():
    assert data_hub.compute_rfv_segment(recency_days=1, frequency=1, value=10) == "nuovo"


def test_compute_rfv_segment_top():
    assert data_hub.compute_rfv_segment(recency_days=1, frequency=12, value=250) == "top"


def test_compute_rfv_segment_abituale():
    assert data_hub.compute_rfv_segment(recency_days=1, frequency=5, value=50) == "abituale"


def test_segment_contacts_groups_correctly():
    now = datetime.datetime.now()
    contacts_list = [
        {"order_count": 1, "total_value": 10},
        {"order_count": 12, "total_value": 250, "last_order_at": now.isoformat()},
    ]
    result = data_hub.segment_contacts(contacts_list, now=now)
    assert len(result["nuovo"]) == 1
    assert len(result["top"]) == 1


# --- Richieste dati personali (RF-1.9) ---

def test_create_personal_data_request_invalid_type_raises():
    with pytest.raises(ValueError):
        data_hub.create_personal_data_request("c@x.com", "invalida")


def test_create_and_handle_personal_data_request():
    entry = data_hub.create_personal_data_request("c@x.com", "esportazione", notes="richiesto via email")
    assert entry["state"] == "in_attesa"

    handled = data_hub.mark_request_handled(entry["id"], handled_by="operatore1")
    assert handled["state"] == "gestita"
    assert handled["handled_by"] == "operatore1"


def test_list_personal_data_requests_filtered_by_state():
    data_hub.create_personal_data_request("a@x.com", "esportazione")
    entry2 = data_hub.create_personal_data_request("b@x.com", "cancellazione")
    data_hub.mark_request_handled(entry2["id"], "op1")

    pending = data_hub.list_personal_data_requests(state="in_attesa")
    assert len(pending) == 1
    assert pending[0]["contact"] == "a@x.com"


def test_build_data_dossier_filters_by_contact():
    data_hub.register_vehicle(contact="mario@example.com", plate="AB123CD", model="Panda", mileage_km=100)
    dossier = data_hub.build_data_dossier(
        "mario@example.com",
        consents=[{"contact": "mario@example.com", "channel": "email"}],
        vouchers=[{"contact": "altra@example.com"}],
        contact_registrations=[],
    )
    assert len(dossier["vehicles"]) == 1
    assert len(dossier["consents"]) == 1
    assert len(dossier["vouchers"]) == 0
