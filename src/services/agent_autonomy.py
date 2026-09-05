"""
Agente AI — motore di autonomia progressiva (§8 del capitolato).

Copre in forma semplificata:
- RA-8.1 Stato iniziale: tutte le categorie a L1 (nulla parte senza approvazione).
- §8.1 Livelli: L0 solo suggerimento, L1 nulla parte senza approvazione,
  L2 esegue entro i limiti e notifica (annullabile), L3 esegue senza finestra
  di annullamento (solo categorie a rischio minimo).
- §8.2 Categorie sempre manuali (mai autonome, per sempre), indipendentemente
  dal livello: non promuovibili in nessun caso.
- RA-8.3 Conteggio delle proposte approvate senza modifiche: a 9/10 propone
  (non applica da sé) il passaggio di livello; se dopo il passaggio riprendono
  le correzioni, propone il ritorno indietro.
- RA-8.4 Limite di pressione commerciale: max N messaggi commerciali/mese
  per persona (non per marchio), sommando tutte le aziende. Gli avvisi di
  servizio sono fuori conteggio.
- RA-8.6 "Il modello propone, il codice dispone": ogni azione passa da
  can_execute_autonomously(), che verifica categoria + livello + limiti,
  indipendentemente da cosa "suggerisce" il modello.

Persistenza: JSON in `data/`.
"""
import json
import os
import uuid
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
AUTONOMY_LEVELS_FILE = os.path.join(DATA_DIR, "agent_autonomy_levels.json")
DECISIONS_FILE = os.path.join(DATA_DIR, "agent_decisions.json")
PRESSURE_FILE = os.path.join(DATA_DIR, "agent_commercial_pressure.json")

LEVELS = ["L0", "L1", "L2", "L3"]

# §8.2 — mai autonome, per sempre, a prescindere dal livello raggiunto.
NEVER_AUTONOMOUS_CATEGORIES = {
    "lancio_promozioni",
    "comunicazioni_partner_eni",
    "primo_contatto_nuovo_pubblico",
    "risposta_pubblica_lamentela",
    "comunicazioni_incidenti_disservizi",
    "modifica_prezzi",
    "attivazione_modifica_campagna_a_pagamento",
    "spesa_oltre_tetto",
}

# §8.3 — categorie candidate all'autonomia progressiva (esempio, configurabile).
PROGRESSIVE_CATEGORIES = [
    "avvisi_servizio_ricorrenti",
    "richiami_officina",
    "promemoria_voucher",
    "pubblicazione_contenuti_approvati",
    "report",
    "generazione_media",
]

PROMOTION_THRESHOLD_RATIO = 0.9  # 9 su 10 (RA-8.3)
PROMOTION_MIN_SAMPLES = 10

MAX_COMMERCIAL_MESSAGES_PER_MONTH = 2  # RA-8.4, per persona, tutte le aziende sommate


def _ensure_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(AUTONOMY_LEVELS_FILE):
        default_levels = {cat: "L1" for cat in PROGRESSIVE_CATEGORIES}
        with open(AUTONOMY_LEVELS_FILE, "w", encoding="utf-8") as f:
            json.dump(default_levels, f, ensure_ascii=False, indent=2)
    if not os.path.exists(DECISIONS_FILE):
        with open(DECISIONS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
    if not os.path.exists(PRESSURE_FILE):
        with open(PRESSURE_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


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


# --- Livelli di autonomia (RA-8.1, §8.1) ---

def get_autonomy_level(category: str) -> str:
    """Ritorna il livello per una categoria. Le categorie mai autonome
    restano sempre a 'manuale', indipendentemente da ogni configurazione."""
    if category in NEVER_AUTONOMOUS_CATEGORIES:
        return "manuale"
    levels = _load(AUTONOMY_LEVELS_FILE, {})
    return levels.get(category, "L1")


def set_autonomy_level(category: str, level: str) -> Dict:
    """Imposta esplicitamente il livello di una categoria. Non applicabile
    alle categorie mai autonome (§8.2): sollevano errore."""
    if category in NEVER_AUTONOMOUS_CATEGORIES:
        raise PermissionError(f"La categoria '{category}' è sempre manuale (§8.2): livello non modificabile.")
    if level not in LEVELS:
        raise ValueError(f"Livello non valido: {level}")
    levels = _load(AUTONOMY_LEVELS_FILE, {})
    levels[category] = level
    _save(AUTONOMY_LEVELS_FILE, levels)
    return {"category": category, "level": level}


def list_autonomy_levels() -> Dict[str, str]:
    levels = _load(AUTONOMY_LEVELS_FILE, {})
    result = {cat: levels.get(cat, "L1") for cat in PROGRESSIVE_CATEGORIES}
    result.update({cat: "manuale" for cat in NEVER_AUTONOMOUS_CATEGORIES})
    return result


def can_execute_autonomously(category: str) -> bool:
    """RA-8.6: 'il modello propone, il codice dispone'. Vera fonte di verità
    per decidere se un'azione può eseguire senza approvazione preventiva."""
    level = get_autonomy_level(category)
    return level in ("L2", "L3")


def requires_undo_window(category: str) -> bool:
    """L2 è annullabile entro una finestra, L3 no (§8.1)."""
    return get_autonomy_level(category) == "L2"


# --- Tracciamento decisioni per la promozione progressiva (RA-8.3) ---

def record_decision(category: str, approved_without_changes: bool) -> Dict:
    """Registra l'esito di una proposta dell'agente per una categoria
    (approvata senza modifiche oppure corretta/rifiutata dal titolare)."""
    decisions = _load(DECISIONS_FILE, [])
    entry = {
        "id": str(uuid.uuid4()),
        "category": category,
        "approved_without_changes": bool(approved_without_changes),
        "at": datetime.datetime.now().isoformat(),
    }
    decisions.append(entry)
    _save(DECISIONS_FILE, decisions)
    return entry


def get_promotion_suggestion(category: str, window: int = PROMOTION_MIN_SAMPLES) -> Dict:
    """Calcola se conviene PROPORRE un passaggio di livello (mai applicarlo
    da sé): guarda le ultime `window` decisioni per la categoria.

    - Se >= 90% approvate senza modifiche → propone di salire di livello.
    - Se il livello è già L2/L3 e tornano molte correzioni → propone di
      tornare indietro.
    """
    if category in NEVER_AUTONOMOUS_CATEGORIES:
        return {"suggestion": None, "reason": "Categoria sempre manuale (§8.2)"}

    decisions = [d for d in _load(DECISIONS_FILE, []) if d["category"] == category]
    recent = decisions[-window:]
    current_level = get_autonomy_level(category)

    if len(recent) < window:
        return {"suggestion": None, "reason": f"Servono almeno {window} decisioni (ce ne sono {len(recent)})"}

    approved_ratio = sum(1 for d in recent if d["approved_without_changes"]) / len(recent)

    if approved_ratio >= PROMOTION_THRESHOLD_RATIO and current_level != "L3":
        next_level = "L2" if current_level == "L1" else "L3"
        return {
            "suggestion": "promuovi",
            "from_level": current_level,
            "to_level": next_level,
            "approved_ratio": approved_ratio,
        }

    if approved_ratio < 0.5 and current_level in ("L2", "L3"):
        prev_level = "L1" if current_level == "L2" else "L2"
        return {
            "suggestion": "retrocedi",
            "from_level": current_level,
            "to_level": prev_level,
            "approved_ratio": approved_ratio,
        }

    return {"suggestion": None, "reason": "Nessun cambio consigliato", "approved_ratio": approved_ratio}


def apply_level_change(category: str, new_level: str) -> Dict:
    """Applica un cambio di livello — sempre su decisione esplicita del
    titolare, mai in automatico (coerente con RA-8.3: 'la decisione resta manuale')."""
    return set_autonomy_level(category, new_level)


# --- Pressione commerciale (RA-8.4): max N messaggi/mese per persona, tutte le aziende ---

def record_commercial_message(contact: str) -> Dict:
    """Registra l'invio di un messaggio commerciale (non di servizio) verso
    un contatto. Da chiamare solo per invii effettivamente commerciali."""
    entries = _load(PRESSURE_FILE, [])
    entry = {
        "id": str(uuid.uuid4()),
        "contact": contact,
        "at": datetime.datetime.now().isoformat(),
    }
    entries.append(entry)
    _save(PRESSURE_FILE, entries)
    return entry


def get_month_to_date_commercial_count(contact: str, now: Optional[datetime.datetime] = None) -> int:
    now = now or datetime.datetime.now()
    month_prefix = now.strftime("%Y-%m")
    entries = _load(PRESSURE_FILE, [])
    return sum(1 for e in entries if e["contact"] == contact and e["at"].startswith(month_prefix))


def can_send_commercial_message(contact: str) -> bool:
    """RA-8.4: limite calcolato per persona, sommando tutte le aziende
    (i messaggi di servizio non passano da qui e non contano)."""
    return get_month_to_date_commercial_count(contact) < MAX_COMMERCIAL_MESSAGES_PER_MONTH
