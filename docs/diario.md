# Diario di bordo — Regìa

> Aggiornato: 3 ottobre 2026 · Una pagina al massimo. Le voci vecchie si potano:
> la storia completa sta in git. Regole d'uso: vedi CLAUDE.md, sezione "Rito di sessione".

## Adesso

- **Audit v1.5 — 6 P1 chiusi oggi (3 ott):** RF-6.18+RN-41..43 capacita rider, RF-1.9
  richieste dati personali GDPR, RA-8.11 UI memoria agente, RN-52 zone consegna
  variabili, RF-6a.1 partner con livello coinvolgimento, RF-4.3 provider media esterna
  (ToS/diritti). Branch `main` HEAD `4d61672`, 6 commit nuovi, tutti pushati.
  Supabase Cloud allineato (4 migrazioni 20261003 + 20260914 catchup).
  Docker Desktop locale non funzionante — workflow Cloud-only.
- **Fix di sicurezza sistematico:** aggiunto helper `assertEntityOwnedByOrg` in
  m13-governance per prevenire IDOR cross-tenant (11 action protette), stesso
  pattern applicato a RF-1.9 (requireOwnedContact + req.contactId server-side invece
  che client-supplied).
- **Prossimo:** smoke test M05 end-to-end su Cloud (Resend+Twilio reali), oppure
  continuare audit v1.5 con P2 restanti.

## Fatto

- **3 ott 2026 — RF-4.3 Provider media esterna (ToS/diritti verificati).**
  Pre-condizione per generazione AI esterna (fal.ai, Replicate, DALL-E): tabella
  `media_providers` con slug unico per org, enum rights_holder (user/provider/
  shared/public_domain), allowed_uses check (commercial/editorial/personal),
  restricted_sectors text[] con lista comune (tabacco/alcool/armi/politica/...).
  Repo + action upsert/archive, 2 capability Owner-only, UI /impostazioni/provider-media
  con tabella + sheet form. Guard `hasActiveProviderForUse` per quando si collega
  provider reale. In F1 M04 usa solo template interni: questa infrastruttura dorme.
- **3 ott 2026 — RF-6a.1 Partner come entita configurabile.** Esteso supply_partners
  con involvement_level enum (informed/approves/co_finances/name_veto), advance_notice_days,
  veto_notes. Nuova tabella `partner_approval_requests` con workflow approve/reject,
  due_at calcolato da advance_notice_days. UI /fornitori con 4 radio card livello +
  preavviso + textarea veto condizionale.
- **3 ott 2026 — RN-52 Zone consegna variabili (clima/eventi).** 2 tabelle:
  delivery_zones (brand × name × cap_prefixes[]) + delivery_zone_blackouts (kind:
  snow/rain/event/road_closure/other, start_at + end_at nullable, closed_at). Guard
  `isContactInBlackoutZone` + `assertDeliveryZonesOk` per promo food. UI /governance/
  zone-consegna con banner rosso attivo + inline Blackout button. Fix di sicurezza
  sistematico: `assertEntityOwnedByOrg` applicato a 11 action m13-governance (brandId
  /zoneId/draftId/campaignId/windowId) per prevenire IDOR cross-tenant.
- **3 ott 2026 — RA-8.11 UI memoria agente.** Pagina Owner-only /impostazioni/memoria-agente
  con 4 sezioni: approval rate per topic (Candidata L2 quando >= 10 draft e >= 90%),
  keyword cloud motivi rifiuto, esiti promo (voucher issued/redeemed con color coding),
  preferenze stile per brand (pilastri con peso + forbidden count + sensitive count).
  Read-only, aggrega da content_drafts/vouchers/brand_pillars. Nessun dato scritto.
- **3 ott 2026 — RF-1.9 Richieste dati personali GDPR (quick win legale).**
  Dossier contatto completo (anagrafica + consensi + veicoli + voucher + ordini +
  signup events + reminders + publishLog + previous requests), download JSON client-side.
  Tabella `contact_data_requests` con request_type (export/erasure) + status
  (received/in_progress/fulfilled) + dossier_snapshot jsonb per audit. UI /contatti/
  [id]/dati-personali Owner-only. Fix sicurezza: IDOR su createContactDataRequestAction
  (requireOwnedContact invece di requireCapability) + fulfillContactDataRequestAction
  (req.contactId server-side invece che client-supplied). Erasure nullifica + archivia.
- **3 ott 2026 — RF-6.18 + RN-41/42/43 Capacita rider Lenny.** Finestre
  settimanali per weekday+timeOfDay+totalSlots, guard pre-promo food che blocca
  se slots_filled >= total. Richieste rider quantificate (slots_needed) con workflow
  open/filled/cancelled, Lenny decide se accettare prima di proseguire promo.
  Bloccante architetturale per attivare motori food.
- **2 ott 2026 — Push su GitHub + fast-forward di main.**
  160 commit da 2162e6d a 915fdd3 applicati a main. Niente PR formale (single dev,
  branch divergenza zero). Catchup prettier + rimozione public-actions.ts barrel orfano.
- **2 ott 2026 — M13 Advertising RF-13.1..13.4+13.6 (motore promo con tetti spesa).**
  advertising_budgets (brand × categoria, enabled default OFF sempre),
  advertising_spend_ledger (actual + estimated), advertising_overrun_requests (RF-13.6
  motivazione min 20 char + decisione mai automatica Owner-only). 6 capability nuove.
- **2 ott 2026 — RN-64..67 unsubscribe flow completo.** Token one-time + landing
  /u/[token] con revoca pre-render, motivo opzionale + reduce_frequency, propagazione
  cross-canale, banner dashboard "pressione commerciale alta" (>= 50% motivi
  "too_many_messages" e >= 3 revoche negli ultimi 30gg). Footer unsubscribe auto in email.
- **2 ott 2026 — RN-62 bulk send protection M07 campagne.** campaign-launcher con
  preview destinatari + sample 3 + invio di prova + launch scaglionato (batch 100,
  pausa 10min). Transizione draft→sending→cancelled.
- **2 ott 2026 — M10→M05 welcome + M06→M09 voucher-expiring + M09→M05 adapter.**
  Primo flusso event-driven reale: signup → reminder scheduledAt=now → sendReminderNow
  → M05 enqueue → worker invia. Mapping reminder.kind → canale deterministico.
- **29 set - 2 ott 2026 — M05 Publishing v1 (14 task, 17 commit).** 5 tabelle DB
  + RLS, 4 capability publishing.*, PublishAdapter interface (RS-2) + Resend/Twilio
  concreti, repo con Vault, publish-jobs claimBatch SKIP LOCKED, 6 gate (consent/
  recipient-matches/channel/quiet-hours/pressure/budget), worker tickBatch con retry
  backoff → DLQ, UI /impostazioni canali, 7 test invariante, pg_cron per Cloud.
- **29 set 2026 — Supabase Cloud staging attivato.** `regia` Frankfurt Free, 43 migrazioni
  pushate, Owner creato, .env.staging gitignored, dev:staging/build:staging aggiunti.
- **23-25 set 2026 — Rush F1 commerciale skeleton (11 commit ordinati).**
  M01 data-hub + dedup RF-1.7, M06 loyalty, M07 outreach + partners, M09 reminders +
  anti-abbandono, M10 signup, M13 governance, M08 analytics. 24 migrazioni, 212 test.
- **22-23 set 2026 — Blocchi A-F (M3/M4/M11/M2/M12/topic+UTM).** 13 migrazioni,
  31 nuovi test, UI design refresh (hero blob, metric cards animate, brand card parallax).
- **18 set 2026 — F1.5b-α Workflow scheduled+published + calendario bisettimanale drag&drop.**
- **16-17 set 2026 — F1.5a M3 motore editoriale (generazione singola) + hotfix RNF-9.**
- **14 set 2026 — F1.2 M2 brand kit editabile + F1.1 layout UI/shell.**
- **7-8 set 2026 — Cantiere F0 locale completato:** repo, Next.js+TS strict, Supabase
  locale, invarianti DB (RS-3), audit log append-only, auth Owner+MFA-ready, CI 8/8.
- **18 ago 2026 — Capitolato v1.5:** generazione media aperta a servizi esterni (RF-4.5),
  materiali offline (RF-4.7), RS-2 aggiornato.
- Voci precedenti: cronologia in git.

## Prossimo (in ordine)

1. **Smoke test M05 end-to-end su Cloud staging**: account Resend/Twilio di prova,
   API keys nella UI, invio manuale a se stesso. Richiede abilitare `vault` schema
   nel Dashboard Supabase Cloud.
2. **Continuare audit v1.5**: scansione P2 restanti dopo i 6 P1 di oggi.
3. **Connettori M1 reali verso gestionali** Lenny/Stazione (SQL diretto vs API).
   Prerequisito per test end-to-end con dati veri invece dei seed.
4. **M08b Email assistenza** (info@/help@) routing semi-autonomo, bassa priorita.
5. **F0-b hosting** ancora aperto (§15.A): DigitalOcean App Platform vs Droplet,
   Supabase Pro, GitHub Actions, 2FA reale, backup cifrato remoto.
6. **Docker Desktop locale**: non funzionante dopo WSL2/Hyper-V toggles e PC restart.
   Decidere se escluderlo definitivamente (workflow Cloud-only funziona) o reinstallare.

## Decisioni prese in corso d'opera

- **3 ott 2026 — IDOR cross-tenant: pattern di prevenzione centrale.**
  `assertEntityOwnedByOrg(table, id, organizationId, humanName)` in m13-governance
  come helper riutilizzabile. Qualsiasi action che accetta un entityId esterno DEVE
  verificare ownership prima di qualunque update. Introdotto dopo audit security
  che ha trovato 11 action vulnerabili. Stesso pattern applicato a RF-1.9
  (requireOwnedContact + lookup server-side della request contactId).
- **3 ott 2026 — Docker Desktop locale escluso dallo workflow.** Dopo WSL2 toggle,
  Hyper-V switch, task manager kills e PC restart tutti falliti, workflow diventa
  Cloud-only: `npx supabase db push --linked` funziona, typecheck/lint/prettier/
  boundaries tutti verdi. I test vitest girano senza Docker. Da riconsiderare solo
  se serve supabase local reset per debugging migrazioni intricate.
- **23 set 2026 — Rendering template PNG server-side accettato in dev**
  (satori + @resvg/resvg-js, ~2MB, bloccante 500-2000ms). Produzione: coda BullMQ (RS-4).
- **23 set 2026 — Full-text search archivio con `ilike` invece di tsvector.**
  L'indice GIN italian predisposto ma non usato: overkill per volumi F1 (<10k drafts).
- **23 set 2026 — Topic classifier heuristico deterministico invece che AI-based.**
  Motivo: zero costo, zero latenza, comportamento predicibile. Manual override sempre.
- **7 set 2026 — Prototipo Streamlit conservato come riferimento**, isolato su branch.
- **7 set 2026 — Nuova piattaforma in `app/`** dentro lo stesso repo (§9.1 monolite).
- **18 ago 2026 — Generazione media AI aperta ai servizi esterni** (v1.5):
  restano RN-72 (no dati inventati), autorizzazione terzi bloccante (Eni), RS-2 adapter.
- **14 ago 2026 — Stack: Supabase + BullMQ/Upstash Redis + Next.js monolite.**
  n8n escluso (fuori RS-1 + RA-8.5).

## Da non dimenticare

- Il QR alla colonnina è **l'unica voce con scadenza di calendario** (picco agosto).
- La deroga RF-6.25 è **dormiente**: al lancio si implementa solo il Modello A.
- **Hosting applicazione ancora aperto** (App Platform vs Droplet su DigitalOcean).
- **Rotare la chiave Anthropic in `app/.env.local`** (finita nel transcript Claude
  Code del 17 set): console.anthropic.com → API Keys → rigenera → sostituisci.
- **Credito Anthropic esaurito** durante tour manuale M4-γ: ricaricare prima di
  riprendere test end-to-end sui percorsi AI (≥$5 basta per il tour).
- **UTM tagging oggi è solo preview.** Applicazione effettiva nei publisher adapter
  di M14 (auto-publishing), quando arriverà. Utility già pronta.
- **`npm run ci` step 4/6 (dep-cruiser CLI)** fallisce su node 20 (richiede 22+).
  Il controllo RS-1 equivalente gira via `tests/boundaries/*.test.ts` ed è verde.
- **Docker Desktop locale non funzionante** → workflow Cloud-only, test vitest OK
  senza, migrazioni via `npx supabase db push --linked`.
