"""
Libreria media — versione base per il prototipo (M4).

Copre in forma semplificata:
- RF-4.1 Libreria media per marca: caricamento, etichettatura, ricerca, riuso.
  Ogni immagine generata/caricata resta e si accumula, non si perde dopo l'uso.

Persistenza: file immagine PNG in `data/media/`, metadati in `data/media_library.json`.
"""
import json
import os
import uuid
import datetime
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
MEDIA_DIR = os.path.join(DATA_DIR, "media")
LIBRARY_FILE = os.path.join(DATA_DIR, "media_library.json")


def _ensure_dirs():
    os.makedirs(MEDIA_DIR, exist_ok=True)
    if not os.path.exists(LIBRARY_FILE):
        with open(LIBRARY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load() -> List[Dict]:
    _ensure_dirs()
    with open(LIBRARY_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save(items: List[Dict]):
    _ensure_dirs()
    with open(LIBRARY_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def save_media(brand: str, image_bytes: bytes, tags: Optional[List[str]] = None, note: str = "") -> Dict:
    """Salva un'immagine nella libreria con etichette (RF-4.1)."""
    _ensure_dirs()
    media_id = str(uuid.uuid4())
    filename = f"{media_id}.png"
    filepath = os.path.join(MEDIA_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)

    items = _load()
    entry = {
        "id": media_id,
        "brand": brand,
        "filename": filename,
        "tags": [t.strip().lower() for t in (tags or []) if t.strip()],
        "note": note,
        "created_at": datetime.datetime.now().isoformat(),
        "used_count": 0,
        "last_used_at": None,
    }
    items.append(entry)
    _save(items)
    return entry


def get_media_path(media_id: str) -> Optional[str]:
    for item in _load():
        if item["id"] == media_id:
            return os.path.join(MEDIA_DIR, item["filename"])
    return None


def get_media_bytes(media_id: str) -> Optional[bytes]:
    path = get_media_path(media_id)
    if path and os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()
    return None


def list_media(brand: Optional[str] = None, tag: Optional[str] = None) -> List[Dict]:
    items = _load()
    if brand:
        items = [i for i in items if i["brand"] == brand]
    if tag:
        tag_lower = tag.strip().lower()
        items = [i for i in items if tag_lower in i["tags"]]
    return sorted(items, key=lambda i: i["created_at"], reverse=True)


def mark_used(media_id: str) -> Optional[Dict]:
    """Segna un riuso: incrementa il contatore d'uso (RF-4.1: si accumula, si riusa)."""
    items = _load()
    for i in items:
        if i["id"] == media_id:
            i["used_count"] += 1
            i["last_used_at"] = datetime.datetime.now().isoformat()
            _save(items)
            return i
    return None


def all_tags(brand: Optional[str] = None) -> List[str]:
    """Ritorna l'elenco unico di tag presenti (per suggerire la ricerca)."""
    items = _load()
    if brand:
        items = [i for i in items if i["brand"] == brand]
    tags = set()
    for i in items:
        tags.update(i["tags"])
    return sorted(tags)
