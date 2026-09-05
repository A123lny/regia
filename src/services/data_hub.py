"""
Data Hub — versione base per il prototipo (M1).

Copre in forma semplificata (connettori reali verso sistemi esterni non
presenti: qui simuliamo la parte di dominio con persistenza locale):

- RF-1.3 Anagrafica veicolo (targa, modello, chilometri, data ultimo
  intervento, tipo gomme) collegata al contatto — prerequisito dei richiami
  officina.
- RF-1.5 Storico prezzi e costi con data di validità.
- RF-1.7 Deduplicazione contatti e igiene liste: rilevazione duplicati,
  contatti inattivi, recapiti non validi.
- RF-1.8 Segmentazione automatica per recenza, frequenza e valore (pochi
  segmenti robusti).
- RF-1.9 Richieste del cliente sui propri dati personali (esportazione/
  cancellazione): gestione interamente manuale, il sistema si limita a
  presentare l'elenco di ciò che Regìa possiede su quel contatto.

Persistenza: JSON in `data/`.
"""
import json
import os
import re
import uuid
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
VEHICLES_FILE = os.path.join(DATA_DIR, "vehicles.json")
PRICES_FILE = os.path.join(DATA_DIR, "price_history.json")
DATA_REQUESTS_FILE = os.path.join(DATA_DIR, "personal_data_requests.json")

TIRE_TYPES = ["estive", "invernali", "quattro_stagioni"]

# Segmenti robusti e pochi, per recenza/frequenza/valore (RF-1.8).
RFV_SEGMENTS = ["nuovo", "occasionale", "abituale", "top"]

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _ensure_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    for path in (VEHICLES_FILE, PRICES_FILE, DATA_REQUESTS_FILE):
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


# --- Anagrafica veicolo (RF-1.3) ---

def register_vehicle(
    contact: str,
    plate: str,
    model: str,
    mileage_km: int,
    last_service_date: Optional[str] = None,
    tire_type: Optional[str] = None,
) -> Dict:
    """Registra o aggiorna il veicolo collegato a un contatto."""
    if tire_type and tire_type not in TIRE_TYPES:
        raise ValueError(f"Tipo gomme non valido: {tire_type}")

    vehicles = _load(VEHICLES_FILE)
    plate_norm = plate.strip().upper()
    for v in vehicles:
        if v["plate"] == plate_norm:
            v.update({
                "contact": contact,
                "model": model,
                "mileage_km": mileage_km,
                "last_service_date": last_service_date,
                "tire_type": tire_type,
                "updated_at": datetime.datetime.now().isoformat(),
            })
            _save(VEHICLES_FILE, vehicles)
            return v

    entry = {
        "id": str(uuid.uuid4()),
        "contact": contact,
        "plate": plate_norm,
        "model": model,
        "mileage_km": mileage_km,
        "last_service_date": last_service_date,
        "tire_type": tire_type,
        "created_at": datetime.datetime.now().isoformat(),
        "updated_at": datetime.datetime.now().isoformat(),
    }
    vehicles.append(entry)
    _save(VEHICLES_FILE, vehicles)
    return entry


def list_vehicles(contact: Optional[str] = None) -> List[Dict]:
    vehicles = _load(VEHICLES_FILE)
    if contact:
        vehicles = [v for v in vehicles if v["contact"] == contact]
    return vehicles


def get_vehicle_by_plate(plate: str) -> Optional[Dict]:
    plate_norm = plate.strip().upper()
    for v in _load(VEHICLES_FILE):
        if v["plate"] == plate_norm:
            return v
    return None


def vehicles_due_for_reminder(months_since_service: int = 6) -> List[Dict]:
    """Veicoli senza intervento da almeno N mesi: prerequisito dei richiami
    officina ricorrenti (RF-1.3, collegato a §8.3)."""
    now = datetime.datetime.now()
    due = []
    for v in _load(VEHICLES_FILE):
        if not v.get("last_service_date"):
            due.append(v)
            continue
        last = datetime.datetime.fromisoformat(v["last_service_date"])
        months = (now.year - last.year) * 12 + (now.month - last.month)
        if months >= months_since_service:
            due.append(v)
    return due


# --- Storico prezzi (RF-1.5) ---

def record_price(brand: str, item: str, price: float, valid_from: Optional[str] = None) -> Dict:
    """Registra un prezzo con data di validità (es. carburante, servizi)."""
    prices = _load(PRICES_FILE)
    entry = {
        "id": str(uuid.uuid4()),
        "brand": brand,
        "item": item,
        "price": float(price),
        "valid_from": valid_from or datetime.datetime.now().isoformat(),
    }
    prices.append(entry)
    _save(PRICES_FILE, prices)
    return entry


def get_current_price(brand: str, item: str, now: Optional[datetime.datetime] = None) -> Optional[Dict]:
    """Prezzo attualmente in vigore: quello con valid_from più recente non futuro."""
    now = now or datetime.datetime.now()
    candidates = [
        p for p in _load(PRICES_FILE)
        if p["brand"] == brand and p["item"] == item
        and datetime.datetime.fromisoformat(p["valid_from"]) <= now
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p["valid_from"])


def get_price_history(brand: str, item: str) -> List[Dict]:
    entries = [p for p in _load(PRICES_FILE) if p["brand"] == brand and p["item"] == item]
    return sorted(entries, key=lambda p: p["valid_from"], reverse=True)


# --- Deduplicazione e igiene liste (RF-1.7) ---

def _normalize_contact(value: str) -> str:
    return (value or "").strip().lower()


def find_duplicate_contacts(contacts: List[Dict]) -> List[List[Dict]]:
    """Raggruppa contatti con lo stesso recapito normalizzato (email o telefono).

    `contacts` è una lista di dizionari con almeno una chiave 'email' o 'phone'.
    Ritorna solo i gruppi con più di un elemento (duplicati veri).
    """
    groups: Dict[str, List[Dict]] = {}
    for c in contacts:
        key = _normalize_contact(c.get("email") or c.get("phone") or "")
        if not key:
            continue
        groups.setdefault(key, []).append(c)
    return [group for group in groups.values() if len(group) > 1]


def is_valid_email(email: str) -> bool:
    return bool(EMAIL_REGEX.match((email or "").strip()))


def find_invalid_emails(contacts: List[Dict]) -> List[Dict]:
    return [c for c in contacts if c.get("email") and not is_valid_email(c["email"])]


def find_inactive_contacts(contacts: List[Dict], inactive_days: int = 180, now: Optional[datetime.datetime] = None) -> List[Dict]:
    """Contatti senza attività (`last_activity_at`) da più di N giorni."""
    now = now or datetime.datetime.now()
    inactive = []
    for c in contacts:
        last_activity = c.get("last_activity_at")
        if not last_activity:
            inactive.append(c)
            continue
        days = (now - datetime.datetime.fromisoformat(last_activity)).days
        if days >= inactive_days:
            inactive.append(c)
    return inactive


# --- Segmentazione automatica (RF-1.8) ---

def compute_rfv_segment(recency_days: int, frequency: int, value: float) -> str:
    """Segmentazione semplice, pochi segmenti robusti (RF-1.8): 'nuovo',
    'occasionale', 'abituale', 'top'. Logica a soglie, sostituibile in
    futuro con un modello più sofisticato mantenendo la stessa interfaccia.
    """
    if frequency <= 1:
        return "nuovo"
    if value >= 200 and frequency >= 10:
        return "top"
    if frequency >= 4:
        return "abituale"
    return "occasionale"


def segment_contacts(contacts: List[Dict], now: Optional[datetime.datetime] = None) -> Dict[str, List[Dict]]:
    """Applica compute_rfv_segment a una lista di contatti con campi
    'last_order_at', 'order_count', 'total_value'."""
    now = now or datetime.datetime.now()
    result = {seg: [] for seg in RFV_SEGMENTS}
    for c in contacts:
        recency_days = 9999
        if c.get("last_order_at"):
            recency_days = (now - datetime.datetime.fromisoformat(c["last_order_at"])).days
        segment = compute_rfv_segment(
            recency_days=recency_days,
            frequency=c.get("order_count", 0),
            value=c.get("total_value", 0.0),
        )
        result[segment].append(c)
    return result


# --- Richieste dati personali (RF-1.9): gestione manuale, nessuna automazione ---

def create_personal_data_request(contact: str, request_type: str, notes: str = "") -> Dict:
    """Registra una richiesta del cliente sui propri dati (esportazione o
    cancellazione, distinta dalla disiscrizione). Il sistema non genera
    risposte né automatizza l'invio: solo tracciamento manuale."""
    if request_type not in ("esportazione", "cancellazione"):
        raise ValueError("Tipo di richiesta non valido: usare 'esportazione' o 'cancellazione'")

    requests = _load(DATA_REQUESTS_FILE)
    entry = {
        "id": str(uuid.uuid4()),
        "contact": contact,
        "request_type": request_type,
        "notes": notes,
        "state": "in_attesa",
        "created_at": datetime.datetime.now().isoformat(),
        "handled_at": None,
        "handled_by": None,
    }
    requests.append(entry)
    _save(DATA_REQUESTS_FILE, requests)
    return entry


def mark_request_handled(request_id: str, handled_by: str) -> Optional[Dict]:
    """Un operatore umano segna la richiesta come gestita, dopo aver agito
    manualmente (nessuna automazione, RF-1.9)."""
    requests = _load(DATA_REQUESTS_FILE)
    for r in requests:
        if r["id"] == request_id:
            r["state"] = "gestita"
            r["handled_at"] = datetime.datetime.now().isoformat()
            r["handled_by"] = handled_by
            _save(DATA_REQUESTS_FILE, requests)
            return r
    return None


def list_personal_data_requests(state: Optional[str] = None) -> List[Dict]:
    requests = _load(DATA_REQUESTS_FILE)
    if state:
        requests = [r for r in requests if r["state"] == state]
    return sorted(requests, key=lambda r: r["created_at"], reverse=True)


def build_data_dossier(contact: str, consents: List[Dict], vouchers: List[Dict], contact_registrations: List[Dict]) -> Dict:
    """Costruisce l'elenco di ciò che Regìa possiede su un contatto, da
    presentare all'addetto per rispondere a una richiesta RF-1.9. Non
    genera testo di risposta, non decide, non invia nulla."""
    return {
        "contact": contact,
        "vehicles": list_vehicles(contact=contact),
        "consents": [c for c in consents if c.get("contact") == contact],
        "vouchers": [v for v in vouchers if v.get("contact") == contact],
        "web_registrations": [r for r in contact_registrations if r.get("contact") == contact or r.get("email") == contact or r.get("phone") == contact],
    }
