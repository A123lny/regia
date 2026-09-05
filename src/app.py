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
from services import contacts
from services import analytics
from services import restaurants
from services import admin
from services import media_library
from services import publishing
from services import advertising


BRAND_COLORS = {
    "Lenny": "#FF6B35",
    "Stazione": "#1E5F8C",
    "Eni Cafè": "#8C5E1E",
    "Officina": "#3E4C59",
}

PAGES = [
    ("🏠", "Home"),
    ("➕", "Crea contenuto"),
    ("🔄", "Workflow"),
    ("📅", "Calendario"),
    ("🎁", "Fedeltà"),
    ("⭐", "Recensioni"),
    ("📱", "Raccolta contatti"),
    ("🎭", "Rete ristoranti"),
    ("📤", "Pubblicazione"),
    ("💰", "Advertising"),
    ("📊", "Analytics"),
    ("⚙️", "Amministrazione"),
    ("📝", "Audit log"),
]


def inject_css():
    st.markdown(
        """
        <style>
        .block-container { padding-top: 2rem; padding-bottom: 3rem; max-width: 1100px; }
        h1, h2, h3 { font-family: 'Segoe UI', sans-serif; }
        h1 { color: #1E2A38; }
        [data-testid="stMetric"] {
            background: #F7F9FB;
            border: 1px solid #E3E8EE;
            border-radius: 10px;
            padding: 12px 16px;
        }
        div[data-testid="stExpander"] {
            border: 1px solid #E3E8EE;
            border-radius: 10px;
            margin-bottom: 8px;
        }
        .stButton>button {
            border-radius: 8px;
            font-weight: 500;
        }
        section[data-testid="stSidebar"] {
            background: #F5F6F8;
        }
        .regia-brand-pill {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 999px;
            color: white;
            font-size: 0.8em;
            font-weight: 600;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def brand_pill(brand: str) -> str:
    color = BRAND_COLORS.get(brand, "#5A6472")
    return f'<span class="regia-brand-pill" style="background:{color}">{brand}</span>'


def login_view():
    inject_css()
    col_a, col_b, col_c = st.columns([1, 1.4, 1])
    with col_b:
        st.markdown("## 🎛️ Regìa")
        st.caption("Piattaforma di marketing e operazioni commerciali multi-marchio")
        st.markdown("---")
        st.markdown("#### Accedi")
        username = st.text_input("Utente")
        password = st.text_input("Password", type="password")
        if st.button("Accedi", use_container_width=True):
            user = auth.authenticate(username, password)
            if user:
                st.session_state["user"] = user
                storage.log_audit(user["username"], "login")
                st.rerun()
            else:
                st.error("Credenziali non valide")
        st.caption("Prototipo: `owner`/`owner123` (Owner) · `editor`/`editor123` (Editor)")


def sidebar_user_info(user):
    st.sidebar.markdown("## 🎛️ Regìa")
    avatar = "👑" if user["role"] == "Owner" else "👤"
    st.sidebar.markdown(f"{avatar} **{user['display_name']}**")
    st.sidebar.caption(f"Ruolo: {user['role']}")
    st.sidebar.markdown("---")
    if st.sidebar.button("🚪 Esci", use_container_width=True):
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

    sub1, sub2 = st.tabs(["🎨 Genera nuovo", "📚 Riusa dalla libreria"])

    with sub1:
        st.markdown("### Brief / Prompt")
        prompt = st.text_area(
            "Breve descrizione del contenuto",
            value="Foto del locale / promozione breve...",
            height=120,
            key="create_prompt",
        )
        tags_input = st.text_input("Etichette (separate da virgola, es. officina, promo, estate)", key="create_tags")

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
            col1, col2 = st.columns(2)
            if can_create and col1.button("Salva come bozza"):
                content = storage.create_content(
                    brand=brand, channel=channel, prompt=prompt, author=user["username"]
                )
                st.success(f"Bozza creata (id: {content['id'][:8]}...)")
                st.session_state.pop("last_image", None)
            if col2.button("📚 Salva anche in libreria media"):
                tags = [t for t in tags_input.split(",")] if tags_input else []
                media_library.save_media(
                    brand=brand, image_bytes=st.session_state["last_image"], tags=tags, note=prompt
                )
                storage.log_audit(user["username"], "media_saved", {"brand": brand, "tags": tags})
                st.success("Immagine salvata in libreria (RF-4.1): resta disponibile per il riuso.")

    with sub2:
        st.markdown("### Libreria media esistente")
        st.caption("Ogni immagine generata/caricata resta e si accumula (RF-4.1): niente si perde dopo un solo uso.")
        search_tag = st.text_input("Cerca per etichetta", key="media_search_tag")
        available_tags = media_library.all_tags(brand=brand)
        if available_tags:
            st.caption("Etichette disponibili: " + ", ".join(available_tags))

        media_items = media_library.list_media(brand=brand, tag=search_tag or None)
        if not media_items:
            st.info("Nessun media in libreria per questa marca. Generane uno nella scheda accanto.")
        else:
            cols = st.columns(3)
            for idx, m in enumerate(media_items):
                with cols[idx % 3]:
                    img_bytes = media_library.get_media_bytes(m["id"])
                    if img_bytes:
                        st.image(img_bytes, width=200)
                    st.caption(f"Tag: {', '.join(m['tags']) or '-'} · Usato {m['used_count']}x")
                    can_create = auth.has_permission(user["role"], "create")
                    if can_create and st.button("Usa per nuova bozza", key=f"reuse_{m['id']}"):
                        media_library.mark_used(m["id"])
                        content = storage.create_content(
                            brand=brand, channel=channel, prompt=m["note"] or "(riuso da libreria)", author=user["username"]
                        )
                        storage.log_audit(user["username"], "media_reused", {"media_id": m["id"], "content_id": content["id"]})
                        st.success(f"Bozza creata riusando il media (id: {content['id'][:8]}...)")
                        st.rerun()


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


def calendar_tab(user, brands):
    st.markdown("### Calendario editoriale unificato (RF-3.2)")
    st.caption("Vista cronologica di tutti i contenuti, raggruppati per giorno e marca.")

    filter_brand = st.selectbox("Filtra per marca", ["Tutte"] + brands, key="calendar_filter_brand")
    brand_filter = None if filter_brand == "Tutte" else filter_brand

    grouped = storage.contents_grouped_by_date(brand=brand_filter)

    if not grouped:
        st.info("Nessun contenuto ancora presente nel calendario.")
    else:
        for date_key, items in grouped.items():
            st.markdown(f"#### 📆 {date_key}")
            for item in items:
                preview = item['prompt'][:80] + ("…" if len(item['prompt']) > 80 else "")
                st.markdown(
                    f"- **[{item['state'].upper()}]** {item['brand']} · {item['channel']} — {preview}"
                )

    st.markdown("---")
    st.markdown("#### ⚖️ Equilibrio editoriale (RF-12.3)")
    st.caption("Confronto del numero di contenuti totali per marca, per individuare squilibri (es. 'Officina 2 uscite, Delivery 18').")

    counts = storage.editorial_balance(brands)
    if counts:
        cols = st.columns(len(counts))
        for col, (brand, count) in zip(cols, counts.items()):
            col.metric(brand, count)

        max_brand, max_count = max(counts.items(), key=lambda kv: kv[1])
        min_brand, min_count = min(counts.items(), key=lambda kv: kv[1])
        if max_count > 0 and max_count - min_count >= 3 and max_count >= (min_count * 3 if min_count > 0 else max_count):
            st.warning(
                f"⚠️ Possibile squilibrio editoriale: **{max_brand}** ha {max_count} contenuti mentre "
                f"**{min_brand}** ne ha solo {min_count}. Valuta di riequilibrare il piano editoriale."
            )
        else:
            st.success("Il piano editoriale sembra ragionevolmente bilanciato tra le marche.")


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


def contacts_tab(user, brands):
    st.markdown("### Raccolta contatti (M10)")
    st.caption(
        "Simulazione del percorso QR → pagina → recapito → beneficio immediato (RF-10.1). "
        "Doppia offerta: residente/pendolare vs turista (RF-10.2). Consenso separato per "
        "canale (RF-10.3)."
    )

    sub1, sub2 = st.tabs(["Simula pagina QR", "Contatti raccolti"])

    with sub1:
        st.markdown("#### Pagina di iscrizione (come la vedrebbe il cliente)")
        brand = st.selectbox("Marca / colonnina", brands, key="contact_brand")
        visitor_type = st.radio(
            "Sei un residente/pendolare o un turista?",
            contacts.VISITOR_TYPES,
            key="contact_visitor_type",
            horizontal=True,
        )

        if visitor_type == "residente":
            st.info("🏠 Offerta residente: iscriviti per vantaggi ricorrenti su officina, bar e servizi.")
        else:
            st.info("🌞 Offerta turista: un vantaggio subito e un motivo per tornare l'anno prossimo.")

        full_name = st.text_input("Nome", key="contact_full_name")
        email = st.text_input("Email (opzionale)", key="contact_email")
        phone = st.text_input("Telefono (opzionale)", key="contact_phone")

        st.markdown("**Consensi** (separati per canale, RF-10.3)")
        c1, c2, c3 = st.columns(3)
        consent_email = c1.checkbox("Email", key="consent_email")
        consent_whatsapp = c2.checkbox("WhatsApp", key="consent_whatsapp")
        consent_sms = c3.checkbox("SMS", key="consent_sms")

        if st.button("Iscriviti e ricevi il beneficio"):
            if not full_name or (not email and not phone):
                st.error("Inserisci almeno nome e un recapito (email o telefono).")
            else:
                contact = contacts.register_contact(
                    brand=brand,
                    visitor_type=visitor_type,
                    full_name=full_name,
                    email=email or None,
                    phone=phone or None,
                    consents={"email": consent_email, "whatsapp": consent_whatsapp, "sms": consent_sms},
                )
                # Beneficio immediato: voucher di benvenuto (RN-63), riusa il motore fedeltà
                voucher = loyalty.issue_voucher(
                    contact=phone or email,
                    source_brand=brand,
                    target_brand=brand,
                    category="benvenuto",
                    value_label="Caffè omaggio" if visitor_type == "residente" else "Sconto di benvenuto",
                )
                contacts.set_welcome_voucher(contact["id"], voucher["code"])
                storage.log_audit(user["username"], "contact_registered", {"id": contact["id"], "brand": brand})
                st.success(
                    f"Benvenuto/a {full_name}! Il tuo voucher: **{voucher['code']}** — {voucher['value_label']}."
                )

    with sub2:
        st.markdown("#### Contatti raccolti")
        filter_brand = st.selectbox("Filtra per marca", ["Tutte"] + brands, key="contact_filter_brand")
        brand_filter = None if filter_brand == "Tutte" else filter_brand
        items = contacts.list_contacts(brand=brand_filter)

        if not items:
            st.info("Nessun contatto raccolto finora.")
            return

        for c in items:
            granted_channels = [ch for ch, v in c["consents"].items() if v["granted"]]
            st.text(
                f"{c['full_name']} ({c['visitor_type']}) · {c['brand']} · "
                f"consensi: {', '.join(granted_channels) or 'nessuno'} · "
                f"voucher: {c['welcome_voucher_code'] or '-'}"
            )


def analytics_tab(user, brands):
    st.markdown("### Analytics e misurazione (M9)")
    st.caption(
        "Dashboard per marca (RF-9.8), aggregata dai dati già raccolti — nessuna "
        "misurazione separata, solo lettura di quanto esiste (RF-9.2)."
    )

    filter_brand = st.selectbox("Marca", ["Tutti i marchi"] + brands, key="analytics_brand")
    brand_filter = None if filter_brand == "Tutti i marchi" else filter_brand
    summary = analytics.brand_summary(brand=brand_filter)

    st.markdown(f"#### {summary['brand']}")

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Voucher emessi", summary["vouchers"]["total"])
    col2.metric("Tasso riscatto", f"{summary['vouchers']['redemption_rate_pct']}%")
    col3.metric("Recensioni", summary["reviews"]["total"], help=f"Media stelle: {summary['reviews']['avg_rating']}")
    col4.metric("Contatti raccolti", summary["contacts"]["total"])

    st.markdown("---")

    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**Recensioni per categoria**")
        for cat, count in summary["reviews"]["by_category"].items():
            st.text(f"{cat}: {count}")
        if summary["reviews"]["pending_response"] > 0:
            st.warning(f"{summary['reviews']['pending_response']} recensioni in attesa di risposta")

    with c2:
        st.markdown("**Contatti per tipo**")
        for vtype, count in summary["contacts"]["by_type"].items():
            st.text(f"{vtype}: {count}")

    st.markdown("**Contenuti per stato**")
    if summary["contents"]["by_state"]:
        for state, count in summary["contents"]["by_state"].items():
            st.text(f"{state}: {count}")
    else:
        st.text("Nessun contenuto presente.")

    st.markdown("---")
    st.markdown("#### Travaso voucher tra marchi (RF-9.2)")
    flows = analytics.cross_brand_voucher_flow()
    if not flows:
        st.info("Nessun voucher emesso finora.")
    else:
        for f in flows:
            st.text(f"{f['route']}: {f['issued']} emessi, {f['redeemed']} riscattati")


def restaurants_tab(user):
    st.markdown("### Rete ristoranti (M7)")
    st.caption(
        "Gestiti come rete di micro-partner, non lista destinatari (RF-7.1). "
        "Il sistema indica chi contattare questa settimana (RF-7.2); i segnali "
        "di raffreddamento hanno priorità sull'acquisizione (RF-7.4)."
    )

    sub1, sub2 = st.tabs(["Da contattare questa settimana", "Aggiungi/gestisci ristorante"])

    with sub1:
        items = restaurants.list_restaurants_by_priority()
        if not items:
            st.info("Nessun ristorante registrato. Aggiungine uno nella scheda accanto.")
        for r in items:
            cooling_badge = "🔥 IN RAFFREDDAMENTO" if r["cooling"] else "✅ attivo"
            with st.expander(f"{cooling_badge} · {r['name']} ({r['category']}) · punteggio {r['priority_score']}"):
                st.write(f"Ordini ultimi 30 giorni: {r['orders_30d']}")
                last_contact = r["last_contact_at"][:16] if r["last_contact_at"] else "mai contattato"
                st.write(f"Ultimo contatto: {last_contact}")
                if r["notes"]:
                    st.caption("Note: " + "; ".join(n["text"] for n in r["notes"][-3:]))

                col1, col2 = st.columns(2)
                if col1.button("Registra ordine ricevuto", key=f"order_{r['id']}"):
                    restaurants.record_order(r["id"])
                    st.rerun()

                note = st.text_input("Nota sul contatto", key=f"note_input_{r['id']}")
                if col2.button("Segna come contattato", key=f"contact_{r['id']}"):
                    restaurants.record_contact(r["id"], note=note)
                    storage.log_audit(user["username"], "restaurant_contacted", {"id": r["id"], "name": r["name"]})
                    st.rerun()

    with sub2:
        st.markdown("#### Aggiungi un ristorante alla rete")
        name = st.text_input("Nome ristorante", key="rest_name")
        category = st.text_input("Categoria (es. pizzeria, sushi, griglia)", key="rest_category")
        if st.button("Aggiungi") and name:
            r = restaurants.register_restaurant(name=name, category=category or "generico")
            storage.log_audit(user["username"], "restaurant_added", {"id": r["id"], "name": name})
            st.success(f"Ristorante '{name}' aggiunto alla rete.")
            st.rerun()


def publishing_tab(user, brands):
    st.markdown("### Pubblicazione (M5)")
    st.caption(
        "Architettura ad adapter per canale (RF-5.1): coda con ritentativi e idempotenza (RF-5.5), "
        "regola di canale su WhatsApp (RF-5.5a) e fasce orarie (RF-5.6)."
    )

    sub1, sub2 = st.tabs(["Programma pubblicazione", "Coda e log"])

    with sub1:
        brand = st.selectbox("Marca", brands, key="pub_brand")
        channel = st.selectbox("Canale", publishing.CHANNELS, key="pub_channel")
        category = st.selectbox(
            "Categoria contenuto",
            ["promozione_generica", "voucher", "richiamo_officina", "avviso_importante", "editoriale"],
            key="pub_category",
        )
        content_id = st.text_input("ID contenuto (facoltativo)", key="pub_content_id") or str(id(channel))
        snapshot = st.text_area("Testo da pubblicare (snapshot immutabile, RF-5.7)", key="pub_snapshot")

        if channel in publishing.HIGH_VALUE_ONLY_CHANNELS and category not in publishing.HIGH_VALUE_CATEGORIES:
            st.warning(
                "⚠️ WhatsApp è riservato a comunicazioni ad alto valore (voucher, richiami, avvisi importanti). "
                "Le promozioni generiche viaggiano via email (RF-5.5a)."
            )

        if st.button("Metti in coda", key="pub_schedule_btn") and snapshot:
            try:
                entry = publishing.schedule_publication(
                    content_id=content_id, brand=brand, channel=channel, snapshot=snapshot, category=category
                )
                storage.log_audit(user["username"], "publication_scheduled", {"id": entry["id"], "channel": channel})
                st.success(f"Pubblicazione messa in coda (stato: {entry['state']}).")
                st.rerun()
            except ValueError as e:
                st.error(str(e))

    with sub2:
        filter_brand = st.selectbox("Filtra per marca", ["Tutte"] + brands, key="pub_queue_filter_brand")
        brand_filter = None if filter_brand == "Tutte" else filter_brand
        items = publishing.list_queue(brand=brand_filter)

        if not items:
            st.info("Nessuna pubblicazione in coda.")
        for item in items:
            with st.expander(
                f"[{item['state'].upper()}] {item['brand']} · {item['channel']} · {item['created_at'][:16]}"
            ):
                st.write(item["snapshot"])
                st.caption(f"Tentativi: {item['attempts']} · ID: {item['id']}")
                cols = st.columns(3)
                if item["state"] == "in_coda":
                    if cols[0].button("Invia ora", key=f"send_{item['id']}"):
                        result = publishing.process_publication(item["id"])
                        if result["success"]:
                            st.success(result["reason"])
                        else:
                            st.warning(result["reason"])
                        st.rerun()
                    if cols[1].button("Annulla", key=f"cancel_{item['id']}"):
                        publishing.cancel_publication(item["id"])
                        st.rerun()
                if item.get("last_error"):
                    st.error(f"Ultimo errore: {item['last_error']}")

        st.markdown("---")
        st.markdown("#### Log di pubblicazione (immutabile, RF-5.7)")
        log = publishing.read_publication_log(limit=20)
        if not log:
            st.caption("Nessun evento registrato.")
        for entry in log:
            st.caption(f"{entry['at'][:16]} · {entry['event']} · {entry['brand']} · {entry['channel']}")


def advertising_tab(user, brands):
    st.markdown("### Advertising e presenza a pagamento (M13)")
    if not auth.has_permission(user["role"], "view_commercial"):
        st.info("Sezione riservata all'Owner.")
        return

    st.caption(
        "Tutti gli interruttori partono spenti, per ogni marchio (RF-13.2): l'accensione è sempre "
        "una decisione esplicita. Il superamento del tetto non è mai automatico (RF-13.6)."
    )

    brand = st.selectbox("Marca", brands, key="ads_brand")

    st.markdown("#### Interruttori e tetti per categoria")
    switches = advertising.list_switches(brand)
    caps = advertising.list_budget_caps(brand)

    for category in advertising.CATEGORIES:
        cols = st.columns([2, 1, 1])
        cols[0].write(category.replace("_", " ").capitalize())
        new_state = cols[1].toggle(
            "Attivo", value=switches[category], key=f"ads_switch_{brand}_{category}"
        )
        if new_state != switches[category]:
            advertising.set_switch(brand, category, new_state)
            storage.log_audit(user["username"], "ad_switch_changed", {"brand": brand, "category": category, "enabled": new_state})
            st.rerun()

        new_cap = cols[2].number_input(
            "Tetto €/mese", min_value=0.0, value=float(caps[category]), key=f"ads_cap_{brand}_{category}"
        )
        if new_cap != caps[category]:
            advertising.set_budget_cap(brand, category, new_cap)
            st.rerun()

        spent = advertising.get_month_to_date_spend(brand, category)
        st.caption(f"Speso questo mese: {spent:.2f}€ / {caps[category]:.2f}€")

    st.markdown("---")
    st.markdown("#### Richieste di sforamento tetto (RF-13.6)")
    with st.expander("Nuova richiesta di sforamento"):
        category_req = st.selectbox("Categoria", advertising.CATEGORIES, key="overshoot_category")
        amount = st.number_input("Importo aggiuntivo richiesto (€)", min_value=0.0, key="overshoot_amount")
        reason = st.text_area("Motivazione (perché conviene ora, cosa si perde restando nel tetto)", key="overshoot_reason")
        if st.button("Invia richiesta", key="overshoot_submit") and reason:
            advertising.request_overshoot(brand, category_req, amount, reason)
            st.success("Richiesta inviata: resta in attesa di approvazione esplicita del titolare.")
            st.rerun()

    pending = advertising.list_overshoot_requests(brand=brand, state="in_attesa")
    for req in pending:
        with st.expander(f"⏳ In attesa · {req['category']} · +{req['requested_amount']:.2f}€"):
            st.write(req["reason"])
            col1, col2 = st.columns(2)
            if col1.button("Approva", key=f"approve_over_{req['id']}"):
                advertising.decide_overshoot(req["id"], approve=True)
                storage.log_audit(user["username"], "overshoot_approved", {"id": req["id"], "brand": brand})
                st.rerun()
            if col2.button("Rifiuta", key=f"reject_over_{req['id']}"):
                advertising.decide_overshoot(req["id"], approve=False)
                storage.log_audit(user["username"], "overshoot_rejected", {"id": req["id"], "brand": brand})
                st.rerun()

    decided = [
        r for r in advertising.list_overshoot_requests(brand=brand)
        if r["state"] != "in_attesa"
    ]
    if decided:
        st.markdown("##### Storico decisioni")
        for req in decided[:10]:
            icon = "✅" if req["state"] == "approvato" else "❌"
            st.caption(f"{icon} {req['category']} · +{req['requested_amount']:.2f}€ · {req['state']}")


def admin_tab(user, brands):
    st.markdown("### Amministrazione (M11)")
    if not auth.has_permission(user["role"], "view_commercial"):
        st.info("Sezione riservata all'Owner.")
        return

    sub1, sub2, sub3, sub4 = st.tabs(["Marchi", "Autonomia", "Interruttore di arresto", "Monitor costi"])

    with sub1:
        st.markdown("#### Gestione marchi (RF-11.1)")
        st.caption("I marchi sono configurazione, non codice (RN-15): aggiungerne uno non richiede sviluppo.")
        for b in brands:
            st.text(f"• {b}")
        new_brand = st.text_input("Nuovo marchio", key="admin_new_brand")
        if st.button("Aggiungi marchio") and new_brand:
            admin.add_brand(new_brand)
            storage.log_audit(user["username"], "brand_added", {"name": new_brand})
            st.success(f"Marchio '{new_brand}' aggiunto.")
            st.rerun()

    with sub2:
        st.markdown("#### Pannello autonomia progressiva (RF-11.4)")
        st.caption("Tutto parte come proposta soggetta ad approvazione; l'autonomia si concede categoria per categoria.")
        autonomy = admin.get_autonomy_settings()
        labels = {
            "contenuti_ricorrenti": "Contenuti ricorrenti (chiusure, orari festivi)",
            "recensioni_positive": "Risposte a recensioni positive",
            "promozioni": "Promozioni",
            "advertising": "Advertising a pagamento",
        }
        for category in admin.AUTONOMY_CATEGORIES:
            enabled = st.checkbox(
                labels.get(category, category), value=autonomy.get(category, False), key=f"autonomy_{category}"
            )
            if enabled != autonomy.get(category, False):
                admin.set_autonomy(category, enabled)
                storage.log_audit(user["username"], "autonomy_changed", {"category": category, "enabled": enabled})
                st.rerun()

    with sub3:
        st.markdown("#### Interruttore di arresto generale (RF-11.4)")
        st.caption("Raggiungibile in pochi tocchi: ferma ogni pubblicazione automatica.")
        paused = admin.is_system_paused()
        if paused:
            st.error("🛑 Sistema IN PAUSA: nessuna pubblicazione automatica in corso.")
            if st.button("Riattiva sistema"):
                admin.set_system_paused(False)
                storage.log_audit(user["username"], "system_resumed")
                st.rerun()
        else:
            st.success("✅ Sistema attivo")
            if st.button("🛑 Ferma tutto"):
                admin.set_system_paused(True)
                storage.log_audit(user["username"], "system_paused")
                st.rerun()

    with sub4:
        st.markdown("#### Monitor costi (RF-11.5)")
        st.caption("Tetti e allarmi per ogni categoria di spesa (AI, servizi esterni, advertising).")

        cost_category = st.selectbox("Categoria di spesa", admin.COST_CATEGORIES, key="admin_cost_category")
        cost_amount = st.number_input("Importo (€)", min_value=0.0, step=0.5, key="admin_cost_amount")
        cost_note = st.text_input("Nota", key="admin_cost_note")
        if st.button("Registra costo"):
            admin.record_cost(cost_category, cost_amount, cost_note)
            st.success("Costo registrato.")
            st.rerun()

        st.markdown("**Totali mese corrente per categoria**")
        totals = admin.get_monthly_costs()
        thresholds = admin.get_cost_thresholds()
        for category, total in totals.items():
            threshold = thresholds.get(category, admin.DEFAULT_MONTHLY_THRESHOLD)
            status = "🔴" if total > threshold else "🟢"
            st.text(f"{status} {category}: €{total:.2f} / €{threshold:.2f}")

        alerts = admin.get_cost_alerts()
        if alerts:
            for a in alerts:
                st.warning(f"Soglia superata per '{a['category']}': €{a['total']:.2f} > €{a['threshold']:.2f}")


def home_view(user, brands):
    st.markdown("## Bentornato/a 👋")
    st.caption(
        "In alto ciò che serve decidere ora, poi come sta andando: pensato per essere "
        "letto in pochi secondi da telefono (RF-12.1)."
    )

    pending_content = len(storage.list_contents(state="proposto"))
    pending_reviews = len(reviews.list_reviews(state="bozza_pronta"))
    cooling_restaurants = len([r for r in restaurants.list_restaurants_by_priority() if r["cooling"]])
    cost_alerts = len(admin.get_cost_alerts())

    st.markdown("### ✅ Cosa devi fare")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Contenuti da approvare", pending_content)
    col2.metric("Recensioni da gestire", pending_reviews)
    col3.metric("Ristoranti in raffreddamento", cooling_restaurants)
    col4.metric("Allarmi costi", cost_alerts)

    if admin.is_system_paused():
        st.error("🛑 Il sistema è in pausa: nessuna pubblicazione automatica in corso.")

    st.markdown("---")
    st.markdown("### 📈 Come sta andando")
    summary = analytics.brand_summary(brand=None)
    col5, col6, col7 = st.columns(3)
    col5.metric("Voucher emessi (tutti i marchi)", summary["vouchers"]["total"])
    col6.metric("Tasso di riscatto", f"{summary['vouchers']['redemption_rate_pct']}%")
    col7.metric("Contatti raccolti", summary["contacts"]["total"])

    st.markdown("---")
    st.markdown("### Marchi attivi")
    pills = " ".join(brand_pill(b) for b in brands)
    st.markdown(pills, unsafe_allow_html=True)


def main():
    st.set_page_config(page_title="Regìa Prototype", layout="wide", page_icon="🎛️")
    inject_css()

    if "user" not in st.session_state:
        login_view()
        return

    user = st.session_state["user"]
    sidebar_user_info(user)

    st.sidebar.markdown("### Naviga")
    labels = [f"{icon}  {name}" for icon, name in PAGES]
    selected = st.sidebar.radio("Sezione", labels, label_visibility="collapsed", key="nav_selection")
    page_name = selected.split("  ", 1)[1]

    brands = admin.get_brands()

    if admin.is_system_paused() and page_name != "Home":
        st.error("🛑 Sistema in pausa (interruttore di arresto attivo). Vai in Amministrazione per riattivarlo.")

    st.title(f"Regìa — {page_name}")

    if page_name == "Home":
        home_view(user, brands)
    elif page_name == "Crea contenuto":
        content_creation_tab(user, brands)
    elif page_name == "Workflow":
        workflow_tab(user, brands)
    elif page_name == "Calendario":
        calendar_tab(user, brands)
    elif page_name == "Fedeltà":
        loyalty_tab(user, brands)
    elif page_name == "Recensioni":
        reviews_tab(user, brands)
    elif page_name == "Raccolta contatti":
        contacts_tab(user, brands)
    elif page_name == "Rete ristoranti":
        restaurants_tab(user)
    elif page_name == "Pubblicazione":
        publishing_tab(user, brands)
    elif page_name == "Advertising":
        advertising_tab(user, brands)
    elif page_name == "Analytics":
        analytics_tab(user, brands)
    elif page_name == "Amministrazione":
        admin_tab(user, brands)
    elif page_name == "Audit log":
        audit_tab(user)

    st.sidebar.markdown("---")
    st.sidebar.caption(
        "Flusso: login → brief → generazione media → bozza → proposto → "
        "approvato → pubblicato, con audit log."
    )


if __name__ == '__main__':
    main()
