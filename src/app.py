import streamlit as st
import io
import os
import sys

# Assicuriamo che la cartella src sia nel path per importare services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.media_adapter import generate_placeholder
from services import auth
from services import storage
from services import loyalty
from services import reviews


def login_view():
    st.title("Regìa — Login")
    st.caption("Prototipo: owner/owner123 (Owner) · editor/editor123 (Editor)")
    username = st.text_input("Utente")
    password = st.text_input("Password", type="password")
    if st.button("Accedi"):
        user = auth.authenticate(username, password)
        if user:
            st.session_state["user"] = user
            storage.log_audit(user["username"], "login")
            st.rerun()
        else:
            st.error("Credenziali non valide")


def sidebar_user_info(user):
    st.sidebar.markdown(f"**{user['display_name']}** ({user['role']})")
    if st.sidebar.button("Esci"):
        storage.log_audit(user["username"], "logout")
        del st.session_state["user"]
        st.rerun()


def content_creation_tab(user, brands):
    brand = st.selectbox("Marca", brands, key="create_brand")
    channel = st.selectbox(
        "Canale",
        ["Social (Instagram/Facebook)", "Email", "WhatsApp", "Stampa/Locandina"],
        key="create_channel",
    )

    st.markdown("### Brief / Prompt")
    prompt = st.text_area(
        "Breve descrizione del contenuto",
        value="Foto del locale / promozione breve...",
        height=120,
        key="create_prompt",
    )

    if st.button("Genera immagine di prova"):
        with st.spinner("Generazione in corso... (stub locale)"):
            img = generate_placeholder(prompt=prompt, brand=brand, size=(1024, 768))
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            st.session_state["last_image"] = buf.getvalue()
            st.success("Immagine generata")

    if "last_image" in st.session_state:
        st.markdown("### Anteprima canale")
        width_map = {
            "Social (Instagram/Facebook)": 600,
            "Email": 520,
            "WhatsApp": 360,
            "Stampa/Locandina": 1200,
        }
        st.image(st.session_state["last_image"], width=width_map.get(channel, 600), caption=f"Anteprima {channel}")

        can_create = auth.has_permission(user["role"], "create")
        if can_create and st.button("Salva come bozza"):
            content = storage.create_content(
                brand=brand, channel=channel, prompt=prompt, author=user["username"]
            )
            st.success(f"Bozza creata (id: {content['id'][:8]}...)")
            st.session_state.pop("last_image", None)


def workflow_tab(user, brands):
    st.markdown("### Contenuti e workflow di stato")
    st.caption("bozza → proposto → approvato → programmato → pubblicato → misurato (RF-3.5)")

    filter_brand = st.selectbox("Filtra per marca", ["Tutte"] + brands, key="filter_brand")
    brand_filter = None if filter_brand == "Tutte" else filter_brand
    items = storage.list_contents(brand=brand_filter)

    if not items:
        st.info("Nessun contenuto presente. Crea una bozza dalla scheda 'Crea contenuto'.")
        return

    can_approve = auth.has_permission(user["role"], "approve")
    can_publish = auth.has_permission(user["role"], "publish")
    can_propose = auth.has_permission(user["role"], "propose")

    for item in items:
        with st.expander(f"[{item['state'].upper()}] {item['brand']} · {item['channel']} · {item['created_at'][:16]}"):
            st.write(item["prompt"])
            st.caption(f"Autore: {item['author']} · ID: {item['id']}")

            cols = st.columns(4)
            state = item["state"]

            if state == "bozza" and can_propose:
                if cols[0].button("Proponi", key=f"propose_{item['id']}"):
                    storage.transition_state(item["id"], "proposto", user["username"])
                    st.rerun()

            if state == "proposto" and can_approve:
                if cols[1].button("Approva", key=f"approve_{item['id']}"):
                    storage.transition_state(item["id"], "approvato", user["username"])
                    st.rerun()
                if cols[2].button("Rifiuta", key=f"reject_{item['id']}"):
                    st.session_state[f"reject_reason_{item['id']}"] = True

            if st.session_state.get(f"reject_reason_{item['id']}"):
                reason = st.text_input("Motivo del rifiuto (RF-3.8)", key=f"reason_input_{item['id']}")
                if st.button("Conferma rifiuto", key=f"confirm_reject_{item['id']}"):
                    storage.transition_state(item["id"], "bozza", user["username"], reason=reason)
                    st.session_state.pop(f"reject_reason_{item['id']}", None)
                    st.rerun()

            if state == "approvato" and can_publish:
                if cols[3].button("Pubblica", key=f"publish_{item['id']}"):
                    storage.transition_state(item["id"], "pubblicato", user["username"])
                    st.rerun()

            if item.get("rejection_reason"):
                st.warning(f"Ultimo motivo di rifiuto: {item['rejection_reason']}")


def audit_tab(user):
    st.markdown("### Audit log (RF-11.3, semplificato)")
    if not auth.has_permission(user["role"], "view_commercial"):
        st.info("Sezione riservata all'Owner.")
        return
    entries = storage.read_audit_log(limit=50)
    if not entries:
        st.info("Nessun evento registrato.")
        return
    for e in entries:
        st.text(f"{e['timestamp']} · {e['user']} · {e['action']} · {e.get('details', {})}")


def loyalty_tab(user, brands):
    st.markdown("### Motore fedeltà (M6) — contatori e voucher")
    st.caption(
        "Contatore configurabile per marca (RF-6.1) · emissione automatica voucher "
        "a soglia (RF-6.5) · scadenza (RF-6.6) · verifica/riscatto separati e "
        "idempotenti (RF-6.7)."
    )

    sub1, sub2, sub3 = st.tabs(["Contatore", "Voucher emessi", "Riscatto"])

    with sub1:
        st.markdown("#### Registra un passaggio / ordine")
        contact = st.text_input("Contatto (telefono o email)", key="loy_contact")
        source_brand = st.selectbox("Marca di origine (dove si accumula)", brands, key="loy_source_brand")
        target_brand = st.selectbox("Marca del premio (voucher incrociato)", brands, key="loy_target_brand")
        threshold = st.number_input("Soglia", min_value=1, value=10, step=1, key="loy_threshold")
        category = st.text_input("Categoria premio (es. lavaggio, tagliando, cibo)", key="loy_category")
        value_label = st.text_input("Descrizione premio (es. '10% di sconto')", key="loy_value_label")

        if contact:
            counter = loyalty.get_or_create_counter(contact, source_brand, threshold)
            st.info(f"Contatore attuale: {counter['value']} / {counter['threshold']}")

        if st.button("Registra +1") and contact:
            result = loyalty.increment_counter(contact, source_brand, threshold, amount=1)
            st.success(f"Contatore aggiornato: {result['counter']['value']} / {threshold}")
            if result["reached"]:
                voucher = loyalty.issue_voucher(
                    contact=contact,
                    source_brand=source_brand,
                    target_brand=target_brand,
                    category=category or "generico",
                    value_label=value_label or "Premio",
                )
                storage.log_audit(user["username"], "issue_voucher", {"code": voucher["code"], "contact": contact})
                st.balloons()
                st.success(f"🎉 Soglia raggiunta! Voucher emesso: **{voucher['code']}** (valido {loyalty.DEFAULT_EXPIRY_DAYS} giorni)")

    with sub2:
        st.markdown("#### Voucher emessi")
        filter_brand = st.selectbox("Filtra per marca", ["Tutte"] + brands, key="loy_filter_brand")
        brand_filter = None if filter_brand == "Tutte" else filter_brand
        vouchers = loyalty.list_vouchers(brand=brand_filter)
        if not vouchers:
            st.info("Nessun voucher emesso finora.")
        for v in vouchers:
            st.text(
                f"[{v['state'].upper()}] {v['code']} · {v['contact']} · "
                f"{v['source_brand']}→{v['target_brand']} · {v['value_label']} · "
                f"scade {v['expires_at'][:10]}"
            )

    with sub3:
        st.markdown("#### Verifica e riscatto codice")
        code = st.text_input("Codice voucher", key="loy_redeem_code")
        col1, col2 = st.columns(2)
        if col1.button("Verifica") and code:
            result = loyalty.verify_voucher(code)
            if result["valid"]:
                v = result["voucher"]
                st.success(f"Valido: {v['value_label']} ({v['category']}) — scade {v['expires_at'][:10]}")
            else:
                st.error(result["reason"])
        if col2.button("Riscatta (brucia codice)") and code:
            result = loyalty.redeem_voucher(code)
            storage.log_audit(user["username"], "redeem_voucher", {"code": code, "success": result["success"]})
            if result["success"]:
                st.success(result["reason"])
            else:
                st.error(result["reason"])


def reviews_tab(user, brands):
    st.markdown("### Recensioni e reputazione (M8)")
    st.caption(
        "Negative → bozza pronta da approvare (RF-8.2) · Positive → risposta breve "
        "(RF-8.3) · Casi gravi → solo segnalazione, mai bozza automatica (RF-8.4) · "
        "nessuna risposta parte mai in autonomia (RF-8.5)."
    )

    sub1, sub2 = st.tabs(["Simula nuova recensione", "Da gestire"])

    with sub1:
        st.markdown("#### Simula l'arrivo di una recensione")
        brand = st.selectbox("Marca", brands, key="rev_brand")
        author_name = st.text_input("Nome autore", value="Cliente", key="rev_author")
        rating = st.slider("Valutazione (stelle)", 1, 5, 5, key="rev_rating")
        text = st.text_area("Testo della recensione", height=100, key="rev_text")
        channel = st.selectbox("Canale", ["Google", "Commento social"], key="rev_channel")

        if st.button("Simula ricezione"):
            review = reviews.create_review(
                brand=brand, author_name=author_name, rating=rating, text=text, channel=channel
            )
            storage.log_audit(user["username"], "review_received", {"id": review["id"], "category": review["category"]})
            if review["category"] == "grave":
                st.error("⚠️ Caso grave rilevato: nessuna bozza generata. Va gestito privatamente prima di rispondere in pubblico (RF-8.4).")
            else:
                st.success(f"Recensione registrata, categoria: {review['category']}. Bozza pronta nella scheda 'Da gestire'.")

    with sub2:
        st.markdown("#### Recensioni da gestire")
        filter_brand = st.selectbox("Filtra per marca", ["Tutte"] + brands, key="rev_filter_brand")
        brand_filter = None if filter_brand == "Tutte" else filter_brand
        items = reviews.list_reviews(brand=brand_filter)

        if not items:
            st.info("Nessuna recensione presente.")
            return

        can_publish = auth.has_permission(user["role"], "publish")

        for r in items:
            badge = {"positiva": "🟢", "negativa": "🟡", "grave": "🔴"}.get(r["category"], "")
            with st.expander(f"{badge} [{r['state'].upper()}] {r['brand']} · {r['rating']}★ · {r['author_name']}"):
                st.write(f"_{r['text']}_")
                st.caption(f"Canale: {r['channel']} · Categoria: {r['category']} · Ricevuta: {r['created_at'][:16]}")

                if r["category"] == "grave":
                    st.warning("Caso grave: risolvere privatamente con il cliente prima di rispondere in pubblico. Nessuna bozza automatica (RF-8.4).")
                elif r["state"] == "bozza_pronta":
                    edited = st.text_area("Bozza di risposta (modificabile)", value=r["draft_response"], key=f"draft_{r['id']}")
                    if can_publish and st.button("Approva e pubblica", key=f"approve_pub_{r['id']}"):
                        reviews.approve_and_publish(r["id"], edited, user["username"])
                        storage.log_audit(user["username"], "review_response_published", {"id": r["id"]})
                        st.success("Risposta pubblicata.")
                        st.rerun()
                elif r["state"] == "pubblicata":
                    st.success(f"Risposta pubblicata: _{r['final_response']}_")
                    if not r.get("follow_up_requested") and r["category"] == "negativa":
                        if st.button("Segna: richiedi recensione dopo risoluzione", key=f"followup_{r['id']}"):
                            reviews.request_follow_up_review(r["id"])
                            st.rerun()
                    if r.get("follow_up_requested"):
                        st.caption("✓ Richiesta di recensione post-risoluzione segnata (RF-8.8)")


def main():
    st.set_page_config(page_title="Regìa Prototype", layout="centered")

    if "user" not in st.session_state:
        login_view()
        return

    user = st.session_state["user"]
    sidebar_user_info(user)

    st.title("Regìa — Prototype (Streamlit)")

    brands = ["Lenny", "Stazione", "Eni Cafè", "Officina"]

    tab1, tab2, tab3, tab4, tab5 = st.tabs(["Crea contenuto", "Workflow", "Fedeltà", "Recensioni", "Audit log"])
    with tab1:
        content_creation_tab(user, brands)
    with tab2:
        workflow_tab(user, brands)
    with tab3:
        loyalty_tab(user, brands)
    with tab4:
        reviews_tab(user, brands)
    with tab5:
        audit_tab(user)

    st.markdown("---")
    st.caption(
        "Flusso dimostrato: login → brief → generazione media (stub) → bozza → "
        "proposto → approvato → pubblicato, con audit log."
    )


if __name__ == '__main__':
    main()
