"""
Email di assistenza per servizio — versione base per il prototipo (M8b).

Copre in forma semplificata:
- RF-8b.1 Instradamento delle caselle info@/help@ collegabili alla piattaforma:
  domande fattuali semplici (dato oggettivo disponibile: orari, stato,
  disponibilità) → risposta diretta/bozza pronta; tutto il resto → notifica
  al responsabile del servizio competente, mai risposta automatica autonoma.

Classificazione basata su parole chiave semplici (sostituibile in futuro con
un servizio AI reale, stessa interfaccia) — stesso schema di reviews.py.

Persistenza: JSON in `data/service_emails.json`.
"""
import json
import os
import uuid
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
EMAILS_FILE = os.path.join(DATA_DIR, "service_emails.json")

# Parole chiave che indicano una domanda fattuale semplice, con dato oggettivo
# disponibile (orari, stato, disponibilità) — RF-8b.1.
FACTUAL_KEYWORDS = [
    "orari", "orario", "aperto", "chiuso", "disponibilità", "disponibile",
    "quando aprite", "dove siete", "indirizzo", "prezzo", "costo",
]

EMAIL_STATES = ["nuova", "bozza_pronta", "risposta_diretta", "inviata", "notificata"]

# Ogni marchio/servizio ha un responsabile a cui instradare (RU-1a: non un
# calderone unico).
DEFAULT_SERVICE_OWNERS = {
    "Lenny": "responsabile_delivery",
    "Stazione": "responsabile_stazione",
    "Eni Cafè": "responsabile_bar",
    "Officina": "responsabile_officina",
}


def _ensure_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(EMAILS_FILE):
        with open(EMAILS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load() -> List[Dict]:
    _ensure_file()
    with open(EMAILS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save(items: List[Dict]):
    _ensure_file()
    with open(EMAILS_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def classify_email(subject: str, body: str) -> str:
    """Classifica: 'fattuale' (dato oggettivo disponibile) o 'da_instradare'
    (tutto il resto, verso il responsabile competente) — RF-8b.1."""
    text = f"{subject or ''} {body or ''}".lower()
    if any(kw in text for kw in FACTUAL_KEYWORDS):
        return "fattuale"
    return "da_instradare"


def _draft_factual_reply(subject: str, body: str) -> str:
    return (
        "Grazie per averci scritto. In base alla tua richiesta, ecco l'informazione richiesta "
        "(dato oggettivo verificato): [inserire orari/stato/disponibilità pertinenti]. "
        "Per qualsiasi altra necessità restiamo a disposizione."
    )


def register_email(brand: str, sender: str, subject: str, body: str) -> Dict:
    """Registra una email in arrivo su una casella info@/help@ collegata (RF-8b.1)."""
    classification = classify_email(subject, body)
    now = datetime.datetime.now().isoformat()

    entry = {
        "id": str(uuid.uuid4()),
        "brand": brand,
        "sender": sender,
        "subject": subject,
        "body": body,
        "classification": classification,
        "state": "nuova",
        "created_at": now,
        "draft_reply": None,
        "assigned_to": None,
        "resolved_at": None,
    }

    if classification == "fattuale":
        entry["draft_reply"] = _draft_factual_reply(subject, body)
        entry["state"] = "bozza_pronta"
    else:
        entry["assigned_to"] = DEFAULT_SERVICE_OWNERS.get(brand, "responsabile_generico")
        entry["state"] = "notificata"

    emails = _load()
    emails.append(entry)
    _save(emails)
    return entry


def send_reply(email_id: str, final_text: Optional[str] = None) -> Dict:
    """Invio della risposta: mai automatico per le email 'da_instradare' —
    richiede sempre approvazione/redazione umana (RF-8b.1: mai risposta
    automatica autonoma su tutto il resto)."""
    emails = _load()
    for e in emails:
        if e["id"] == email_id:
            if e["classification"] == "da_instradare" and final_text is None:
                raise PermissionError(
                    "Le email instradate al responsabile richiedono una risposta scritta/approvata "
                    "da una persona: nessuna risposta automatica autonoma (RF-8b.1)."
                )
            e["draft_reply"] = final_text or e["draft_reply"]
            e["state"] = "inviata"
            e["resolved_at"] = datetime.datetime.now().isoformat()
            _save(emails)
            return e
    raise ValueError("Email non trovata")


def list_emails(brand: Optional[str] = None, state: Optional[str] = None) -> List[Dict]:
    emails = _load()
    if brand:
        emails = [e for e in emails if e["brand"] == brand]
    if state:
        emails = [e for e in emails if e["state"] == state]
    return sorted(emails, key=lambda e: e["created_at"], reverse=True)


def get_email(email_id: str) -> Optional[Dict]:
    for e in _load():
        if e["id"] == email_id:
            return e
    return None
