"""
Uso quotidiano — estensione per il prototipo (M12).

Copre in forma semplificata:
- RF-12.4 Contenuti ricorrenti: archivio di contenuti che tornano ogni anno
  pressoché identici (chiusure, orari festivi, promemoria stagionali).
- RF-12.5 Finestra di preavviso propria per ogni ricorrenza: la proposta si
  apre quando è il momento di prepararla, non il giorno dell'uscita.
- RF-12.6 Assenza del titolare: dopo alcuni giorni senza approvazioni il
  sistema avvisa; se prosegue, propone di delegare a un sostituto con
  permessi ridotti (contenuti e recensioni sì, promozioni e configurazioni no).

Persistenza: JSON in `data/`.
"""
import json
import os
import uuid
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
RECURRING_FILE = os.path.join(DATA_DIR, "recurring_contents.json")
ACTIVITY_FILE = os.path.join(DATA_DIR, "approval_activity.json")
DELEGATION_FILE = os.path.join(DATA_DIR, "delegation.json")

# Permessi ridotti per un sostituto delegato (RF-12.6): contenuti e recensioni
# sì, promozioni e configurazioni no.
DELEGATE_ALLOWED_PERMISSIONS = {"propose", "view_content", "manage_reviews"}
DELEGATE_DENIED_PERMISSIONS = {"approve_promotions", "manage_admin", "manage_advertising"}

ABSENCE_WARNING_DAYS = 3
ABSENCE_DELEGATION_SUGGESTION_DAYS = 7


def _ensure_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    for path in (RECURRING_FILE, ACTIVITY_FILE, DELEGATION_FILE):
        if not os.path.exists(path):
            with open(path, "w", encoding="utf-8") as f:
                json.dump([], f)


def _load(path) -> List[Dict]:
    _ensure_files()
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save(path, items: List[Dict]):
    _ensure_files()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


# --- Contenuti ricorrenti (RF-12.4, RF-12.5) ---

def register_recurring_content(
    brand: str,
    title: str,
    template_text: str,
    annual_date: str,  # formato "MM-DD"
    notice_window_days: int,
) -> Dict:
    """Registra un contenuto ricorrente con la propria finestra di preavviso."""
    entries = _load(RECURRING_FILE)
    entry = {
        "id": str(uuid.uuid4()),
        "brand": brand,
        "title": title,
        "template_text": template_text,
        "annual_date": annual_date,
        "notice_window_days": notice_window_days,
        "last_confirmed_year": None,
        "created_at": datetime.datetime.now().isoformat(),
    }
    entries.append(entry)
    _save(RECURRING_FILE, entries)
    return entry


def _next_occurrence(annual_date: str, now: datetime.datetime) -> datetime.date:
    month, day = (int(p) for p in annual_date.split("-"))
    candidate = datetime.date(now.year, month, day)
    if candidate < now.date():
        candidate = datetime.date(now.year + 1, month, day)
    return candidate


def list_due_recurring_contents(brand: Optional[str] = None, now: Optional[datetime.datetime] = None) -> List[Dict]:
    """Contenuti ricorrenti la cui finestra di preavviso è già aperta (RF-12.5)."""
    now = now or datetime.datetime.now()
    entries = _load(RECURRING_FILE)
    if brand:
        entries = [e for e in entries if e["brand"] == brand]

    due = []
    for e in entries:
        occurrence = _next_occurrence(e["annual_date"], now)
        days_until = (occurrence - now.date()).days
        if 0 <= days_until <= e["notice_window_days"] and e.get("last_confirmed_year") != occurrence.year:
            due.append({**e, "next_occurrence": occurrence.isoformat(), "days_until": days_until})
    return sorted(due, key=lambda x: x["days_until"])


def confirm_recurring_content(recurring_id: str, year: int) -> Optional[Dict]:
    """Il titolare conferma la riproposizione per l'anno indicato (RF-12.4)."""
    entries = _load(RECURRING_FILE)
    for e in entries:
        if e["id"] == recurring_id:
            e["last_confirmed_year"] = year
            _save(RECURRING_FILE, entries)
            return e
    return None


def list_all_recurring_contents(brand: Optional[str] = None) -> List[Dict]:
    entries = _load(RECURRING_FILE)
    if brand:
        entries = [e for e in entries if e["brand"] == brand]
    return entries


# --- Assenza del titolare e delega (RF-12.6) ---

def record_approval_activity(username: str, at: Optional[datetime.datetime] = None) -> Dict:
    """Registra un'attività di approvazione: azzera il conteggio di assenza."""
    entries = _load(ACTIVITY_FILE)
    entry = {"username": username, "at": (at or datetime.datetime.now()).isoformat()}
    entries.append(entry)
    _save(ACTIVITY_FILE, entries)
    return entry


def days_since_last_approval(username: str, now: Optional[datetime.datetime] = None) -> Optional[int]:
    now = now or datetime.datetime.now()
    entries = [e for e in _load(ACTIVITY_FILE) if e["username"] == username]
    if not entries:
        return None
    last = max(datetime.datetime.fromisoformat(e["at"]) for e in entries)
    return (now - last).days


def get_absence_status(username: str, now: Optional[datetime.datetime] = None) -> Dict:
    """Determina se serve un avviso di assenza o una proposta di delega (RF-12.6)."""
    days = days_since_last_approval(username, now)
    if days is None:
        return {"status": "nessuna_attivita_registrata", "days_absent": None}
    if days >= ABSENCE_DELEGATION_SUGGESTION_DAYS:
        return {"status": "proponi_delega", "days_absent": days}
    if days >= ABSENCE_WARNING_DAYS:
        return {"status": "avviso_assenza", "days_absent": days}
    return {"status": "attivo", "days_absent": days}


def create_delegation(owner_username: str, delegate_username: str) -> Dict:
    """Crea una delega esplicita con permessi ridotti (RF-12.6)."""
    delegations = _load(DELEGATION_FILE)
    entry = {
        "id": str(uuid.uuid4()),
        "owner_username": owner_username,
        "delegate_username": delegate_username,
        "allowed_permissions": sorted(DELEGATE_ALLOWED_PERMISSIONS),
        "denied_permissions": sorted(DELEGATE_DENIED_PERMISSIONS),
        "active": True,
        "created_at": datetime.datetime.now().isoformat(),
        "revoked_at": None,
    }
    delegations.append(entry)
    _save(DELEGATION_FILE, delegations)
    return entry


def revoke_delegation(delegation_id: str) -> Optional[Dict]:
    delegations = _load(DELEGATION_FILE)
    for d in delegations:
        if d["id"] == delegation_id:
            d["active"] = False
            d["revoked_at"] = datetime.datetime.now().isoformat()
            _save(DELEGATION_FILE, delegations)
            return d
    return None


def get_active_delegation(owner_username: str) -> Optional[Dict]:
    for d in _load(DELEGATION_FILE):
        if d["owner_username"] == owner_username and d["active"]:
            return d
    return None


def delegate_has_permission(delegation: Dict, permission: str) -> bool:
    """Un sostituto delegato non ha mai permessi su promozioni/configurazioni,
    indipendentemente da cosa venga richiesto (RF-12.6)."""
    if permission in DELEGATE_DENIED_PERMISSIONS:
        return False
    return permission in delegation.get("allowed_permissions", [])
