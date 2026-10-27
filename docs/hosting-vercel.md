# Hosting su Vercel — guida di deploy

> Preparazione per il deploy. Non ancora eseguito. Serve a ridurre il tempo
> del primo deploy a <15 min dall'inizio della sessione dedicata.

## Pre-requisiti

- Account Vercel collegato all'account GitHub `A123lny`
- Repo `A123lny/regia` autorizzato come GitHub app Vercel
- Supabase Cloud staging già operativo (lo è: `dmdihsfwjteifvtccssq.supabase.co`)
- Dominio opzionale (es. `regia.sm`) — non necessario per primo deploy

## Setup iniziale (una volta sola)

1. Login https://vercel.com → "Add new project"
2. Importa il repo `A123lny/regia`
3. Framework preset: **Next.js** (rilevato automaticamente)
4. Root directory: `app` (importante: il monorepo ha il Next in `app/`, non in root)
5. Build command: `npm run build` (default Next)
6. Install command: `npm install`
7. Output directory: auto

Il file `app/vercel.json` è già presente e contiene:
- Region `fra1` (Francoforte, vicino a Supabase)
- Cron `/api/publisher/tick` ogni 5 minuti (M05 publisher batch)
- Cron `/api/reviews/fetch` ogni giorno alle 06:00 (M08 fetcher Google Places)

## Environment Variables da impostare

Nel pannello Vercel → Settings → Environment Variables, aggiungi:

### Supabase (obbligatori)

| Nome | Da dove | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.staging` locale | Public, visibile client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.staging` locale | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard Supabase → Project Settings → API | **Server-only**, mai in bundle client |

### Anthropic (AI generation M03/M04)

| Nome | Da dove |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |

**Nota**: la chiave è uscita in un transcript del 17 set, va **rigenerata** prima del primo deploy production.

### Resend (email M05) — opzionale, da attivare per invii reali

| Nome | Da dove |
|---|---|
| `RESEND_API_KEY` | https://resend.com → API Keys |

### Twilio (SMS + WhatsApp M05) — opzionale

| Nome | Da dove |
|---|---|
| `TWILIO_ACCOUNT_SID` | https://console.twilio.com |
| `TWILIO_AUTH_TOKEN` | https://console.twilio.com |
| `TWILIO_WHATSAPP_FROM` | Numero WA sandbox (es. `whatsapp:+14155238886`) |

### Google Places (M08 Recensioni) — da attivare per fetcher reale

| Nome | Da dove |
|---|---|
| `GOOGLE_PLACES_API_KEY` | https://console.cloud.google.com → APIs & Services → Places API enabled → Credentials |

Il cron `/api/reviews/fetch` ogni 06:00 cicla brand con `google_place_id` valorizzato
(settabile in `/marchi` → Modifica → Google Place ID). Senza chiave il cron ritorna 500.
Senza Place ID su un brand, il brand viene saltato (OK per Lenny food).

### Auth guard CRON (consigliato)

Per evitare che gli endpoint cron siano chiamabili da chiunque, servono DUE
secret separati (uno per modulo):

| Nome | Protegge | Da dove |
|---|---|---|
| `M05_CRON_SECRET` | `/api/publisher/tick` (M05 publisher batch) | `openssl rand -hex 32` |
| `CRON_SECRET` | `/api/reviews/fetch` (M08 recensioni) | `openssl rand -hex 32` |

Entrambi gli endpoint verificano l'header `Authorization: Bearer <secret>`.
Vercel Cron lo passa automaticamente se setti i secret nel pannello.
Puoi usare lo stesso valore per entrambe le variabili se vuoi semplificare.

## Primo deploy

Dopo l'import del repo + env vars + `vercel.json` committato:
- Il primo deploy parte automaticamente dall'ultimo commit di `main`
- Build ~3-5 min
- URL assegnato: `regia-<hash>.vercel.app`

## Dopo il deploy

1. **Verifica login**: apri l'URL Vercel → vai su `/login` → login con email+password Owner
2. **Verifica cron**: dopo 5 min, `/api/publisher/tick` deve essere stato chiamato
   almeno una volta. Puoi vedere i logs in Vercel → Deployments → Functions.
3. **Verifica QR code da smartphone**: scansiona un QR da `/iscrizioni` →
   dovrebbe aprire la landing pubblica su Vercel (non più localhost)
4. **Verifica performance**: Lighthouse score Home + landing pubblica,
   bundle size vs expected

## Dominio custom (opzionale)

In Vercel → Project Settings → Domains → Add `regia.sm` (o altro).
Richiede modifica DNS registrar: aggiungere record CNAME verso `cname.vercel-dns.com`.

## Rollback

Vercel conserva tutti i deployment precedenti. Se un push rompe:
1. Vercel → Deployments
2. Trova l'ultimo deploy stabile
3. Click "..." → "Promote to Production"

Rollback istantaneo.

## Costi

Vercel Hobby (free tier):
- 100 GB bandwidth/mese
- 100 GB-hours serverless function execution
- 100,000 cron invocations/mese (noi usiamo ~8640 al mese = 5min × 60min × 24h × 30gg)

Per Regìa F1 (traffico interno + 50 ristoratori): abbondantemente dentro il free tier.
Upgrade a Pro ($20/mese) solo se arriviamo a volumi reali con molti clienti.

## Checklist pre-deploy

- [ ] Chiave Anthropic rigenerata (RNF-9 rotazione)
- [ ] Env vars Supabase + Anthropic settati
- [ ] CRON_SECRET generato e settato
- [ ] Repo autorizzato in Vercel
- [ ] `app/vercel.json` committato (già fatto)
- [ ] Branch main CI verde (già fatto)
- [ ] Nessun `.env.local` o `.env.staging` committato per sbaglio
