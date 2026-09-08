# M11 — Amministrazione

Marchi, utenti, ruoli, partner (RF-11.1), audit log (RF-11.3), interruttore di
arresto (RF-11.4, in F1/F2), monitor costi (RF-11.5, in F2).

**Interfaccia pubblica:** vedi `public.ts`.

- `getRecentAuditEvents(organizationId, limit?)` — RF-11.3
- tipo `AuditEventRow`

Tutto il resto è privato (`internal/`) e non deve essere importato da altri moduli.
