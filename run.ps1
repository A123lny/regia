# Script PowerShell per configurare l'ambiente e avviare il prototipo Streamlit
param()

Write-Host "Creazione virtualenv in .venv (se non esiste)..."
if (-not (Test-Path -Path .venv)) {
    python -m venv .venv
}

Write-Host "Attiva l'ambiente: .\.venv\Scripts\Activate.ps1"
Write-Host "Installa dipendenze: pip install -r requirements.txt"
Write-Host "Avvia Streamlit: streamlit run src/app.py"
