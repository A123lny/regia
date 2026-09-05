import sys
import os
import shutil
import datetime
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import daily_use


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(daily_use, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(daily_use, "RECURRING_FILE", str(test_data_dir / "recurring_contents.json"))
    monkeypatch.setattr(daily_use, "ACTIVITY_FILE", str(test_data_dir / "approval_activity.json"))
    monkeypatch.setattr(daily_use, "DELEGATION_FILE", str(test_data_dir / "delegation.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_register_recurring_content():
    entry = daily_use.register_recurring_content(
        brand="Lenny", title="Chiusura natalizia", template_text="Testo", annual_date="12-24", notice_window_days=14
    )
    assert entry["annual_date"] == "12-24"
    all_entries = daily_use.list_all_recurring_contents()
    assert len(all_entries) == 1


def test_due_recurring_content_within_notice_window():
    now = datetime.datetime(2026, 12, 15)
    daily_use.register_recurring_content(
        brand="Lenny", title="Chiusura natalizia", template_text="Testo", annual_date="12-24", notice_window_days=14
    )
    due = daily_use.list_due_recurring_contents(now=now)
    assert len(due) == 1
    assert due[0]["days_until"] == 9


def test_recurring_content_not_due_outside_window():
    now = datetime.datetime(2026, 9, 1)
    daily_use.register_recurring_content(
        brand="Lenny", title="Chiusura natalizia", template_text="Testo", annual_date="12-24", notice_window_days=14
    )
    due = daily_use.list_due_recurring_contents(now=now)
    assert due == []


def test_confirmed_recurring_content_not_due_again_same_year():
    now = datetime.datetime(2026, 12, 15)
    entry = daily_use.register_recurring_content(
        brand="Lenny", title="Chiusura natalizia", template_text="Testo", annual_date="12-24", notice_window_days=14
    )
    daily_use.confirm_recurring_content(entry["id"], 2026)
    due = daily_use.list_due_recurring_contents(now=now)
    assert due == []


def test_absence_status_progression():
    now = datetime.datetime(2026, 9, 10)
    daily_use.record_approval_activity("owner", at=now)

    # Nessuna assenza appena registrata
    status = daily_use.get_absence_status("owner", now=datetime.datetime(2026, 9, 10, 1))
    assert status["status"] == "attivo"

    # Dopo 4 giorni: avviso
    status = daily_use.get_absence_status("owner", now=datetime.datetime(2026, 9, 14))
    assert status["status"] == "avviso_assenza"

    # Dopo 8 giorni: proponi delega
    status = daily_use.get_absence_status("owner", now=datetime.datetime(2026, 9, 18))
    assert status["status"] == "proponi_delega"


def test_absence_status_no_activity_recorded():
    status = daily_use.get_absence_status("mai_attivo")
    assert status["status"] == "nessuna_attivita_registrata"
    assert status["days_absent"] is None


def test_create_and_revoke_delegation():
    entry = daily_use.create_delegation("owner", "sostituto1")
    assert entry["active"] is True

    active = daily_use.get_active_delegation("owner")
    assert active["delegate_username"] == "sostituto1"

    daily_use.revoke_delegation(entry["id"])
    assert daily_use.get_active_delegation("owner") is None


def test_delegate_has_permission_never_promotions_or_admin():
    entry = daily_use.create_delegation("owner", "sostituto1")
    assert daily_use.delegate_has_permission(entry, "propose") is True
    assert daily_use.delegate_has_permission(entry, "approve_promotions") is False
    assert daily_use.delegate_has_permission(entry, "manage_admin") is False
