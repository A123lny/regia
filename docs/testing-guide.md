# Guida ai test — Regìa

> Come funziona la piattaforma modulo per modulo e come verificarla, a mano o
> con Playwright E2E. Aggiornata al 14 ott 2026.

---

## 1. Come girano i test automatici

### 1.1 Stack
- **Vitest** per unit/integrazione (`tests/invariants/`, `tests/ui/`, `tests/boundaries/`)
- **Playwright** per end-to-end UI (`tests/e2e/`), 38 test smoke su 13 moduli
- **dep-cruiser** per confini RS-1 (`npm run boundaries`)

### 1.2 Comandi
```bash
# Suite completa locale
cd app
npm run ci                 # typecheck + lint + prettier + boundaries + vitest
npm run test:e2e           # Playwright E2E, richiede dev:staging up o lo lancia da sé
npm run test:e2e:ui        # Playwright in modalità UI (interattiva, utile per debug)
npm run test:e2e:report    # apre il report HTML dopo un run

# Reset dati staging
ALLOW_SEED=1 npm run seed:demo   # 235 righe + 12 promemoria + 9 segnali abbandono
```

### 1.3 Prerequisiti E2E
- `.env.staging` presente con `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- Owner esistente in Supabase Cloud (default `owner@regia.local`)
- Il setup di Playwright **resetta la password** dell'Owner ad una stringa random generata al momento (mai salvata in repo). Se vuoi una password fissa per debug manuale: `E2E_OWNER_PASSWORD=... npm run test:e2e`. Dopo i test puoi comunque cambiarla via `/impostazioni`.
- Chromium scaricato (`npx playwright install chromium`, una volta sola)

### 1.4 Convenzioni spec
- `tests/e2e/_fixtures/auth.setup.ts` — setup project, logga Owner e salva storageState
- `tests/e2e/_fixtures/db.ts` — client admin Supabase per asserzioni DB
- Un file `.spec.ts` per modulo UI. Smoke-level: carica + heading + bottone primario visibili.
- Script da espandere in futuro per **flow critici** (resolve segnali, approve bozza, issue voucher).

### 1.5 Dove va la copertura smoke oggi
| Modulo | Spec file | Test |
|---|---|---|
| M01 Contatti | contatti.spec.ts | 2 |
| M02 Marchi | marchi.spec.ts | 1 |
| M03 Contenuti | contenuti.spec.ts | 2 |
| M06 Fedeltà | fedelta.spec.ts | 2 |
| M07 Ristoranti | ristoranti.spec.ts | 3 |
| M07 Fornitori | fornitori.spec.ts | 2 |
| M08 Analytics | analytics.spec.ts | 1 |
| M09 Promemoria | promemoria.spec.ts | 3 |
| M09 Anti-abbandono | anti-abbandono.spec.ts | 3 |
| M10 Iscrizioni + landing pubblica | iscrizioni.spec.ts | 2 |
| M11 Impostazioni + audit | impostazioni.spec.ts | 4 |
| M12 Dashboard | dashboard.spec.ts | 3 |
| M13 Governance | governance.spec.ts | 4 |
| Altre pagine (catalogo/ordini/segmenti/campagne/team) | altre-pagine.spec.ts | 5 |

**38 test E2E** oltre a ~232 unit test Vitest.

---

## 2. Come funziona la piattaforma — flow per modulo

### 2.1 Dashboard (M12) — `/dashboard`
**Entry point quotidiano.** Mostra:
- 4 KPI card: Bozze · Scadenze · Oggi · Settimana
- **Task list** unificata con due sezioni:
  - *Segnali di sistema* (auto-generati da m01/m03/m06/m07/m09/m13), read-only con priorità semaforo + link alla pagina dedicata
  - *Task manuali* (CRUD, checkbox per completare, assegnabili ad altri utenti del team)
- Filtri: Tutti · Miei · Assegnati a me · **Completati**
- La tab Completati mostra 3 sezioni: azioni completate (24h da audit log), contatti registrati (24h da partner_activities), task manuali done

**Flow di test manuale:**
1. Vai in `/dashboard`
2. Verifica che il contatore "N aperti" sia > 0 se seed caricato
3. Clicca **Nuovo task**, compila (titolo min 1 char, priorità, opzionale: assegna a, scadenza)
4. Spunta la checkbox per completarlo → va in Completati
5. Clicca su un segnale "cooling partners" (se presente) → si apre uno sheet laterale con lista ristoranti + bottone "Marca come contattato"
6. Compila note + outcome → l'attività finisce in Completati come "Contatti registrati 24h"

### 2.2 Contatti (M01) — `/contatti`
**CRM core.** Lista 30 contatti seedati con filtri su marchio/sorgente/tag.

**Flow:**
1. Lista contatti → clicca un nome → drawer con dossier completo (anagrafica + consensi + veicoli + voucher + ordini)
2. **GDPR**: in `/contatti/[id]/dati-personali` crea una richiesta dati (export/erasure) → scarica JSON dossier
3. **Dedup**: `/contatti/duplicati` mostra gruppi di duplicati rilevati, "Unifica" fonde manualmente
4. Modifica un contatto → verifica che il consenso canale (email/sms/whatsapp) sia rispettato nelle pagine downstream (M05, M09)

### 2.3 Marchi (M02) — `/marchi` + `/marchi/[slug]`
**Brand kit configurabile.** 4 marchi di default: lenny, eni-cafe, officina, stazione.

**Flow:**
1. `/marchi` → clicca un brand → pagina dettaglio
2. Modifica Tone of Voice, Pilastri (drag & drop ordine), Argomenti sensibili, Parole vietate
3. Verifica che le generazioni M03 rispettino i vincoli (pilastro `peso>0.7` più presente nelle bozze)

### 2.4 Contenuti (M03) — `/contenuti`
**Motore editoriale.** 20 bozze seedate.

**Flow critico (sessione guidata):**
1. `/contenuti/sessione` → carosello bozze da approvare
2. Per ciascuna: Approva · Rifiuta (con motivo) · Salta
3. **Approva** → signal "bozze da approvare" sulla home scende di 1
4. In `/contenuti/calendario` trascina una bozza approvata su una data → scheduled
5. In `/contenuti/[slug]` controlla sezione **SEO suggerimenti** (RF-13.7, 6 check euristici)

### 2.5 Fedeltà (M06) — `/fedelta`
**Loyalty + voucher.** 3 offerte + 20 voucher seedati.

**Flow:**
1. **Offerte**: crea una nuova offerta (titolo, template message, reset_mode = annuale/mensile/dopo_premio/mai)
2. **Emetti voucher**: scegli offerta + contatto + attribuisci opzionalmente a un post (RF-9.3)
3. **Riscatta**: inserisci codice voucher → check idempotenza (riscattare 2x deve fallire con "già riscattato")
4. **Scadenze**: voucher con `expires_at` < 10gg → compare in signal `vouchers-expiring`

### 2.6 Ristoranti Lenny (M07) — `/ristoranti`
**Partner delivery.** 5 ristoranti seedati (1 cooling, 1 launching).

**Flow:**
1. Lista con 4 KPI card → clicca ristorante → drawer con 5 sezioni:
   - Anagrafica (indirizzo, categoria, telefono)
   - Attività (log chiamate + outcome)
   - Errori consegna (RN-28, soglia 3/mese = allarme)
   - Lancio (RN-48, se launched_at ultimi 30gg → progress bar vs mediana categoria)
   - Report mensile (RN-47, 3 template)
2. **Cooling**: toggle flag + motivo obbligatorio → appare come signal "ristoranti cooling" in home
3. **Log contatto**: textarea note + outcome → appare in Completati come "Contatti registrati 24h"
4. `/ristoranti/mercato` (Owner-only) → analisi categoria vs mediana rete (RN-37/38/39)

### 2.7 Fornitori (M07) — `/fornitori`
**Partner spesa (RF-6a.1).** 3 fornitori seedati.

**Flow:**
1. Nuovo fornitore con 4 livelli coinvolgimento (informed/approves/co_finances/name_veto) + preavviso + note veto
2. Se livello=`approves/name_veto` → promo in M03 che tocca il partner richiede approvazione
3. Workflow approvazione: lista richieste pendenti → Approva/Rifiuta → audit log

### 2.8 Analytics (M08) — `/analytics`
**Insight marketing.**
- Metriche campagne (sent/opened/clicked)
- Attribuzione contenuto → vendita (RF-9.3): tabella "post con voucher attribuiti" + metriche copertura
- Nessun data entry: solo lettura.

### 2.9 Promemoria (M09) — `/promemoria`
**Motore retention.** 12 reminder seedati (8 pending + 2 sent + 2 dismissed) su 7 kinds.

**Flow:**
1. KPI: Da fare oggi · Prossimi 7 giorni · Inviati 30gg · Ignorati 30gg
2. Filtra per marchio/tipo/stato
3. Per ogni riga (azioni Owner):
   - **Invia ora** → scatena invio reale via M05 publish adapter (richiede canali configurati)
   - **Segna inviato** → cambia status senza invio (per gestioni manuali)
   - **Ignora** → dismiss
4. **Ricalcola segnali** (bottone alto dx) → l'engine M09 scansiona `brand_orders`/`contact_vehicles`/`vouchers` e crea nuovi pending idempotenti

### 2.10 Anti-abbandono (M09) — `/anti-abbandono`
**Detector RN-40.** 9 segnali seedati (8 attivi + 1 risolto).

**Flow:**
1. Tabella con priorità (high/medium/low) + kind (skipped_week/dropped_frequency/silence_gap/inactivity)
2. Per ciascun segnale: **Risolvi** con motivo obbligatorio ≥3 char
3. **Ricalcola segnali** → l'engine scansiona ordini e genera nuovi `inactivity` per contatti con ultimo ordine > 60gg
   - Nota: può creare molti segnali auto-generati. Lancia `npm run seed:demo` per ripulirli e tornare a baseline nota.

### 2.11 Iscrizioni (M10) — `/iscrizioni` + landing `/iscriviti/[slug]`
**Signup QR → landing → contatto nel CRM.** 2 landing seedate (benvenuto-lenny, stazione-bar).

**Flow:**
1. `/iscrizioni` (Owner view): lista landing con slug, headline, offerta benvenuto
2. Pubblica (senza auth): visita `/iscriviti/benvenuto-lenny` → form email + opzionale WhatsApp + consenso
3. Submit → contatto creato in M01 con `source='qr'`, consensi registrati, reminder "welcome" scheduled

### 2.12 Impostazioni (M11) — `/impostazioni`
Hub config:
- **Memoria agente** (RA-8.11): snapshot approval rate per topic, keyword rifiuti, esiti promo, preferenze stile per brand
- **Provider media** (RF-4.3): registrazione provider esterni AI con ToS, rights_holder, allowed_uses, restricted_sectors
- **Ricorrenze**: eventi annuali ricorrenti per autoposting
- **Canali di invio**: credenziali Resend / Twilio sandbox
- **Audit log** `/audit`: tutte le azioni dell'org (append-only, filtrabile)

### 2.13 Governance (M13) — `/governance`
Regole hard del business:
- **Advertising** `/governance/advertising`: budget per marchio × categoria, enabled OFF default, request-overrun workflow
- **Zone consegna** `/governance/zone-consegna`: zone (brand × name × cap_prefixes) + blackout meteo/eventi
- **Capacità rider** `/governance/capacita-rider`: finestre settimanali + richieste slot workflow

---

## 3. Scaletta di test manuale passo-passo

### 3.1 Smoke test completo (10 min)
Prima di ogni deploy di una feature grossa:

1. `npm run test:e2e` → 38 test devono passare
2. `cd app && npm run ci` → verde (typecheck + lint + boundaries + vitest)
3. Login manuale su `/login` con la password che hai in `/impostazioni` (il setup E2E usa una random non ri-usabile)
4. Dashboard: la task list carica con ≥ 1 segnale di sistema
5. Clicca ciascuna voce della sidebar → ciascuna pagina deve rispondere entro 2s

### 3.2 Flow critici (30 min, prima di una release)

**A) Ciclo bozza completo (M03)**
1. Nuova bozza (`/contenuti/sessione` o manuale)
2. Approva → check signal "bozze da approvare" scende
3. Programma su calendario → status `scheduled`
4. Attendi/forza esecuzione → status `published` (richiede M05 canali configurati)
5. Verifica che compaia in Completati come "Programmata pubblicazione"

**B) Loyalty + attribuzione (M06 + M08)**
1. Crea offerta → emetti voucher attribuito a una bozza pubblicata
2. Riscatta voucher (success)
3. Prova a riscattare 2× (fail con "già riscattato")
4. Vai in `/analytics` → verifica tabella attribuzione

**C) Promemoria + anti-abbandono (M09)**
1. `/promemoria` tab Pending → "Ignora" un reminder → check Completati home → "Ignorato promemoria · <kind>"
2. "Segna inviato" un reminder → check Completati → "Segnato come inviato · <kind>"
3. `/anti-abbandono` → "Risolvi" un segnale → check Completati → "Risolto segnale abbandono"
4. "Ricalcola" su una delle due pagine → verifica che non lancia errori

**D) Partner delivery (M07)**
1. Apri un ristorante cooling → "Marca come contattato" dal task home → compila form
2. Vai in `/ristoranti` → scheda → check "Attività" ha la riga nuova
3. Registra errore consegna → 3 errori in 30gg = badge allarme

**E) GDPR (M01)**
1. Scegli un contatto → `/contatti/[id]/dati-personali` → "Richiedi export"
2. Attendi → scarica JSON dossier
3. "Richiedi erasure" → check che il contatto venga archiviato + anagrafica nullificata

**F) Governance (M13)**
1. `/governance/advertising` → attiva budget per Lenny / categoria food
2. Simula sforamento → richiesta overrun → Owner approva/rifiuta
3. `/governance/zone-consegna` → nuova zona Lenny con CAP + crea blackout → verifica che una promo food fallisca durante il blackout

### 3.3 Flow pubblici (senza auth)
1. Apri browser incognito → vai su `/iscriviti/benvenuto-lenny` → form carica senza login
2. Compila email → check creazione contatto in `/contatti`
3. Apri email di welcome → clicca link unsubscribe → `/u/<token>` → check revoca consenso + check dashboard home mostra alert "pressione commerciale alta" se > 50% motivi

### 3.4 Verifica DB post-test
Script di diagnostica utili:
```bash
# Stato segnali abbandono
npx dotenv -e .env.staging -- tsx scripts/check-abandonment.ts

# Owner e profili
npx dotenv -e .env.staging -- tsx scripts/check-owner.ts
```

---

## 4. Cosa NON copriamo oggi (e come aggiungerlo)

### 4.1 Flow deep E2E
Oggi i test E2E sono smoke-level (page loads + bottoni primari). Per aggiungere test di flow completo:
- Isolare l'azione in un `test(...)` dedicato
- Usare `getAdmin()` da `_fixtures/db.ts` per pre-condizioni e asserzioni DB
- Cleanup a fine test (ripristina stato o UUID random non collidente)

Esempio template:
```typescript
test("Approva bozza -> status=approved + audit event scritto", async ({ page }) => {
  const admin = getAdmin();
  // Pre: crea bozza draft via admin
  const { data: draft } = await admin.from("content_drafts").insert({...}).select().single();

  // Act: UI click Approva
  await page.goto(`/contenuti/${draft.slug}`);
  await page.getByRole("button", { name: "Approva" }).click();

  // Assert: DB
  const { data: after } = await admin.from("content_drafts").select("status").eq("id", draft.id).single();
  expect(after?.status).toBe("approved");

  // Cleanup
  await admin.from("content_drafts").delete().eq("id", draft.id);
});
```

### 4.2 Visual regression
Nessun pixel-perfect check. Se serve, aggiungere `toHaveScreenshot()` di Playwright (richiede baseline committate).

### 4.3 Performance budget
Playwright può misurare tempi di navigazione; oggi non attivo. Da aggiungere quando il prodotto va in produzione.

### 4.4 Flow M05 publish con canali reali
Richiede Resend + Twilio sandbox configurati. Da attivare come `test:e2e:integration` separato (gated da env `RUN_INTEGRATION=1`).

---

## 5. Troubleshooting rapido

| Sintomo | Causa probabile | Fix |
|---|---|---|
| `auth.setup` fallisce con "Owner non trovato" | Email Owner diversa | `E2E_OWNER_EMAIL=... npm run test:e2e` |
| Test di una pagina fallisce con "element not found" | Il seed non ha dati per quella entità | `ALLOW_SEED=1 npm run seed:demo` |
| Playwright timeout su webServer | Server non parte in 2min | Lancialo prima a mano: `npm run dev:staging` in un terminale separato |
| "Password reset" ma login UI fallisce | Server usa cache utente | riavvia `dev:staging` |
| 404 su `/iscriviti/<slug>` | slug landing non seedato | check `signup_landings` in DB o rilancia seed |
