# Regìa — Prototype (Streamlit)

Prototipo rapido per validare i flussi principali del progetto "Regìa" (MVP iniziale).

Contenuti creati:
- `src/app.py` — prototipo Streamlit: selezione marchio, generazione immagine di prova, anteprime canale, simulazione di pubblicazione.
- `src/services/media_adapter.py` — stub per l'adapter di generazione media (genera immagini di prova locali).
- `requirements.txt` — dipendenze minime.
- `.gitignore` — file di esclusione per ambiente e artefatti.
- `run.ps1` — script PowerShell per creare venv e avviare l'app su Windows.
- `logs/.gitkeep` — directory di log iniziale.

Requisiti:
- Python 3.9+ (consigliato 3.10/3.11)

Istruzioni rapide (PowerShell):

```powershell
# creare virtualenv
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# avviare l'app Streamlit
streamlit run src/app.py
```

Note:
- Questo è un prototipo locale e non include autenticazione, DB o integrazioni esterne.
- L'adapter di generazione media è un stub che genera immagini di prova; sostituirlo con un adapter reale per collegare servizi esterni.

Next steps consigliati:
- Inizializzare git: `git init`, aggiungere `.gitignore`, primo commit.
- Collegare un servizio di generazione media reale tramite `src/services/media_adapter.py` (adapter pattern).
- Implementare DB/Storage e autenticazione per utenti e ruoli.
