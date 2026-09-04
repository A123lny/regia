"""
Autenticazione minima per il prototipo (login fittizio, in-memory).

Non è un sistema di autenticazione reale: serve solo a dimostrare il concetto
di ruoli per marchio (RU-1) e la distinzione dei permessi (RU-1a, RU-3).

Utenti di prova:
- owner / owner123   -> ruolo Owner su tutti i marchi
- editor / editor123 -> ruolo Editor (limitato)
"""
from typing import Optional, Dict

# Utenti di prova. In produzione: hash password, DB, 2FA (RU-3).
_USERS = {
    "owner": {"password": "owner123", "role": "Owner", "display_name": "Titolare"},
    "editor": {"password": "editor123", "role": "Editor", "display_name": "Collaboratore"},
}

# Permessi per ruolo (semplificato):
# Owner: può creare, approvare, pubblicare, vedere dati commerciali (RU-1a)
# Editor: può creare/proporre, non può approvare né pubblicare
ROLE_PERMISSIONS = {
    "Owner": {"create", "propose", "approve", "publish", "view_commercial"},
    "Editor": {"create", "propose"},
}


def authenticate(username: str, password: str) -> Optional[Dict]:
    """Verifica le credenziali. Ritorna il profilo utente se valido, altrimenti None."""
    user = _USERS.get(username)
    if user and user["password"] == password:
        return {
            "username": username,
            "role": user["role"],
            "display_name": user["display_name"],
        }
    return None


def has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())
