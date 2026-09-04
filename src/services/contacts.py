"""
Raccolta contatti — versione base per il prototipo (M10).

Copre in forma semplificata:
- RF-10.1 Web app leggera: percorso QR -> pagina -> recapito -> beneficio immediato.
- RF-10.2 Doppia offerta alla stessa colonnina: residente/pendolare vs turista.
- RF-10.3 Consenso raccolto correttamente da subito, separato per canale
  (email, WhatsApp, SMS — RF-1.4).

Persistenza: JSON in `data/contacts.json`.
Il beneficio di benvenuto (RN-63) viene emesso come voucher tramite il
modulo `loyalty`, per non duplicare la logica di emissione/scadenza.
"""
import json
import os
import uuid
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
CONTACTS_FILE = os.path.join(DATA_DIR, "contacts.json")

VISITOR_TYPES = ["residente", "turista"]
CHANNELS = ["email", "whatsapp", "sms"]


def _ensure_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CONTACTS_FILE):
        with open(CONTACTS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load() -> List[Dict]:
    _ensure_file()
    with open(CONTACTS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save(items: List[Dict]):
    _ensure_file()
    with open(CONTACTS_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def register_contact(
    brand: str,
    visitor_type: str,
    full_name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    consents: Optional[Dict[str, bool]] = None,
    source: str = "QR",
) -> Dict:
    """Registra un nuovo contatto raccolto via QR/web app (RF-10.1).

    consents: dizionario per canale, es. {"email": True, "whatsapp": False}.
    Ogni consenso è tracciato con data e provenienza separata (RF-1.4/RF-10.3).
    """
    if visitor_type not in VISITOR_TYPES:
        raise ValueError(f"Tipo visitatore non valido: {visitor_type}")

    contacts = _load()
    now = datetime.datetime.now().isoformat()
    consents = consents or {}

    consent_records = {}
    for channel in CHANNELS:
        granted = bool(consents.get(channel, False))
        consent_records[channel] = {
            "granted": granted,
            "date": now if granted else None,
            "source": source,
        }

    contact = {
        "id": str(uuid.uuid4()),
        "brand": brand,
        "visitor_type": visitor_type,
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "consents": consent_records,
        "source": source,
        "created_at": now,
        "welcome_voucher_code": None,
    }
    contacts.append(contact)
    _save(contacts)
    return contact


def set_welcome_voucher(contact_id: str, voucher_code: str) -> Optional[Dict]:
    """Collega il codice del voucher di benvenuto emesso al contatto (RN-63)."""
    contacts = _load()
    for c in contacts:
        if c["id"] == contact_id:
            c["welcome_voucher_code"] = voucher_code
            _save(contacts)
            return c
    return None


def list_contacts(brand: Optional[str] = None, visitor_type: Optional[str] = None) -> List[Dict]:
    contacts = _load()
    if brand:
        contacts = [c for c in contacts if c["brand"] == brand]
    if visitor_type:
        contacts = [c for c in contacts if c["visitor_type"] == visitor_type]
    return sorted(contacts, key=lambda c: c["created_at"], reverse=True)


def has_consent(contact_id: str, channel: str) -> bool:
    """Verifica il consenso per un canale specifico (blocco a monte, RF-1.4)."""
    contacts = _load()
    for c in contacts:
        if c["id"] == contact_id:
            return c["consents"].get(channel, {}).get("granted", False)
    return False
