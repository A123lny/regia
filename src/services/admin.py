"""
Amministrazione — versione base per il prototipo (M11).

Copre in forma semplificata:
- RF-11.1 Gestione marchi (i marchi diventano configurazione, non codice — RN-15).
- RF-11.4 Pannello autonomia per categoria + interruttore di arresto generale,
  pensato per essere raggiungibile in pochi tocchi.
- RF-11.5 Monitor costi per categoria di spesa, con soglie e allarmi.

Persistenza: JSON in `data/`.
"""
import json
import os
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
BRANDS_FILE = os.path.join(DATA_DIR, "brands.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "admin_settings.json")
COSTS_FILE = os.path.join(DATA_DIR, "costs.json")

DEFAULT_BRANDS = ["Lenny", "Stazione", "Eni Cafè", "Officina"]

# Categorie di autonomia progressiva (semplificato per il prototipo).
AUTONOMY_CATEGORIES = [
    "contenuti_ricorrenti",
    "recensioni_positive",
    "promozioni",
    "advertising",
]

# Categorie di spesa monitorate (RF-11.5).
COST_CATEGORIES = ["ai", "email", "whatsapp", "pubblicazione_social", "advertising"]

DEFAULT_MONTHLY_THRESHOLD = 80.0  # €/mese, coerente con V-4 del capitolato


def _ensure_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(BRANDS_FILE):
        with open(BRANDS_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_BRANDS, f, ensure_ascii=False, indent=2)
    if not os.path.exists(SETTINGS_FILE):
        default_settings = {
            "system_paused": False,
            "autonomy": {cat: False for cat in AUTONOMY_CATEGORIES},
            "cost_thresholds": {cat: DEFAULT_MONTHLY_THRESHOLD for cat in COST_CATEGORIES},
        }
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(default_settings, f, ensure_ascii=False, indent=2)
    if not os.path.exists(COSTS_FILE):
        with open(COSTS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load_json(path, default):
    _ensure_files()
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return default


def _save_json(path, data):
    _ensure_files()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# --- Marchi (RF-11.1) ---

def get_brands() -> List[str]:
    return _load_json(BRANDS_FILE, DEFAULT_BRANDS)


def add_brand(name: str) -> List[str]:
    brands = get_brands()
    if name and name not in brands:
        brands.append(name)
        _save_json(BRANDS_FILE, brands)
    return brands


def remove_brand(name: str) -> List[str]:
    brands = get_brands()
    if name in brands:
        brands.remove(name)
        _save_json(BRANDS_FILE, brands)
    return brands


# --- Autonomia e interruttore di arresto (RF-11.4) ---

def get_settings() -> Dict:
    return _load_json(SETTINGS_FILE, {})


def is_system_paused() -> bool:
    return get_settings().get("system_paused", False)


def set_system_paused(paused: bool) -> Dict:
    settings = get_settings()
    settings["system_paused"] = paused
    _save_json(SETTINGS_FILE, settings)
    return settings


def get_autonomy_settings() -> Dict[str, bool]:
    return get_settings().get("autonomy", {cat: False for cat in AUTONOMY_CATEGORIES})


def set_autonomy(category: str, enabled: bool) -> Dict:
    if category not in AUTONOMY_CATEGORIES:
        raise ValueError(f"Categoria di autonomia non valida: {category}")
    settings = get_settings()
    settings.setdefault("autonomy", {})[category] = enabled
    _save_json(SETTINGS_FILE, settings)
    return settings


# --- Monitor costi (RF-11.5) ---

def get_cost_thresholds() -> Dict[str, float]:
    return get_settings().get(
        "cost_thresholds", {cat: DEFAULT_MONTHLY_THRESHOLD for cat in COST_CATEGORIES}
    )


def set_cost_threshold(category: str, amount: float) -> Dict:
    settings = get_settings()
    settings.setdefault("cost_thresholds", {})[category] = amount
    _save_json(SETTINGS_FILE, settings)
    return settings


def record_cost(category: str, amount: float, note: str = "") -> Dict:
    if category not in COST_CATEGORIES:
        raise ValueError(f"Categoria di costo non valida: {category}")
    costs = _load_json(COSTS_FILE, [])
    entry = {
        "category": category,
        "amount": amount,
        "note": note,
        "at": datetime.datetime.now().isoformat(),
    }
    costs.append(entry)
    _save_json(COSTS_FILE, costs)
    return entry


def get_monthly_costs(year: Optional[int] = None, month: Optional[int] = None) -> Dict[str, float]:
    """Totale costi per categoria nel mese indicato (default: mese corrente)."""
    now = datetime.datetime.now()
    year = year or now.year
    month = month or now.month

    costs = _load_json(COSTS_FILE, [])
    totals = {cat: 0.0 for cat in COST_CATEGORIES}
    for c in costs:
        dt = datetime.datetime.fromisoformat(c["at"])
        if dt.year == year and dt.month == month:
            totals[c["category"]] = totals.get(c["category"], 0.0) + c["amount"]
    return totals


def get_cost_alerts() -> List[Dict]:
    """Ritorna le categorie che hanno superato la soglia mensile (RF-11.5)."""
    totals = get_monthly_costs()
    thresholds = get_cost_thresholds()
    alerts = []
    for category, total in totals.items():
        threshold = thresholds.get(category, DEFAULT_MONTHLY_THRESHOLD)
        if total > threshold:
            alerts.append({"category": category, "total": total, "threshold": threshold})
    return alerts
