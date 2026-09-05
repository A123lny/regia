"""
Template grafici di marca — estensione per il prototipo (M4, RF-4.2).

Copre in forma semplificata:
- RF-4.2 Template grafici di marca riempiti automaticamente. Set iniziale (8):
  Lenny — ristorante della settimana, annuncio promozionale, avviso di
  servizio, reclutamento rider; Stazione — servizio in evidenza, avviso di
  servizio, consiglio pratico stagionale, volti del personale.
- RF-4.6 Anteprima fedele per canale/formato prima dell'approvazione (qui
  semplificata: generazione di un'immagine placeholder con i campi riempiti,
  riusando l'adapter media esistente).
- RF-4.7 Formati multipli, incluso export ad alta risoluzione per stampa.

Persistenza: nessuna nuova persistenza dati necessaria; i template sono
definizioni statiche configurabili in memoria/codice (potrebbero diventare
JSON in futuro senza cambiare l'interfaccia).
"""
from typing import Dict, List, Optional

from . import media_adapter

# Set iniziale di 8 template (RF-4.2), con i campi da riempire per ciascuno.
TEMPLATES: Dict[str, Dict] = {
    "lenny_ristorante_settimana": {
        "brand": "Lenny",
        "label": "Ristorante della settimana",
        "fields": ["nome_ristorante", "piatto_in_evidenza", "invito_azione"],
        "formats": ["social", "email"],
    },
    "lenny_annuncio_promozionale": {
        "brand": "Lenny",
        "label": "Annuncio promozionale",
        "fields": ["offerta", "validita", "invito_azione"],
        "formats": ["social", "whatsapp", "email"],
    },
    "lenny_avviso_servizio": {
        "brand": "Lenny",
        "label": "Avviso di servizio",
        "fields": ["messaggio", "periodo"],
        "formats": ["social", "email", "whatsapp"],
    },
    "lenny_reclutamento_rider": {
        "brand": "Lenny",
        "label": "Reclutamento rider",
        "fields": ["zona", "contatto_candidatura"],
        "formats": ["social"],
    },
    "stazione_servizio_in_evidenza": {
        "brand": "Stazione",
        "label": "Servizio in evidenza",
        "fields": ["nome_servizio", "descrizione_breve"],
        "formats": ["social", "email"],
    },
    "stazione_avviso_servizio": {
        "brand": "Stazione",
        "label": "Avviso di servizio",
        "fields": ["messaggio", "periodo"],
        "formats": ["social", "email", "whatsapp"],
    },
    "stazione_consiglio_stagionale": {
        "brand": "Stazione",
        "label": "Consiglio pratico stagionale",
        "fields": ["stagione", "consiglio"],
        "formats": ["social", "email"],
    },
    "stazione_volti_del_personale": {
        "brand": "Stazione",
        "label": "Volti del personale",
        "fields": ["nome_persona", "ruolo", "frase_breve"],
        "formats": ["social"],
    },
}

# Formati/dimensioni disponibili, inclusa la stampa ad alta risoluzione (RF-4.7).
FORMAT_SIZES = {
    "social": (1080, 1080),
    "email": (1200, 628),
    "whatsapp": (1080, 1350),
    "stampa_a4": (2480, 3508),  # 300dpi, alta risoluzione per locandine
}


def list_templates(brand: Optional[str] = None) -> List[Dict]:
    """Elenca i template disponibili, opzionalmente filtrati per marca."""
    items = [{"key": k, **v} for k, v in TEMPLATES.items()]
    if brand:
        items = [t for t in items if t["brand"] == brand]
    return items


def get_template(template_key: str) -> Optional[Dict]:
    template = TEMPLATES.get(template_key)
    if template is None:
        return None
    return {"key": template_key, **template}


def validate_fields(template_key: str, values: Dict[str, str]) -> Dict:
    """Verifica che tutti i campi richiesti dal template siano presenti e
    non vuoti (RF-4.2: template riempiti automaticamente, non a metà)."""
    template = get_template(template_key)
    if template is None:
        raise ValueError(f"Template non trovato: {template_key}")

    missing = [f for f in template["fields"] if not (values.get(f) or "").strip()]
    return {"valid": len(missing) == 0, "missing_fields": missing}


def render_preview(template_key: str, values: Dict[str, str], output_format: str = "social"):
    """Genera un'anteprima fedele per canale/formato (RF-4.6), riusando
    l'adapter di generazione media già esistente. Ritorna un'immagine PIL.
    """
    template = get_template(template_key)
    if template is None:
        raise ValueError(f"Template non trovato: {template_key}")
    if output_format not in FORMAT_SIZES:
        raise ValueError(f"Formato non supportato: {output_format}")

    validation = validate_fields(template_key, values)
    if not validation["valid"]:
        raise ValueError(f"Campi mancanti: {validation['missing_fields']}")

    composed_text = f"{template['label']} — " + " | ".join(
        f"{field}: {values[field]}" for field in template["fields"]
    )
    size = FORMAT_SIZES[output_format]
    return media_adapter.generate_placeholder(prompt=composed_text, brand=template["brand"], size=size)
