"""
Advertising e presenza a pagamento — versione base per il prototipo (M13).

Copre in forma semplificata:
- RF-13.1 Tetti di spesa mensili configurabili per marchio e categoria.
- RF-13.2 Interruttori acceso/spento per marchio e categoria: **tutti spenti
  di default**, accensione sempre esplicita del titolare (RA-8.1).
- RF-13.4 Classificazione per contenuto: solo organico · spinto entro budget ·
  candidato a spinta maggiore (richiede approvazione esplicita).
- RF-13.6 Superamento tetto mai automatico: richiesta di sforamento con
  motivazione, approvazione/rifiuto esplicito del titolare.

Persistenza: JSON in `data/`.
"""
import json
import os
import uuid
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
SWITCHES_FILE = os.path.join(DATA_DIR, "ad_switches.json")
BUDGETS_FILE = os.path.join(DATA_DIR, "ad_budgets.json")
SPEND_FILE = os.path.join(DATA_DIR, "ad_spend.json")
CLASSIFICATIONS_FILE = os.path.join(DATA_DIR, "ad_classifications.json")
OVERSHOOT_FILE = os.path.join(DATA_DIR, "ad_overshoot_requests.json")

CATEGORIES = ["sponsorizzate_social", "google_ads_ricerca", "google_ads_display"]

CLASSIFICATIONS = ["solo_organico", "spinto_entro_budget", "candidato_spinta_maggiore"]

DEFAULT_BUDGET = 0.0


def _ensure_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    for path in (SWITCHES_FILE, BUDGETS_FILE, SPEND_FILE, CLASSIFICATIONS_FILE, OVERSHOOT_FILE):
        if not os.path.exists(path):
            with open(path, "w", encoding="utf-8") as f:
                json.dump({} if path in (SWITCHES_FILE, BUDGETS_FILE) else [], f)


def _load(path, default):
    _ensure_files()
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return default


def _save(path, data):
    _ensure_files()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _key(brand: str, category: str) -> str:
    return f"{brand}::{category}"


# --- Interruttori (RF-13.2): tutti spenti di default, sempre espliciti ---

def is_switch_on(brand: str, category: str) -> bool:
    switches = _load(SWITCHES_FILE, {})
    return switches.get(_key(brand, category), False)


def set_switch(brand: str, category: str, enabled: bool) -> Dict:
    """Accende/spegne esplicitamente un interruttore. Nessun default suggerito."""
    if category not in CATEGORIES:
        raise ValueError(f"Categoria advertising non valida: {category}")
    switches = _load(SWITCHES_FILE, {})
    switches[_key(brand, category)] = bool(enabled)
    _save(SWITCHES_FILE, switches)
    return {"brand": brand, "category": category, "enabled": bool(enabled)}


def list_switches(brand: str) -> Dict[str, bool]:
    switches = _load(SWITCHES_FILE, {})
    return {cat: switches.get(_key(brand, cat), False) for cat in CATEGORIES}


# --- Tetti di spesa (RF-13.1) ---

def set_budget_cap(brand: str, category: str, monthly_cap: float) -> Dict:
    if category not in CATEGORIES:
        raise ValueError(f"Categoria advertising non valida: {category}")
    budgets = _load(BUDGETS_FILE, {})
    budgets[_key(brand, category)] = float(monthly_cap)
    _save(BUDGETS_FILE, budgets)
    return {"brand": brand, "category": category, "monthly_cap": float(monthly_cap)}


def get_budget_cap(brand: str, category: str) -> float:
    budgets = _load(BUDGETS_FILE, {})
    return budgets.get(_key(brand, category), DEFAULT_BUDGET)


def list_budget_caps(brand: str) -> Dict[str, float]:
    budgets = _load(BUDGETS_FILE, {})
    return {cat: budgets.get(_key(brand, cat), DEFAULT_BUDGET) for cat in CATEGORIES}


# --- Spesa registrata (per il monitor costi) ---

def record_spend(brand: str, category: str, amount: float) -> Dict:
    """Registra una spesa: consentita solo se l'interruttore è acceso e non
    supera il tetto configurato (a meno di sforamento approvato — RF-13.6)."""
    if not is_switch_on(brand, category):
        raise PermissionError(
            f"Interruttore spento per {brand}/{category}: nessuna spesa può partire (RF-13.2)."
        )

    spent_so_far = get_month_to_date_spend(brand, category)
    cap = get_budget_cap(brand, category)
    if spent_so_far + amount > cap:
        raise PermissionError(
            f"La spesa supererebbe il tetto configurato ({cap}€) per {brand}/{category}. "
            f"Serve una richiesta di sforamento esplicita (RF-13.6)."
        )

    spend = _load(SPEND_FILE, [])
    entry = {
        "id": str(uuid.uuid4()),
        "brand": brand,
        "category": category,
        "amount": float(amount),
        "at": datetime.datetime.now().isoformat(),
    }
    spend.append(entry)
    _save(SPEND_FILE, spend)
    return entry


def get_month_to_date_spend(brand: str, category: str, now: Optional[datetime.datetime] = None) -> float:
    now = now or datetime.datetime.now()
    month_prefix = now.strftime("%Y-%m")
    spend = _load(SPEND_FILE, [])
    return sum(
        e["amount"] for e in spend
        if e["brand"] == brand and e["category"] == category and e["at"].startswith(month_prefix)
    )


# --- Classificazione contenuti (RF-13.4) ---

def classify_content(content_id: str, brand: str, classification: str, estimated_spend: float = 0.0) -> Dict:
    if classification not in CLASSIFICATIONS:
        raise ValueError(f"Classificazione non valida: {classification}")
    entries = _load(CLASSIFICATIONS_FILE, [])
    entries = [e for e in entries if e["content_id"] != content_id]
    entry = {
        "content_id": content_id,
        "brand": brand,
        "classification": classification,
        "estimated_spend": float(estimated_spend),
        "classified_at": datetime.datetime.now().isoformat(),
    }
    entries.append(entry)
    _save(CLASSIFICATIONS_FILE, entries)
    return entry


def get_classification(content_id: str) -> Optional[Dict]:
    for e in _load(CLASSIFICATIONS_FILE, []):
        if e["content_id"] == content_id:
            return e
    return None


# --- Sforamento tetto — mai automatico (RF-13.6) ---

def request_overshoot(brand: str, category: str, requested_amount: float, reason: str) -> Dict:
    """Richiesta di sforamento del tetto, con motivazione. Resta in attesa
    di approvazione esplicita del titolare — non parte mai da sola."""
    requests = _load(OVERSHOOT_FILE, [])
    entry = {
        "id": str(uuid.uuid4()),
        "brand": brand,
        "category": category,
        "requested_amount": float(requested_amount),
        "reason": reason,
        "state": "in_attesa",
        "created_at": datetime.datetime.now().isoformat(),
        "decided_at": None,
    }
    requests.append(entry)
    _save(OVERSHOOT_FILE, requests)
    return entry


def decide_overshoot(request_id: str, approve: bool) -> Optional[Dict]:
    requests = _load(OVERSHOOT_FILE, [])
    for r in requests:
        if r["id"] == request_id:
            if r["state"] != "in_attesa":
                return r
            r["state"] = "approvato" if approve else "rifiutato"
            r["decided_at"] = datetime.datetime.now().isoformat()
            if approve:
                current_cap = get_budget_cap(r["brand"], r["category"])
                set_budget_cap(r["brand"], r["category"], current_cap + r["requested_amount"])
            _save(OVERSHOOT_FILE, requests)
            return r
    return None


def list_overshoot_requests(brand: Optional[str] = None, state: Optional[str] = None) -> List[Dict]:
    requests = _load(OVERSHOOT_FILE, [])
    if brand:
        requests = [r for r in requests if r["brand"] == brand]
    if state:
        requests = [r for r in requests if r["state"] == state]
    return sorted(requests, key=lambda r: r["created_at"], reverse=True)
