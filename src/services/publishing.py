"""
Publishing — versione base per il prototipo (M5).

Copre in forma semplificata:
- RF-5.1 Architettura ad adapter: interfaccia comune per ogni canale
  (pubblica, programma, annulla, stato, metriche).
- RF-5.2 Canali: Facebook, Instagram, Email, WhatsApp, SMS, Google.
- RF-5.5 Coda con ritentativi, idempotenza (nessun doppio invio),
  stato per singola pubblicazione.
- RF-5.5a Regola di canale: WhatsApp riservato a comunicazioni ad alto valore
  (voucher, richiami, avvisi), non promozioni generiche.
- RF-5.6 Fasce orarie configurabili (es. mai WhatsApp prima delle 9 o dopo le 21).
- RF-5.7 Log di pubblicazione immutabile con snapshot del contenuto pubblicato.

Persistenza: JSON in `data/`. Adapter di invio reale non presenti: il "send"
è simulato (nessuna vera chiamata a servizi esterni), coerente col prototipo.
"""
import json
import os
import uuid
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
QUEUE_FILE = os.path.join(DATA_DIR, "publishing_queue.json")
LOG_FILE = os.path.join(DATA_DIR, "publishing_log.jsonl")

CHANNELS = ["Facebook", "Instagram", "Email", "WhatsApp", "SMS", "Google"]

STATES = ["in_coda", "inviato", "fallito", "annullato"]
MAX_ATTEMPTS = 3

# RF-5.5a: canali riservati a comunicazioni ad alto valore per il cliente.
HIGH_VALUE_ONLY_CHANNELS = {"WhatsApp"}
HIGH_VALUE_CATEGORIES = {"voucher", "richiamo_officina", "avviso_importante"}

# RF-5.6: fasce orarie consentite per canale (ora inizio, ora fine, incluse).
CHANNEL_TIME_WINDOWS = {
    "WhatsApp": (9, 21),
}


def _ensure_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(QUEUE_FILE):
        with open(QUEUE_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
    if not os.path.exists(LOG_FILE):
        open(LOG_FILE, "w", encoding="utf-8").close()


def _load_queue() -> List[Dict]:
    _ensure_files()
    with open(QUEUE_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save_queue(items: List[Dict]):
    _ensure_files()
    with open(QUEUE_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def _append_log(entry: Dict):
    _ensure_files()
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def is_within_allowed_window(channel: str, when: Optional[datetime.datetime] = None) -> bool:
    """Verifica la fascia oraria consentita per il canale (RF-5.6)."""
    window = CHANNEL_TIME_WINDOWS.get(channel)
    if window is None:
        return True
    when = when or datetime.datetime.now()
    start_hour, end_hour = window
    return start_hour <= when.hour < end_hour


def is_channel_allowed_for_category(channel: str, category: Optional[str]) -> bool:
    """Applica la regola di canale RF-5.5a: WhatsApp solo per categorie ad alto valore."""
    if channel not in HIGH_VALUE_ONLY_CHANNELS:
        return True
    return category in HIGH_VALUE_CATEGORIES


def schedule_publication(
    content_id: str,
    brand: str,
    channel: str,
    snapshot: str,
    scheduled_at: Optional[str] = None,
    category: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Dict:
    """Programma una pubblicazione in coda (RF-5.1, RF-5.5).

    Se `idempotency_key` corrisponde a una pubblicazione già presente e non
    annullata/fallita definitivamente, ritorna quella esistente invece di
    crearne una nuova (nessun doppio invio).
    """
    if channel not in CHANNELS:
        raise ValueError(f"Canale non supportato: {channel}")

    queue = _load_queue()

    if idempotency_key:
        for item in queue:
            if item.get("idempotency_key") == idempotency_key and item["state"] in ("in_coda", "inviato"):
                return item

    if not is_channel_allowed_for_category(channel, category):
        raise ValueError(
            f"Il canale {channel} è riservato a comunicazioni ad alto valore "
            f"(voucher, richiami, avvisi) — categoria '{category}' non ammessa (RF-5.5a)."
        )

    entry = {
        "id": str(uuid.uuid4()),
        "content_id": content_id,
        "brand": brand,
        "channel": channel,
        "category": category,
        "snapshot": snapshot,
        "state": "in_coda",
        "attempts": 0,
        "scheduled_at": scheduled_at or datetime.datetime.now().isoformat(),
        "created_at": datetime.datetime.now().isoformat(),
        "sent_at": None,
        "last_error": None,
        "idempotency_key": idempotency_key,
    }
    queue.append(entry)
    _save_queue(queue)
    return entry


def cancel_publication(pub_id: str) -> Optional[Dict]:
    """Annulla una pubblicazione ancora in coda (RF-5.1)."""
    queue = _load_queue()
    for item in queue:
        if item["id"] == pub_id:
            if item["state"] == "in_coda":
                item["state"] = "annullato"
                _save_queue(queue)
            return item
    return None


def get_status(pub_id: str) -> Optional[Dict]:
    for item in _load_queue():
        if item["id"] == pub_id:
            return item
    return None


def list_queue(brand: Optional[str] = None, channel: Optional[str] = None, state: Optional[str] = None) -> List[Dict]:
    items = _load_queue()
    if brand:
        items = [i for i in items if i["brand"] == brand]
    if channel:
        items = [i for i in items if i["channel"] == channel]
    if state:
        items = [i for i in items if i["state"] == state]
    return sorted(items, key=lambda i: i["created_at"], reverse=True)


def process_publication(pub_id: str, force_fail: bool = False) -> Dict:
    """Simula il tentativo di invio di una pubblicazione in coda (RF-5.5).

    Idempotente: se già inviata, ritorna lo stesso esito senza rifare l'invio.
    Rispetta la fascia oraria del canale (RF-5.6): se fuori fascia, resta in coda.
    Dopo MAX_ATTEMPTS fallimenti consecutivi, passa in stato definitivo 'fallito'.
    """
    queue = _load_queue()
    item = None
    for i in queue:
        if i["id"] == pub_id:
            item = i
            break
    if item is None:
        return {"success": False, "reason": "Pubblicazione non trovata"}

    if item["state"] == "inviato":
        return {"success": True, "reason": "Già inviata in precedenza (idempotente)", "publication": item}

    if item["state"] in ("annullato", "fallito"):
        return {"success": False, "reason": f"Stato non processabile: {item['state']}", "publication": item}

    if not is_within_allowed_window(item["channel"]):
        return {"success": False, "reason": "Fuori fascia oraria consentita per il canale (RF-5.6)", "publication": item}

    item["attempts"] += 1

    if force_fail or item["attempts"] > MAX_ATTEMPTS:
        item["state"] = "fallito"
        item["last_error"] = "Fallimento simulato" if force_fail else "Numero massimo di tentativi raggiunto"
        _save_queue(queue)
        _append_log({
            "event": "publish_failed",
            "publication_id": item["id"],
            "brand": item["brand"],
            "channel": item["channel"],
            "content_id": item["content_id"],
            "at": datetime.datetime.now().isoformat(),
        })
        return {"success": False, "reason": item["last_error"], "publication": item}

    item["state"] = "inviato"
    item["sent_at"] = datetime.datetime.now().isoformat()
    _save_queue(queue)
    _append_log({
        "event": "published",
        "publication_id": item["id"],
        "brand": item["brand"],
        "channel": item["channel"],
        "content_id": item["content_id"],
        "snapshot": item["snapshot"],
        "at": item["sent_at"],
    })
    return {"success": True, "reason": "Pubblicato con successo", "publication": item}


def read_publication_log(limit: int = 100) -> List[Dict]:
    """Log di pubblicazione immutabile, con snapshot del contenuto (RF-5.7)."""
    _ensure_files()
    entries = []
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return list(reversed(entries))[:limit]
