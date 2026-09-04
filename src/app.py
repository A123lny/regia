import streamlit as st
import io
import os
import datetime
import sys

# Assicuriamo che la cartella src sia nel path per importare services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.media_adapter import generate_placeholder


def main():
    st.set_page_config(page_title="Regìa Prototype", layout="centered")
    st.title("Regìa — Prototype (Streamlit)")

    brands = ["Lenny", "Stazione", "Eni Cafè", "Officina"]
    brand = st.sidebar.selectbox("Marca", brands)

    channel = st.sidebar.selectbox("Canale", ["Social (Instagram/Facebook)", "Email", "WhatsApp", "Stampa/Locandina"])

    st.markdown("### Brief / Prompt")
    prompt = st.text_area("Breve descrizione del contenuto", value="Foto del locale / promozione breve...", height=120)

    if st.button("Genera immagine di prova"):
        with st.spinner("Generazione in corso... (stub locale)"):
            img = generate_placeholder(prompt=prompt, brand=brand, size=(1024, 768))
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            st.session_state["last_image"] = buf.getvalue()
            st.success("Immagine generata")

    if "last_image" in st.session_state:
        st.markdown("### Anteprima canale")
        if channel.startswith("Social"):
            st.image(st.session_state["last_image"], width=600, caption="Anteprima Social")
        elif channel == "Email":
            st.image(st.session_state["last_image"], width=520, caption="Anteprima Email")
        elif channel == "WhatsApp":
            st.image(st.session_state["last_image"], width=360, caption="Anteprima WhatsApp")
        else:
            st.image(st.session_state["last_image"], width=1200, caption="Anteprima Stampa/Locandina")

        if st.button("Simula pubblicazione"):
            os.makedirs("logs", exist_ok=True)
            with open("logs/publish.log", "a", encoding="utf-8") as f:
                f.write(f"{datetime.datetime.now().isoformat()} | {brand} | {channel} | prompt:{prompt}\n")
            st.success("Pubblicazione simulata. Vedi logs/publish.log")

    st.markdown("---")
    st.markdown("Questo prototipo dimostra il flusso: brief → generazione media (stub) → anteprima per canale → simulazione pubblicazione.")


if __name__ == '__main__':
    main()
