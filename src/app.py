import streamlit as st
import io
import os
import sys

# Assicuriamo che la cartella src sia nel path per importare services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.media_adapter import generate_placeholder
from services import auth
from services import storage


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


def main():
    st.set_page_config(page_title="Regìa Prototype", layout="centered")

    if "user" not in st.session_state:
        login_view()
        return

    user = st.session_state["user"]
    sidebar_user_info(user)

    st.title("Regìa — Prototype (Streamlit)")

    brands = ["Lenny", "Stazione", "Eni Cafè", "Officina"]

    tab1, tab2, tab3 = st.tabs(["Crea contenuto", "Workflow", "Audit log"])
    with tab1:
        content_creation_tab(user, brands)
    with tab2:
        workflow_tab(user, brands)
    with tab3:
        audit_tab(user)

    st.markdown("---")
    st.caption(
        "Flusso dimostrato: login → brief → generazione media (stub) → bozza → "
        "proposto → approvato → pubblicato, con audit log."
    )


if __name__ == '__main__':
    main()
