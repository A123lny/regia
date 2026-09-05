"""
Rete ristoranti — versione base per il prototipo (M7).

Copre in forma semplificata:
- RF-7.1 Schede con adesione, andamento ordini, ultimo contatto, segnali di
  raffreddamento (invece di trattare i ristoranti come lista di destinatari).
- RF-7.2 Priorità di contatto: il sistema indica chi contattare questa
  settimana, non manda email di massa.
- RF-7.4 I segnali di raffreddamento hanno priorità sulle attività di
  acquisizione (perdere un ristorante costa più di una promozione).

Persistenza: JSON in `data/restaurants.json`.
"""
import json
import os
import uuid
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
RESTAURANTS_FILE = os.path.join(DATA_DIR, "restaurants.json")

# Se non ci sono ordini da questi giorni, il ristorante è "in raffreddamento" (RF-7.4).
COOLING_THRESHOLD_DAYS = 14


def _ensure_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(RESTAURANTS_FILE):
        with open(RESTAURANTS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load() -> List[Dict]:
    _ensure_file()
    with open(RESTAURANTS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save(items: List[Dict]):
    _ensure_file()
    with open(RESTAURANTS_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def register_restaurant(name: str, category: str, joined_since: Optional[str] = None) -> Dict:
    """Aggiunge un nuovo ristorante alla rete (RF-7.1)."""
    restaurants = _load()
    now = datetime.datetime.now().isoformat()
    restaurant = {
        "id": str(uuid.uuid4()),
        "name": name,
        "category": category,
        "joined_since": joined_since or now,
        "orders": [],  # lista di timestamp ordini, per calcolare andamento
        "last_contact_at": None,
        "notes": [],
    }
    restaurants.append(restaurant)
    _save(restaurants)
    return restaurant


def record_order(restaurant_id: str) -> Optional[Dict]:
    """Registra un ordine ricevuto (per misurare l'andamento, RF-7.1)."""
    restaurants = _load()
    for r in restaurants:
        if r["id"] == restaurant_id:
            r["orders"].append(datetime.datetime.now().isoformat())
            _save(restaurants)
            return r
    return None


def record_contact(restaurant_id: str, note: str = "") -> Optional[Dict]:
    """Registra un contatto avvenuto col ristoratore (aggiorna ultimo contatto, RF-7.1)."""
    restaurants = _load()
    now = datetime.datetime.now().isoformat()
    for r in restaurants:
        if r["id"] == restaurant_id:
            r["last_contact_at"] = now
            if note:
                r["notes"].append({"at": now, "text": note})
            _save(restaurants)
            return r
    return None


def _days_since(iso_date: Optional[str]) -> Optional[int]:
    if not iso_date:
        return None
    delta = datetime.datetime.now() - datetime.datetime.fromisoformat(iso_date)
    return delta.days


def is_cooling(restaurant: Dict) -> bool:
    """Segnale di raffreddamento: nessun ordine recente (RF-7.4)."""
    if not restaurant["orders"]:
        return True
    last_order = max(restaurant["orders"])
    days = _days_since(last_order)
    return days is not None and days >= COOLING_THRESHOLD_DAYS


def orders_last_30_days(restaurant: Dict) -> int:
    cutoff = datetime.datetime.now() - datetime.timedelta(days=30)
    return len([o for o in restaurant["orders"] if datetime.datetime.fromisoformat(o) >= cutoff])


def contact_priority_score(restaurant: Dict) -> int:
    """Punteggio di priorità di contatto: più alto = da contattare prima (RF-7.2).

    I segnali di raffreddamento pesano più di tutto (RF-7.4).
    """
    score = 0
    if is_cooling(restaurant):
        score += 100

    days_since_contact = _days_since(restaurant["last_contact_at"])
    if days_since_contact is None:
        score += 50  # mai contattato
    else:
        score += min(days_since_contact, 60)  # più tempo è passato, più priorità

    if orders_last_30_days(restaurant) == 0:
        score += 30

    return score


def list_restaurants_by_priority() -> List[Dict]:
    """Ritorna i ristoranti ordinati per priorità di contatto decrescente (RF-7.2)."""
    restaurants = _load()
    enriched = []
    for r in restaurants:
        enriched.append({
            **r,
            "cooling": is_cooling(r),
            "orders_30d": orders_last_30_days(r),
            "priority_score": contact_priority_score(r),
        })
    return sorted(enriched, key=lambda r: r["priority_score"], reverse=True)


def get_restaurant(restaurant_id: str) -> Optional[Dict]:
    for r in _load():
        if r["id"] == restaurant_id:
            return r
    return None
