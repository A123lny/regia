"""
Marchi e identità — estensione per il prototipo (M2).

Copre in forma semplificata:
- RF-2.2 Brand kit per marchio: logo (riferimento sostituibile), colori, font.
- RF-2.3 Tono di voce per marchio, contesto obbligatorio in ogni generazione.
- RF-2.3a Contesto strategico esplicito per marchio (scopo, pubblico, obiettivo
  dell'anno, direzione futura), obbligatorio al pari del tono.
- RF-2.4 Rubriche e pilastri per marchio, con pesi di frequenza.
- RF-2.5 Vincoli redazionali: claim vietati, argomenti sempre da revisione
  umana, parole bandite.

Persistenza: JSON in `data/brand_identity.json`, una voce per marchio.
"""
import json
import os
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
IDENTITY_FILE = os.path.join(DATA_DIR, "brand_identity.json")


def _default_identity(brand: str) -> Dict:
    return {
        "brand": brand,
        "logo_ref": "",
        "colors": ["#1E2A38", "#FF6B35"],
        "font": "Segoe UI",
        "tone_of_voice": "",
        "strategic_context": {
            "purpose_audience": "",
            "year_goal": "",
            "future_direction": "",
        },
        "pillars": [],  # lista di {"name": str, "weight": int}
        "forbidden_claims": [],
        "forbidden_words": [],
        "always_review_topics": [],
    }


def _ensure_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(IDENTITY_FILE):
        with open(IDENTITY_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f)


def _load() -> Dict[str, Dict]:
    _ensure_file()
    with open(IDENTITY_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}


def _save(data: Dict[str, Dict]):
    _ensure_file()
    with open(IDENTITY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_identity(brand: str) -> Dict:
    """Ritorna il brand kit del marchio, creandolo con valori vuoti se assente."""
    data = _load()
    if brand not in data:
        data[brand] = _default_identity(brand)
        _save(data)
    return data[brand]


def update_identity(brand: str, **fields) -> Dict:
    """Aggiorna in modo incrementale i campi del brand kit (RF-2.2, RF-2.3, RF-2.3a)."""
    data = _load()
    identity = data.get(brand, _default_identity(brand))
    for key, value in fields.items():
        if key == "strategic_context" and isinstance(value, dict):
            identity["strategic_context"].update(value)
        else:
            identity[key] = value
    data[brand] = identity
    _save(data)
    return identity


def add_pillar(brand: str, name: str, weight: int = 1) -> Dict:
    """Aggiunge una rubrica/pilastro con peso di frequenza (RF-2.4)."""
    identity = get_identity(brand)
    identity["pillars"].append({"name": name, "weight": weight})
    return update_identity(brand, pillars=identity["pillars"])


def remove_pillar(brand: str, name: str) -> Dict:
    identity = get_identity(brand)
    identity["pillars"] = [p for p in identity["pillars"] if p["name"] != name]
    return update_identity(brand, pillars=identity["pillars"])


def add_forbidden_word(brand: str, word: str) -> Dict:
    identity = get_identity(brand)
    word = word.strip().lower()
    if word and word not in identity["forbidden_words"]:
        identity["forbidden_words"].append(word)
    return update_identity(brand, forbidden_words=identity["forbidden_words"])


def check_text_against_constraints(brand: str, text: str) -> Dict:
    """Verifica un testo contro i vincoli redazionali del marchio (RF-2.5).

    Ritorna un dizionario con le parole bandite trovate e se serve
    revisione umana obbligatoria per argomento sensibile.
    """
    identity = get_identity(brand)
    text_lower = (text or "").lower()

    found_forbidden_words = [w for w in identity["forbidden_words"] if w in text_lower]
    needs_review_topics = [t for t in identity["always_review_topics"] if t.lower() in text_lower]

    return {
        "brand": brand,
        "forbidden_words_found": found_forbidden_words,
        "requires_human_review": bool(found_forbidden_words or needs_review_topics),
        "review_topics_matched": needs_review_topics,
    }


def get_generation_context(brand: str) -> str:
    """Costruisce il contesto obbligatorio (tono + contesto strategico) da
    includere in ogni generazione per il marchio (RF-2.3, RF-2.3a)."""
    identity = get_identity(brand)
    ctx = identity["strategic_context"]
    parts = [
        f"Marchio: {brand}",
        f"Tono di voce: {identity['tone_of_voice'] or 'non ancora definito'}",
        f"Scopo e pubblico: {ctx['purpose_audience'] or 'non ancora definito'}",
        f"Obiettivo dell'anno: {ctx['year_goal'] or 'non ancora definito'}",
        f"Direzione futura: {ctx['future_direction'] or 'non ancora definita'}",
    ]
    return "\n".join(parts)


def list_all_identities() -> List[Dict]:
    return list(_load().values())
