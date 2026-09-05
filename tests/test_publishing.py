import sys
import os
import shutil
import datetime
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import publishing


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(publishing, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(publishing, "QUEUE_FILE", str(test_data_dir / "publishing_queue.json"))
    monkeypatch.setattr(publishing, "LOG_FILE", str(test_data_dir / "publishing_log.jsonl"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_schedule_and_process_publication():
    entry = publishing.schedule_publication(
        content_id="c1", brand="Lenny", channel="Email", snapshot="Testo pubblicato"
    )
    assert entry["state"] == "in_coda"

    result = publishing.process_publication(entry["id"])
    assert result["success"] is True
    assert result["publication"]["state"] == "inviato"


def test_idempotency_key_prevents_duplicate_scheduling():
    first = publishing.schedule_publication(
        content_id="c1", brand="Lenny", channel="Email", snapshot="Testo", idempotency_key="key-1"
    )
    second = publishing.schedule_publication(
        content_id="c1", brand="Lenny", channel="Email", snapshot="Testo", idempotency_key="key-1"
    )
    assert first["id"] == second["id"]
    assert len(publishing.list_queue()) == 1


def test_process_is_idempotent_when_already_sent():
    entry = publishing.schedule_publication(content_id="c1", brand="Lenny", channel="Email", snapshot="x")
    publishing.process_publication(entry["id"])
    result = publishing.process_publication(entry["id"])
    assert result["success"] is True
    assert "idempotente" in result["reason"].lower() or "già inviata" in result["reason"].lower()


def test_whatsapp_rejected_for_generic_promo_category():
    with pytest.raises(ValueError):
        publishing.schedule_publication(
            content_id="c1", brand="Lenny", channel="WhatsApp", snapshot="Promo", category="promozione_generica"
        )


def test_whatsapp_allowed_for_voucher_category():
    entry = publishing.schedule_publication(
        content_id="c1", brand="Stazione", channel="WhatsApp", snapshot="Voucher", category="voucher"
    )
    assert entry["channel"] == "WhatsApp"


def test_whatsapp_time_window_blocks_outside_hours():
    early_morning = datetime.datetime.now().replace(hour=6, minute=0)
    assert publishing.is_within_allowed_window("WhatsApp", early_morning) is False
    daytime = datetime.datetime.now().replace(hour=10, minute=0)
    assert publishing.is_within_allowed_window("WhatsApp", daytime) is True


def test_cancel_publication():
    entry = publishing.schedule_publication(content_id="c1", brand="Lenny", channel="Email", snapshot="x")
    cancelled = publishing.cancel_publication(entry["id"])
    assert cancelled["state"] == "annullato"

    result = publishing.process_publication(entry["id"])
    assert result["success"] is False


def test_failure_after_max_attempts_and_log_entry():
    entry = publishing.schedule_publication(content_id="c1", brand="Lenny", channel="Email", snapshot="x")
    result = publishing.process_publication(entry["id"], force_fail=True)
    assert result["success"] is False
    assert result["publication"]["state"] == "fallito"

    log = publishing.read_publication_log()
    assert len(log) == 1
    assert log[0]["event"] == "publish_failed"


def test_invalid_channel_raises():
    with pytest.raises(ValueError):
        publishing.schedule_publication(content_id="c1", brand="Lenny", channel="Fax", snapshot="x")
