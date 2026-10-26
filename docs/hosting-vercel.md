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

### Auth guard CRON (consigliato)

Per evitare che `/api/publisher/tick` sia chiamabile da chiunque:

| Nome | Da dove |
|---|---|
| `CRON_SECRET` | Genera random: `openssl rand -base64 32` |

Il worker verifica l'header `Authorization: Bearer <CRON_SECRET>`. Vercel Cron
lo passa automaticamente se setti il secret nel pannello.

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
