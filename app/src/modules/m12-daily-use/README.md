# M12 — Uso quotidiano

Home mobile-first "cosa devi fare / come sta andando" (RF-12.1), calendario ricorrenze
(RF-12.4), assenza titolare + delega (RF-12.6), aiuto contestuale (RF-12.7) — in F1.1
esiste solo la stat aggregation per la home.

## Interfaccia pubblica (`public.ts`)

- `getDashboardStats(organizationId): Promise<DashboardStats>` — RF-12.1
- tipo `DashboardStats`
- tipo `Environment` (`"sviluppo-locale" | "staging" | "produzione"`)

## Note tecniche

- I contatori delle "cose da fare" fanno query su tabelle che potrebbero non esistere
  ancora in F0/F1.1 (contents, reviews, restaurants, cost_alerts). Il codice gestisce
  Postgres error 42P01 (undefined_table) ritornando 0 senza throw.
- `lastBackupAt` legge dal filesystem `app/backups/`. In F0-b sarà API Supabase.
- `environment` deriva da `REGIA_ENVIRONMENT` env var, default "sviluppo-locale".

Tutto il resto è privato (`internal/`) e non deve essere importato da altri moduli.
