-- F1.5a — Motore editoriale: RLS denial-by-default (RS-3, RN-87).
-- In F1.5a l'accesso alle content_drafts passa ESCLUSIVAMENTE da server actions
-- del modulo m03-editorial, che usano requireOwnedBrand/requireOwnedDraft (RN-87)
-- e getAdminClient (service_role, RS-2). Nessun authenticated client legge diretto.
-- F1.3 introdurrà policy select scoped-per-organization quando arriverà l'Editor.

alter table content_drafts enable row level security;

revoke all on content_drafts from anon, authenticated;
grant all on content_drafts to service_role;

-- Nota: NON aggiungiamo policy for select/insert/update per authenticated in F1.5a.
-- Il fetching in UI passa da RSC che chiama server functions con getAdminClient.
