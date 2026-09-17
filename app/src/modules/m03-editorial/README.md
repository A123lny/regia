# M03 — Motore editoriale

Modulo per generazione contenuti guidata dall'Owner (RF-3.3) con brand kit
di M02 come contesto e apprendimento da motivi di rifiuto via retrieval
semantico pgvector (RF-3.8).

## Interfaccia pubblica

Vedi `public.ts`. In sintesi:

- **Tipi**: `ContentDraft`, `ContentDraftStatus`, `ContentChannel`.
- **Query (RSC)**: `listContentDraftsByBrand`, `getContentDraft`.
- **Server actions**: `generateSocialPost`, `approveContentDraft`, `rejectContentDraft`.

## Prompt versionati (§9.2)

Vivono in `internal/prompts/*.md`. Ogni edit non compatibile → nuovo file
`<nome>-v<N>.md` + costante `PROMPT_VERSION` in `generate-social-post.ts`.
Il vecchio file resta a scopo storico (i draft passati mantengono il loro
`prompt_version`).

## Dipendenze esterne

- `m02-brand/public` — `getBrandKitWithLists`, `formatBrandContextForAI`
- `lib/ai/anthropic` — `generateText` (RS-2)
- `lib/ai/voyage` — `embedText` (RS-2)
- `lib/db/admin` — `getAdminClient` (RS-2)
- `lib/auth/session` — `getSessionOrRedirect`
- `lib/audit/log` — `logAuditEvent` (RF-11.3)
