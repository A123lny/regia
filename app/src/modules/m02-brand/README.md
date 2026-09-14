# M02 — Marchi e identità

Editing brand kit per marchio: tono di voce (RF-2.3), contesto strategico (RF-2.3a),
rubriche e pilastri (RF-2.4), vincoli redazionali — parole bandite + argomenti
sensibili (RF-2.5). Isolamento per marchio (RF-2.6). Solo Owner in F1.2.

## Interfaccia pubblica (`public.ts`)

### Query (server components)

- `getBrandKitWithLists(brandId): Promise<BrandKitWithLists | null>` — carica tono +
  contesto + rubriche + parole bandite + argomenti sensibili in un unico oggetto.
- `formatBrandContextForAI(brandId): Promise<string>` — genera Markdown pronto
  per essere iniettato come contesto obbligatorio nei prompt AI di M3 (RF-2.3).

### Server actions (form submit)

- Documentate in Task 7 del piano F1.2.

### Tipi

- `BrandKit`, `BrandPillar`, `BrandForbiddenWord`, `BrandSensitiveTopic`,
  `BrandKitWithLists`, `SensitiveTopicKind` (`"claim_vietato" | "revisione_umana"`).

## Note tecniche

- Nessun accesso diretto a SDK Supabase (RS-2). Usa `getAdminClient()` wrapper.
- RLS attiva denial-by-default; service_role bypassa by design.
- Cascade delete: eliminare un brand cancella brand_kit + pillars + forbidden_words + sensitive_topics.
- Fuori scope F1.2: upload logo, color picker, email identity (F1.5+).

Tutto il resto è privato (`internal/`) e non deve essere importato da altri moduli.
