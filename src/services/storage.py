"""
Storage locale minimale per contenuti (bozze, workflow di stato) e audit log.

Persistenza semplice su file JSON in `data/`. Non adatto alla produzione:
è pensato per il prototipo, con la stessa forma dati che poi migrerà su DB reale.

Workflow di stato (RF-3.5): bozza -> proposto -> approvato -> programmato -> pubblicato -> misurato
"""
import json
import os
import uuid
import datetime
from typing import List, Dict, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
CONTENT_FILE = os.path.join(DATA_DIR, "contents.json")
AUDIT_FILE = os.path.join(DATA_DIR, "audit_log.jsonl")

STATES = ["bozza", "proposto", "approvato", "programmato", "pubblicato", "misurato"]


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CONTENT_FILE):
        with open(CONTENT_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load_all() -> List[Dict]:
    _ensure_data_dir()
    with open(CONTENT_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save_all(items: List[Dict]):
    _ensure_data_dir()
    with open(CONTENT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def log_audit(user: str, action: str, details: Optional[Dict] = None):
    """Registra un evento di audit (RF-11.3, semplificato per il prototipo)."""
    _ensure_data_dir()
    entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "user": user,
        "action": action,
        "details": details or {},
    }
    with open(AUDIT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def create_content(brand: str, channel: str, prompt: str, author: str) -> Dict:
    """Crea un nuovo contenuto in stato 'bozza'."""
    items = _load_all()
    now = datetime.datetime.now().isoformat()
    content = {
        "id": str(uuid.uuid4()),
        "brand": brand,
        "channel": channel,
        "prompt": prompt,
        "state": "bozza",
        "author": author,
        "created_at": now,
        "updated_at": now,
        "history": [{"state": "bozza", "at": now, "by": author}],
        "rejection_reason": None,
    }
    items.append(content)
    _save_all(items)
    log_audit(author, "create_content", {"id": content["id"], "brand": brand, "channel": channel})
    return content


def list_contents(brand: Optional[str] = None, state: Optional[str] = None) -> List[Dict]:
    items = _load_all()
    if brand:
        items = [i for i in items if i.get("brand") == brand]
    if state:
        items = [i for i in items if i.get("state") == state]
    return sorted(items, key=lambda i: i.get("created_at", ""), reverse=True)


def get_content(content_id: str) -> Optional[Dict]:
    items = _load_all()
    for i in items:
        if i.get("id") == content_id:
            return i
    return None


def transition_state(content_id: str, new_state: str, user: str, reason: Optional[str] = None) -> Optional[Dict]:
    """Cambia lo stato di un contenuto seguendo il workflow (RF-3.5).

    Se new_state == 'bozza' e reason fornito, si registra come motivo di rifiuto (RF-3.8).
    """
    if new_state not in STATES:
        raise ValueError(f"Stato non valido: {new_state}")

    items = _load_all()
    for i in items:
        if i.get("id") == content_id:
            old_state = i.get("state")
            now = datetime.datetime.now().isoformat()
            i["state"] = new_state
            i["updated_at"] = now
            i.setdefault("history", []).append({"state": new_state, "at": now, "by": user})
            if reason:
                i["rejection_reason"] = reason
            _save_all(items)
            log_audit(user, "transition_state", {
                "id": content_id, "from": old_state, "to": new_state, "reason": reason
            })
            return i
    return None


def read_audit_log(limit: int = 100) -> List[Dict]:
    _ensure_data_dir()
    if not os.path.exists(AUDIT_FILE):
        return []
    lines = []
    with open(AUDIT_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                lines.append(json.loads(line))
    return list(reversed(lines))[:limit]
