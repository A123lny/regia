# Inventario funzioni — refactor UI «da 25 voci a 5 aree»

Ultimo aggiornamento: 2026-11-23. Pre-refactor (snapshot su `main` commit `0a70861`).

**Regola di accettazione**: ogni riga di questo file deve avere la nuova posizione nella colonna *Dove va dopo*. Nessuna funzione viene eliminata.

**Legenda aree nuove**:
- **O** = Oggi (`/oggi`)
- **CT** = Contenuti (`/contenuti`)
- **CL** = Clienti (`/clienti`)
- **RT** = Rete (`/rete`)
- **IM** = Impostazioni (`/impostazioni`)

---

## 1. Route attuali → nuova posizione

### 1.1 Pagine autenticate (`app/(protected)/`)

| Route attuale | Cosa fa | Dove va dopo | Nuova URL / scheda |
|---|---|---|---|
| `/dashboard` | Home: KPI + task urgenti + ricorrenze + banner backup/env | **O** | `/oggi` (home rifatta, Fase 2) |
| `/contenuti` | Hub marchio: Calendario/Piano/Corsia veloce/Nuovo + lista bozze filtrate per status | **CT** | `/contenuti` (default: scheda "Da approvare") |
| `/contenuti?status=draft` | Lista bozze pending | **CT** | `/contenuti` scheda "Da approvare" |
| `/contenuti?status=approved` | Lista bozze approvate | **CT** | `/contenuti` scheda "In calendario" |
| `/contenuti?status=scheduled` | Programmate | **CT** | `/contenuti` scheda "In calendario" |
| `/contenuti?status=published` | Pubblicate | **CT** | `/contenuti` scheda "Pubblicati" |
| `/contenuti?status=rejected` | Rifiutate | **CT** | `/contenuti` scheda "Rifiutati" |
| `/contenuti/archivio` | Lista storica con filtri (brand, date, topic, autore) | **CT** | `/contenuti` scheda "Archivio" (filtri attuali invariati) |
| `/contenuti/sessione` | Wizard approva/rifiuta sequenziale | **CT** | `/contenuti` scheda "Da approvare" → bottone "Sessione di revisione" |
| `/contenuti/calendario` | Calendario cross-brand 14gg | **O** + **CT** | `/oggi` (vista giorno + 14gg) + link anche in `/contenuti` scheda "In calendario" |
| `/contenuti/calendario/[date]` | Vista giorno + drag&drop | **O** | `/oggi/giorno/[date]` |
| `/contenuti/[slug]` | Hub brand (bottoni Calendario/Piano/Corsia/Nuovo + lista bozze del brand) | **CT** | `/contenuti?marchio=slug` (filtro via selettore globale) |
| `/contenuti/[slug]/calendario` | Calendario per brand | **CT** | `/contenuti?marchio=slug` scheda "In calendario" |
| `/contenuti/[slug]/nuovo` | Form "Nuovo contenuto" (textarea + genera) | **CT** | `/contenuti/nuovo?marchio=slug` (anche link da home Oggi) |
| `/contenuti/[slug]/servizio` | **Corsia veloce** rinominata | **CT** | `/contenuti/avviso-rapido?marchio=slug` (redirect) |
| `/contenuti/[slug]/piano` | **Piano 14gg** rinominato | **CT** | `/contenuti/pianifica?marchio=slug` (redirect) |
| `/contenuti/[slug]/[draftId]` | Dettaglio bozza (anteprima + approva/rifiuta/schedula) | **CT** | `/contenuti/bozza/[draftId]` (route semplificata) |
| `/promemoria` | Lista promemoria + KPI + filtri | **CL** | `/clienti` scheda "Promemoria" |
| `/anti-abbandono` | **Anti-abbandono** rinominato | **CL** | `/clienti` scheda "Da recuperare" |
| `/recensioni` | Recensioni (vuoto in F1) | **CL** | `/clienti` scheda "Recensioni" |
| `/iscrizioni` | Landing ed eventi signup | **CL** | `/clienti` scheda "Iscrizioni" |
| `/segmenti` | **Segmenti** rinominato | **CL** | `/clienti` scheda "Gruppi" |
| `/campagne` | Campagne email/sms/wa | **CT** | `/contenuti` scheda "Campagne" |
| `/fedelta` | Fedeltà + Voucher + Offerte + Contatori | **CL** | `/clienti` scheda "Fedeltà e voucher" (sub-tabs: Voucher emessi, Riscatta, Offerte, Contatori) |
| `/catalogo` | Catalogo prodotti | **RT** | `/rete` scheda "Catalogo" |
| `/ordini` | Lista ordini | **RT** | `/rete` scheda "Ordini" |
| `/ristoranti` | Ristoranti partner Lenny | **RT** | `/rete` scheda "Ristoranti" |
| `/ristoranti/mercato` | Analisi mercato Lenny | **RT** | `/rete` scheda "Ristoranti" → sub-tab "Analisi mercato" |
| `/fornitori` | Fornitori | **RT** | `/rete` scheda "Fornitori" |
| `/contatti` | Lista contatti cross-brand | **CL** | `/clienti` scheda "Contatti" (sub-tab "Duplicati") |
| `/contatti/duplicati` | Dedup contatti | **CL** | `/clienti` scheda "Contatti" → sub-tab "Duplicati" |
| `/contatti/[id]/dati-personali` | Dossier RF-1.9 | **CL** | `/clienti/contatto/[id]/dati-personali` |
| `/analytics` | Analytics unificato (contatti, ordini, fedeltà, campagne, signup, partner) | **spalmato** | sezione "Andamento" dentro Clienti / Contenuti / Rete |
| `/marchi` | Lista marchi | **IM** | `/impostazioni` scheda "Marchi" |
| `/marchi/[slug]` | Brand kit (tono, pilastri, parole bandite, esempi) | **IM** | `/impostazioni/marchi/[slug]` |
| `/marchi/[slug]/media` | Libreria media per brand | **IM** | `/impostazioni/marchi/[slug]/media` (link anche da `/contenuti`) |
| `/governance` | **Governance** rinominato | **IM** | `/impostazioni` scheda "Regole" |
| `/governance/advertising` | Tetti spesa adv | **IM** | `/impostazioni` scheda "Account e chiavi" → sub-tab "Tetti spesa" |
| `/governance/capacita-rider` | Capacità rider | **IM** | `/impostazioni` scheda "Regole" → sub-tab "Capacità rider" |
| `/governance/zone-consegna` | Zone consegna | **IM** | `/impostazioni` scheda "Regole" → sub-tab "Zone consegna" |
| `/team` | Team membri | **IM** | `/impostazioni` scheda "Team" |
| `/audit` | **Audit log** rinominato | **IM** | `/impostazioni` scheda "Registro attività" |
| `/impostazioni` | Hub impostazioni (profilo, chiavi, env, STOP AI, budget, canali, branding) | **IM** | `/impostazioni` (hub + scheda "Account e chiavi") |
| `/impostazioni/ricorrenze` | Ricorrenze annuali | **IM** | `/impostazioni` scheda "Account e chiavi" → sub-tab "Ricorrenze" |
| `/impostazioni/memoria-agente` | Memoria agente AI | **IM** | `/impostazioni` scheda "Account e chiavi" → sub-tab "Memoria agente" |
| `/impostazioni/provider-media` | Provider media ToS | **IM** | `/impostazioni` scheda "Account e chiavi" → sub-tab "Provider media" |

### 1.2 Pagine pubbliche (NON cambiano)

| Route | Cosa fa | Nota |
|---|---|---|
| `/` | Homepage pubblica | Invariata |
| `/login` | Login | Invariata (redirect a `/oggi` se già autenticato) |
| `/iscriviti/[slug]` | Landing pubblica signup | **Invariata** (QR già stampati) |
| `/u/[token]` | Unsubscribe link | Invariata |
| `/privacy` | Informativa privacy | **Invariata** |

---

## 2. Sidebar attuale (25 voci in 6 gruppi) → nuova

### 2.1 Vecchia (6 gruppi)
- **Operativo quotidiano**: Home · Calendario · Promemoria · Anti-abbandono · Recensioni
- **Marketing**: Contenuti (Bozze · Approvate · Programmate · Pubblicate · Archivio) · Iscrizioni · Segmenti · Campagne
- **Commerciale**: Fedeltà · Catalogo · Ordini · Ristoranti · Fornitori
- **Clienti**: Contatti
- **Insight**: Analytics
- **Configurazione**: Marchi · Governance · Team · Audit log · Impostazioni

Totale: **25 voci**.

### 2.2 Nuova (5 aree)
- **Oggi**: Da fare · Calendario (giorno / 14gg)
- **Contenuti**: Da approvare · In calendario · Pubblicati · Rifiutati · Archivio · Campagne · Andamento + bottoni Nuovo / Avviso rapido / Pianifica settimane / Libreria media / Brand kit
- **Clienti**: Contatti · Promemoria · Da recuperare · Fedeltà e voucher · Iscrizioni · Gruppi · Recensioni · Andamento
- **Rete**: Ristoranti · Fornitori · Catalogo · Ordini · Andamento
- **Impostazioni**: Marchi · Team · Regole · Registro attività · Account e chiavi

Totale: **5 aree**.

**Selettore marchio globale** (nuovo): in cima alla sidebar, dropdown «Tutti i marchi / Lenny / Eni Cafè / Officina / Stazione», persistito in cookie `regia_brand` o query `?marchio=slug`. Tutte le pagine leggono il filtro.

**Mobile**: bottom-bar `Oggi · Contenuti · Clienti · Rete · Altro`. "Altro" apre `/impostazioni` e profilo.

---

## 3. Rinominazioni (Fase 4)

| Vecchio | Nuovo |
|---|---|
| Home (dashboard) | **Oggi** |
| Corsia veloce | **Avviso rapido** |
| Piano 14gg | **Pianifica settimane** |
| Anti-abbandono | **Da recuperare** |
| Segmenti | **Gruppi** |
| Governance | **Regole** |
| Audit log | **Registro attività** |
| cooling / raffreddamento | **Da risentire** |
| HIGH / MEDIUM / LOW | **Alta / Media / Bassa** (già fatto pack 8) |
| issued / redeemed / cancelled / expired | **Emesso / Riscattato / Annullato / Scaduto** (già via `VOUCHER_STATUS_LABELS`) |
| `contattato_e_tornato` et al. | **"Contattato, è tornato"** (già via `formatResolvedReason`) |

---

## 4. Server actions — raggruppate per area (devono restare raggiungibili)

### 4.1 M01 Data Hub → principalmente **Clienti** / **Rete**
Contatti: `createContactAction`, `updateContactAction`, `archiveContactAction`, `restoreContactAction`, `upsertConsentAction`, `createVehicleAction`, `updateVehicleAction`, `deleteVehicleAction`, `mergeContactsAction` → **CL / Contatti**.
Dossier RF-1.9: `getContactDossierAction`, `listDataRequestsAction`, `createContactDataRequestAction`, `fulfillContactDataRequestAction` → **CL / Contatto detail**.
Fornitori: `upsertSupplyPartnerAction`, `archiveSupplyPartnerAction`, `restoreSupplyPartnerAction`, `createPartnerApprovalRequestAction`, `recordPartnerApprovalResponseAction` → **RT / Fornitori**.
Catalogo: `createProductAction`, `updateProductAction`, `archiveProductAction`, `restoreProductAction`, `recordPriceChangeAction`, `updateMarginAction` → **RT / Catalogo**.

### 4.2 M02 Brand → **Impostazioni**
Brand CRUD: `createBrandAction`, `updateBrandAction`, `archiveBrandAction`, `restoreBrandAction` → **IM / Marchi**.
Brand kit: `upsertBrandKitAction`, `createBrandPillarAction`, `updateBrandPillarAction`, `deleteBrandPillarAction`, `movePillarAction`, `addBrandForbiddenWord`, `removeBrandForbiddenWord`, `addBrandSensitiveTopic`, `removeBrandSensitiveTopic` → **IM / Marchi / [slug]**.
Social accounts: `upsertBrandSocialAccountAction`, `deleteBrandSocialAccountAction` → **IM / Account e chiavi / Social**.

### 4.3 M03 Editorial → **Contenuti**
Generazione: `generateSocialPost`, `generateServiceCommunication`, `generateEditorialPlan`, `generateRecurrenceDraft` → **CT / bottoni Nuovo / Avviso rapido / Pianifica settimane**.
Workflow: `approveContentDraft`, `rejectContentDraft`, `scheduleContentDraft`, `unscheduleContentDraft`, `rescheduleContentDraft`, `markContentDraftPublished`, `deleteContentDraft`, `updateContentDraftTopicLabel`, `updateContentDraftGeneratedText` → **CT / Da approvare** + detail bozza.

### 4.4 M04 Media → **Impostazioni** (libreria) + **Contenuti** (picker)
`uploadMediaAsset` (via /api/media/upload), `deleteMediaAsset`, `updateMediaAssetCaption`, `updateMediaAssetTags`, `attachMediaAssetToDraft`, `detachMediaAssetFromDraft`, `generateFromTemplate` → **IM / Marchi / [slug] / Media** + link da **CT**.
Provider media: `upsertMediaProviderAction`, `archiveMediaProviderAction` → **IM / Account e chiavi / Provider media**.

### 4.5 M05 Publishing → **Impostazioni**
`updateChannelCredentialsAction`, `setChannelEnabledAction`, `testChannelAction`, `listChannelsAction` → **IM / Account e chiavi / Canali di invio**.

### 4.6 M06 Loyalty → **Clienti / Fedeltà e voucher**
`upsertCounterAction`, `upsertOfferAction`, `issueVoucherAction`, `redeemVoucherAction`, `redeemVoucherByCodeAction`, `cancelVoucherAction` → **CL / Fedeltà e voucher**.

### 4.7 M07 Outreach → **Clienti** (Gruppi) + **Contenuti** (Campagne)
Segmenti/Gruppi: `upsertSegmentAction`, `refreshSegmentAction`, `previewSegmentAction` → **CL / Gruppi**.
Campagne: `upsertCampaignAction`, `markCampaignSentAction`, `cancelCampaignAction`, `previewCampaignRecipientsAction`, `sendCampaignTestAction`, `launchCampaignAction`, `cancelLaunchedCampaignAction` → **CT / Campagne**.

### 4.8 M07 Partners → **Rete / Ristoranti**
`upsertPartnerAction`, `archivePartnerAction`, `logActivityAction`, `toggleCoolingAction`, `recordDeliveryErrorAction`, `getPartnerErrorsAction`, `getLaunchStatusAction`, `updateLaunchNotesAction`, `generateMonthlyReportAction` → **RT / Ristoranti**.

### 4.9 M08 Reviews → **Clienti / Recensioni**
`approveReviewAction`, `markReviewPublishedAction`, `resolveSeriousAction`, `reopenSeriousForDraftAction`, `regenerateDraftAction` → **CL / Recensioni**.

### 4.10 M09 Reminders → **Clienti / Promemoria + Da recuperare**
Promemoria: `dismissReminderAction`, `markReminderSentAction`, `sendReminderNowAction`, `refreshAllRemindersAction`, `scheduleQuoteFollowupAction` → **CL / Promemoria**.
Anti-abbandono → Da recuperare: `detectAbandonmentAction`, `resolveAbandonmentSignalAction` → **CL / Da recuperare**.

### 4.11 M10 Signup → **Clienti / Iscrizioni**
`upsertLandingAction`, `archiveLandingAction` → **CL / Iscrizioni**.

### 4.12 M11 Admin → **Impostazioni / Account e chiavi**
AI budget + kill switch + platform branding (via UI card) → **IM / Account e chiavi**.

### 4.13 M12 Daily Use → **Oggi**
Task manuali: `createTaskAction`, `completeTaskAction`, `reopenTaskAction`, `cancelTaskAction`, `updateTaskAction` → **O / Da fare** (creati, assegnati, completati inline nella lista).

### 4.14 M13 Governance → **Impostazioni / Regole**
Autonomy: `updateAutonomyRuleAction` → **IM / Regole / Autonomia**.
Prodotti a sconto vietato: `toggleProductDiscountForbiddenAction` → **IM / Regole / Prodotti a sconto vietato**.
Advertising: `upsertAdvertisingBudgetAction`, `toggleAdvertisingCategoryAction`, `classifyDraftForAdvertisingAction`, `requestAdvertisingOverrunAction`, `decideAdvertisingOverrunAction` → **IM / Account e chiavi / Tetti spesa** (budget) + **IM / Regole / Pubblicità**.
Rider: `upsertRiderCapacityWindowAction`, `updateRiderCapacityFilledAction`, `deleteRiderCapacityWindowAction`, `createRiderShiftRequestAction`, `fulfillRiderShiftRequestAction`, `cancelRiderShiftRequestAction` → **IM / Regole / Capacità rider**.
Zone: `upsertDeliveryZoneAction`, `deleteDeliveryZoneAction`, `openBlackoutAction`, `closeBlackoutAction` → **IM / Regole / Zone consegna**.
Ricorrenze: `createRecurrence`, `updateRecurrence`, `deleteRecurrence` → **IM / Account e chiavi / Ricorrenze**.

### 4.15 M14 Robot Assistant → ovunque (widget flottante)
`chatAction`, `confirmPendingAction`, `setRobotAccessAction`, `resolveBrandAction` → widget persiste nel layout. `setRobotAccessAction` → **IM / Team**.

---

## 5. Redirect vecchio → nuovo (da configurare in Fase 1)

Tutti con `permanent: true` nel `next.config.ts` (redirect 308):

| From | To |
|---|---|
| `/dashboard` | `/oggi` |
| `/anti-abbandono` | `/clienti?scheda=da-recuperare` |
| `/segmenti` | `/clienti?scheda=gruppi` |
| `/promemoria` | `/clienti?scheda=promemoria` |
| `/recensioni` | `/clienti?scheda=recensioni` |
| `/iscrizioni` | `/clienti?scheda=iscrizioni` |
| `/fedelta` | `/clienti?scheda=fedelta` |
| `/contatti` | `/clienti?scheda=contatti` |
| `/contatti/duplicati` | `/clienti?scheda=contatti&sub=duplicati` |
| `/catalogo` | `/rete?scheda=catalogo` |
| `/ordini` | `/rete?scheda=ordini` |
| `/ristoranti` | `/rete?scheda=ristoranti` |
| `/ristoranti/mercato` | `/rete?scheda=ristoranti&sub=mercato` |
| `/fornitori` | `/rete?scheda=fornitori` |
| `/campagne` | `/contenuti?scheda=campagne` |
| `/contenuti/archivio` | `/contenuti?scheda=archivio` |
| `/contenuti/sessione` | `/contenuti?scheda=da-approvare&modal=sessione` |
| `/analytics` | `/clienti?scheda=andamento` (default, con link cross-area) |
| `/governance` | `/impostazioni?scheda=regole` |
| `/governance/advertising` | `/impostazioni?scheda=account&sub=tetti-spesa` |
| `/governance/capacita-rider` | `/impostazioni?scheda=regole&sub=rider` |
| `/governance/zone-consegna` | `/impostazioni?scheda=regole&sub=zone` |
| `/team` | `/impostazioni?scheda=team` |
| `/audit` | `/impostazioni?scheda=registro` |
| `/marchi` | `/impostazioni?scheda=marchi` |
| `/impostazioni/ricorrenze` | `/impostazioni?scheda=account&sub=ricorrenze` |
| `/impostazioni/memoria-agente` | `/impostazioni?scheda=account&sub=memoria-agente` |
| `/impostazioni/provider-media` | `/impostazioni?scheda=account&sub=provider-media` |
| `/contenuti/[slug]/servizio` | `/contenuti/avviso-rapido?marchio=slug` |
| `/contenuti/[slug]/piano` | `/contenuti/pianifica?marchio=slug` |

Pagine pubbliche (NO redirect): `/`, `/login`, `/iscriviti/*`, `/u/*`, `/privacy`.

---

## 6. Punti su cui chiedo la tua conferma prima di procedere

1. **URL "query-based" per le schede** (`?scheda=da-recuperare`) o **URL vere** (`/clienti/da-recuperare`)? La seconda è più "linkabile" ma raddoppia i redirect. Il mockup non specifica.
2. **Il filtro marchio si sincronizza via cookie o via query**? Suggerisco cookie (`regia_brand`) + opzionale override via `?marchio=slug` nelle URL. Decisione tua.
3. **Gli URL di detail bozza (`/contenuti/[slug]/[draftId]`)**: li semplifichiamo a `/contenuti/bozza/[draftId]` (brand dal DB)? Serve redirect del vecchio pattern.
4. **Analytics splittato in 3 "Andamento"**: i filtri periodo (7/30/90gg) restano per-pagina o globali? Mockup non specifica.
5. **Pagina `/analytics` legacy**: la lasciamo come landing redirect-only o la cancelliamo del tutto? Io propendo per redirect a `/clienti?scheda=andamento` + banner "Analytics è stato spalmato: vedi Andamento in ogni area".
6. **Robottino**: il widget flottante rimane così com'è, posizionato nel layout? Nessun cambio?
7. **Pagina `/contenuti/[slug]` (hub brand)**: oggi è l'entry point marchio-specifico. Diventa `/contenuti?marchio=slug` + selettore globale. Confermi la rimozione dell'URL dedicato?

---

## 7. Criteri di accettazione (riportati alla fine di ogni fase)

- [ ] Ogni riga di questo file ha una destinazione.
- [ ] Vecchie URL fanno 308 → nuove. `/iscriviti/*` e `/privacy` invariate.
- [ ] Selettore marchio filtra tutte le pagine.
- [ ] Home Oggi ha le stesse info dei segnali attuali, con azioni sulle righe.
- [ ] Nessun `window.confirm/prompt` (grep).
- [ ] Nessun codice RF-/RN-/M0x nell'interfaccia (grep testi).
- [ ] Build + lint + test verdi.
- [ ] `<title>` "Nome pagina · Regìa" su tutte.
