import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import service_email


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(service_email, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(service_email, "EMAILS_FILE", str(test_data_dir / "service_emails.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_factual_question_gets_draft_reply():
    entry = service_email.register_email(
        brand="Stazione", sender="cliente@example.com", subject="Orari", body="A che ora aprite domani?"
    )
    assert entry["classification"] == "fattuale"
    assert entry["state"] == "bozza_pronta"
    assert entry["draft_reply"] is not None


def test_non_factual_question_is_routed_to_owner():
    entry = service_email.register_email(
        brand="Lenny", sender="cliente@example.com", subject="Problema", body="Il mio ordine non è mai arrivato"
    )
    assert entry["classification"] == "da_instradare"
    assert entry["state"] == "notificata"
    assert entry["assigned_to"] == "responsabile_delivery"


def test_send_reply_requires_human_text_for_routed_email():
    entry = service_email.register_email(
        brand="Officina", sender="c@example.com", subject="Reclamo", body="Servizio scadente"
    )
    with pytest.raises(PermissionError):
        service_email.send_reply(entry["id"])

    sent = service_email.send_reply(entry["id"], final_text="Risposta scritta dal responsabile")
    assert sent["state"] == "inviata"


def test_send_reply_factual_can_use_draft():
    entry = service_email.register_email(
        brand="Stazione", sender="c@example.com", subject="Orari", body="Che orari avete oggi?"
    )
    sent = service_email.send_reply(entry["id"])
    assert sent["state"] == "inviata"
    assert sent["draft_reply"] is not None


def test_list_emails_filtered_by_brand_and_state():
    service_email.register_email(brand="Lenny", sender="a@x.com", subject="Orari", body="Che orari fate?")
    service_email.register_email(brand="Officina", sender="b@x.com", subject="Reclamo", body="Non funziona nulla")

    lenny_emails = service_email.list_emails(brand="Lenny")
    assert len(lenny_emails) == 1
    assert lenny_emails[0]["brand"] == "Lenny"

    notified = service_email.list_emails(state="notificata")
    assert len(notified) == 1
    assert notified[0]["brand"] == "Officina"


def test_get_email_unknown_id_returns_none():
    assert service_email.get_email("non-esiste") is None


def test_send_reply_unknown_id_raises():
    with pytest.raises(ValueError):
        service_email.send_reply("non-esiste")
