"""
Motore promozionale/fedeltà — versione base per il prototipo (M6).

Copre in forma semplificata:
- RF-6.1 Contatore configurabile per marca (soglia, cosa si conta).
- RF-6.5 Emissione automatica e immediata del voucher al raggiungimento soglia.
- RF-6.6 Scadenza voucher (default 60 giorni).
- RF-6.7 Codice nominale a uso singolo; verifica e riscatto separati e idempotenti.
         Lo stato autoritativo vive qui (Regìa), coerente con il capitolato.

Persistenza: JSON in `data/`, stessa cartella dello storage contenuti.
Non production-ready: manca concorrenza reale multi-processo, DB, ecc.
"""
import json
import os
import uuid
import datetime
import secrets
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
COUNTERS_FILE = os.path.join(DATA_DIR, "counters.json")
VOUCHERS_FILE = os.path.join(DATA_DIR, "vouchers.json")

DEFAULT_EXPIRY_DAYS = 60
VOUCHER_STATES = ["emesso", "riscattato", "scaduto"]


def _ensure_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    for path in (COUNTERS_FILE, VOUCHERS_FILE):
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


def _generate_code() -> str:
    """Codice nominale a uso singolo, leggibile (RF-6.7)."""
    return secrets.token_hex(4).upper()


def get_or_create_counter(contact: str, source_brand: str, threshold: int) -> Dict:
    """Recupera (o crea) il contatore di un contatto su una marca, con soglia data (RF-6.1)."""
    counters = _load(COUNTERS_FILE)
    for c in counters:
        if c["contact"] == contact and c["source_brand"] == source_brand:
            return c
    counter = {
        "id": str(uuid.uuid4()),
        "contact": contact,
        "source_brand": source_brand,
        "threshold": threshold,
        "value": 0,
    }
    counters.append(counter)
    _save(COUNTERS_FILE, counters)
    return counter


def increment_counter(contact: str, source_brand: str, threshold: int, amount: int = 1) -> Dict:
    """Incrementa il contatore. Se raggiunge/supera la soglia, azzera e restituisce flag 'reached'."""
    counters = _load(COUNTERS_FILE)
    counter = None
    for c in counters:
        if c["contact"] == contact and c["source_brand"] == source_brand:
            counter = c
            break
    if counter is None:
        counter = {
            "id": str(uuid.uuid4()),
            "contact": contact,
            "source_brand": source_brand,
            "threshold": threshold,
            "value": 0,
        }
        counters.append(counter)

    counter["threshold"] = threshold  # consente ritaratura soglie (RF-6.21)
    counter["value"] += amount
    reached = counter["value"] >= counter["threshold"]
    if reached:
        counter["value"] = 0  # azzeramento dopo premio (RF-6.1)
    _save(COUNTERS_FILE, counters)
    return {"counter": counter, "reached": reached}


def issue_voucher(
    contact: str,
    source_brand: str,
    target_brand: str,
    category: str,
    value_label: str,
    expiry_days: int = DEFAULT_EXPIRY_DAYS,
) -> Dict:
    """Emissione automatica e immediata di un voucher nominale (RF-6.5)."""
    vouchers = _load(VOUCHERS_FILE)
    now = datetime.datetime.now()
    voucher = {
        "id": str(uuid.uuid4()),
        "code": _generate_code(),
        "contact": contact,
        "source_brand": source_brand,
        "target_brand": target_brand,
        "category": category,
        "value_label": value_label,
        "state": "emesso",
        "issued_at": now.isoformat(),
        "expires_at": (now + datetime.timedelta(days=expiry_days)).isoformat(),
        "redeemed_at": None,
    }
    vouchers.append(voucher)
    _save(VOUCHERS_FILE, vouchers)
    return voucher


def _find_voucher(vouchers: List[Dict], code: str) -> Optional[Dict]:
    for v in vouchers:
        if v["code"] == code.strip().upper():
            return v
    return None


def _is_expired(voucher: Dict) -> bool:
    return datetime.datetime.now() > datetime.datetime.fromisoformat(voucher["expires_at"])


def verify_voucher(code: str) -> Dict:
    """Verifica (non brucia il codice): mostra lo sconto applicabile (RF-6.7)."""
    vouchers = _load(VOUCHERS_FILE)
    voucher = _find_voucher(vouchers, code)
    if voucher is None:
        return {"valid": False, "reason": "Codice non trovato"}
    if voucher["state"] == "riscattato":
        return {"valid": False, "reason": "Codice già utilizzato", "voucher": voucher}
    if voucher["state"] == "scaduto" or _is_expired(voucher):
        return {"valid": False, "reason": "Codice scaduto", "voucher": voucher}
    return {"valid": True, "voucher": voucher}


def redeem_voucher(code: str) -> Dict:
    """Riscatto: transazione atomica e idempotente (RF-6.7).

    Se già riscattato con lo stesso codice, ritorna lo stesso esito senza doppio uso.
    """
    vouchers = _load(VOUCHERS_FILE)
    voucher = _find_voucher(vouchers, code)
    if voucher is None:
        return {"success": False, "reason": "Codice non trovato"}

    if voucher["state"] == "riscattato":
        # Idempotenza: stesso esito, nessun doppio uso
        return {"success": True, "reason": "Già riscattato in precedenza", "voucher": voucher}

    if _is_expired(voucher):
        voucher["state"] = "scaduto"
        _save(VOUCHERS_FILE, vouchers)
        return {"success": False, "reason": "Codice scaduto", "voucher": voucher}

    voucher["state"] = "riscattato"
    voucher["redeemed_at"] = datetime.datetime.now().isoformat()
    _save(VOUCHERS_FILE, vouchers)
    return {"success": True, "reason": "Riscatto completato", "voucher": voucher}


def list_vouchers(contact: Optional[str] = None, brand: Optional[str] = None) -> List[Dict]:
    vouchers = _load(VOUCHERS_FILE)
    if contact:
        vouchers = [v for v in vouchers if v["contact"] == contact]
    if brand:
        vouchers = [v for v in vouchers if v["source_brand"] == brand or v["target_brand"] == brand]
    return sorted(vouchers, key=lambda v: v["issued_at"], reverse=True)


def list_counters(brand: Optional[str] = None) -> List[Dict]:
    counters = _load(COUNTERS_FILE)
    if brand:
        counters = [c for c in counters if c["source_brand"] == brand]
    return counters
