"""
Recensioni e reputazione — versione base per il prototipo (M8).

Copre in forma semplificata:
- RF-8.1 Flusso con recensioni in attesa, visibili subito.
- RF-8.2 Negative: bozza di risposta pronta, da approvare/correggere.
- RF-8.3 Positive: risposta breve, approvabile in blocco.
- RF-8.4 Casi gravi: solo segnalazione, nessuna bozza automatica.
- RF-8.5 Nessuna risposta pubblica parte mai in autonomia.
- RF-8.8 Richiesta di recensione dopo la risoluzione (traccia manuale, semplificata).

Classificazione automatica semplice basata su rating + parole chiave
(sostituibile in futuro con un servizio AI reale, stessa interfaccia).

Persistenza: JSON in `data/reviews.json`.
"""
import json
import os
import uuid
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
REVIEWS_FILE = os.path.join(DATA_DIR, "reviews.json")

# Parole chiave che segnalano un caso grave (RF-8.4): problema reale e serio.
SEVERE_KEYWORDS = [
    "avvocato", "denuncia", "intossicazione", "male", "ospedale",
    "furto", "rubato", "aggressione", "discriminazione",
]

REVIEW_STATES = ["nuova", "bozza_pronta", "approvata", "pubblicata", "segnalata"]


def _ensure_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(REVIEWS_FILE):
        with open(REVIEWS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load() -> List[Dict]:
    _ensure_file()
    with open(REVIEWS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save(items: List[Dict]):
    _ensure_file()
    with open(REVIEWS_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def classify_review(rating: int, text: str) -> str:
    """Classifica la recensione: 'positiva', 'negativa' o 'grave' (RF-8.2/8.3/8.4)."""
    text_lower = (text or "").lower()
    if any(kw in text_lower for kw in SEVERE_KEYWORDS):
        return "grave"
    if rating >= 4:
        return "positiva"
    return "negativa"


def _draft_response(brand: str, rating: int, text: str, category: str, author_name: str) -> Optional[str]:
    """Genera una bozza di risposta (stub locale, sostituibile con AI reale).

    Nessuna bozza per i casi gravi (RF-8.4): solo segnalazione.
    """
    if category == "grave":
        return None
    if category == "positiva":
        return (
            f"Grazie mille {author_name}! Siamo felici che l'esperienza con {brand} "
            f"sia stata positiva. A presto!"
        )
    # negativa
    return (
        f"Ciao {author_name}, ci dispiace per l'disagio riscontrato con {brand}. "
        f"Vorremmo capire meglio cosa è successo: puoi contattarci in privato? "
        f"Faremo di tutto per rimediare."
    )


def create_review(
    brand: str, author_name: str, rating: int, text: str, channel: str = "Google"
) -> Dict:
    """Registra una nuova recensione in arrivo e prepara la bozza se applicabile."""
    reviews = _load()
    category = classify_review(rating, text)
    draft = _draft_response(brand, rating, text, category, author_name)
    now = datetime.datetime.now().isoformat()

    review = {
        "id": str(uuid.uuid4()),
        "brand": brand,
        "author_name": author_name,
        "rating": rating,
        "text": text,
        "channel": channel,
        "category": category,  # positiva | negativa | grave
        "state": "bozza_pronta" if draft else "segnalata",
        "draft_response": draft,
        "final_response": None,
        "created_at": now,
        "updated_at": now,
        "follow_up_requested": False,
    }
    reviews.append(review)
    _save(reviews)
    return review


def list_reviews(brand: Optional[str] = None, state: Optional[str] = None) -> List[Dict]:
    reviews = _load()
    if brand:
        reviews = [r for r in reviews if r["brand"] == brand]
    if state:
        reviews = [r for r in reviews if r["state"] == state]
    return sorted(reviews, key=lambda r: r["created_at"], reverse=True)


def approve_and_publish(review_id: str, final_text: str, user: str) -> Optional[Dict]:
    """Approva (con eventuale correzione) e pubblica la risposta (RF-8.5: mai in autonomia)."""
    reviews = _load()
    for r in reviews:
        if r["id"] == review_id:
            r["final_response"] = final_text
            r["state"] = "pubblicata"
            r["updated_at"] = datetime.datetime.now().isoformat()
            r["approved_by"] = user
            _save(reviews)
            return r
    return None


def request_follow_up_review(review_id: str) -> Optional[Dict]:
    """Segna che, dopo la risoluzione, si richiede una recensione (RF-8.8, traccia manuale)."""
    reviews = _load()
    for r in reviews:
        if r["id"] == review_id:
            r["follow_up_requested"] = True
            r["updated_at"] = datetime.datetime.now().isoformat()
            _save(reviews)
            return r
    return None
