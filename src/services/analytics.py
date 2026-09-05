"""
Analytics e misurazione — versione base per il prototipo (M9).

Aggrega dati già raccolti dagli altri moduli (loyalty, reviews, contacts,
storage contenuti), senza introdurre un nuovo storage: sono calcoli
on-the-fly, pensati per una dashboard per marca (RF-9.8).

Copre in forma semplificata:
- RF-9.2 Attribuzione tramite voucher nominali (chi, da dove, quanto).
- RF-9.5 KPI per natura del servizio (qui: aggregati generali per marca).
- RF-9.8 Dashboard per marca e vista di gruppo.
"""
from typing import Dict, List, Optional

from . import loyalty
from . import reviews
from . import contacts
from . import storage


def brand_summary(brand: Optional[str] = None) -> Dict:
    """Calcola un riepilogo aggregato per una marca (o per l'intero gruppo se None)."""
    vouchers = loyalty.list_vouchers(brand=brand)
    reviews_list = reviews.list_reviews(brand=brand)
    contacts_list = contacts.list_contacts(brand=brand)
    contents_list = storage.list_contents(brand=brand)

    total_vouchers = len(vouchers)
    redeemed = len([v for v in vouchers if v["state"] == "riscattato"])
    expired = len([v for v in vouchers if v["state"] == "scaduto"])
    redemption_rate = (redeemed / total_vouchers * 100) if total_vouchers else 0.0

    reviews_by_category = {"positiva": 0, "negativa": 0, "grave": 0}
    for r in reviews_list:
        reviews_by_category[r["category"]] = reviews_by_category.get(r["category"], 0) + 1
    avg_rating = (
        sum(r["rating"] for r in reviews_list) / len(reviews_list) if reviews_list else 0.0
    )
    pending_reviews = len([r for r in reviews_list if r["state"] == "bozza_pronta"])

    contacts_by_type = {"residente": 0, "turista": 0}
    for c in contacts_list:
        contacts_by_type[c["visitor_type"]] = contacts_by_type.get(c["visitor_type"], 0) + 1

    contents_by_state = {}
    for c in contents_list:
        contents_by_state[c["state"]] = contents_by_state.get(c["state"], 0) + 1

    return {
        "brand": brand or "Tutti i marchi",
        "vouchers": {
            "total": total_vouchers,
            "redeemed": redeemed,
            "expired": expired,
            "redemption_rate_pct": round(redemption_rate, 1),
        },
        "reviews": {
            "total": len(reviews_list),
            "by_category": reviews_by_category,
            "avg_rating": round(avg_rating, 2),
            "pending_response": pending_reviews,
        },
        "contacts": {
            "total": len(contacts_list),
            "by_type": contacts_by_type,
        },
        "contents": {
            "total": len(contents_list),
            "by_state": contents_by_state,
        },
    }


def cross_brand_voucher_flow() -> List[Dict]:
    """Misura il travaso di clienti tra marchi tramite voucher (RF-9.2).

    Ritorna coppie (source_brand -> target_brand) con conteggio ed emessi/riscattati.
    """
    all_vouchers = loyalty.list_vouchers()
    flows: Dict[str, Dict] = {}
    for v in all_vouchers:
        key = f"{v['source_brand']} → {v['target_brand']}"
        if key not in flows:
            flows[key] = {"route": key, "issued": 0, "redeemed": 0}
        flows[key]["issued"] += 1
        if v["state"] == "riscattato":
            flows[key]["redeemed"] += 1
    return sorted(flows.values(), key=lambda f: f["issued"], reverse=True)
