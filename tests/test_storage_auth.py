import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import storage, auth


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    """Reindirizza lo storage su una cartella temporanea per ogni test."""
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(storage, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(storage, "CONTENT_FILE", str(test_data_dir / "contents.json"))
    monkeypatch.setattr(storage, "AUDIT_FILE", str(test_data_dir / "audit_log.jsonl"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_create_and_list_content():
    content = storage.create_content(brand="Lenny", channel="Email", prompt="Test", author="owner")
    assert content["state"] == "bozza"
    items = storage.list_contents(brand="Lenny")
    assert len(items) == 1
    assert items[0]["id"] == content["id"]


def test_transition_state_workflow():
    content = storage.create_content(brand="Stazione", channel="WhatsApp", prompt="Prova", author="owner")
    updated = storage.transition_state(content["id"], "proposto", user="owner")
    assert updated["state"] == "proposto"
    assert len(updated["history"]) == 2

    approved = storage.transition_state(content["id"], "approvato", user="owner")
    assert approved["state"] == "approvato"


def test_transition_invalid_state_raises():
    content = storage.create_content(brand="Lenny", channel="Email", prompt="X", author="owner")
    with pytest.raises(ValueError):
        storage.transition_state(content["id"], "stato-inesistente", user="owner")


def test_rejection_reason_recorded():
    content = storage.create_content(brand="Lenny", channel="Email", prompt="X", author="editor")
    storage.transition_state(content["id"], "proposto", user="editor")
    rejected = storage.transition_state(content["id"], "bozza", user="owner", reason="Tono non corretto")
    assert rejected["rejection_reason"] == "Tono non corretto"


def test_audit_log_records_events():
    storage.create_content(brand="Lenny", channel="Email", prompt="X", author="owner")
    entries = storage.read_audit_log()
    assert len(entries) >= 1
    assert entries[0]["action"] == "create_content"


def test_auth_valid_credentials():
    user = auth.authenticate("owner", "owner123")
    assert user is not None
    assert user["role"] == "Owner"


def test_auth_invalid_credentials():
    user = auth.authenticate("owner", "wrongpass")
    assert user is None


def test_permissions_owner_vs_editor():
    assert auth.has_permission("Owner", "publish") is True
    assert auth.has_permission("Editor", "publish") is False
    assert auth.has_permission("Editor", "propose") is True
