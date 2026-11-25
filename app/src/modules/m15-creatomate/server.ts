// M15 Creatomate — barrel SERVER-ONLY (RS-1 split).
// Ciò che ha `import "server-only"` (o che non può finire nel bundle client)
// vive qui. Route handler e cron job importano da qui. I client components
// importano SOLO da ./public.ts.

export { applySucceededRenderByExternalId } from "./internal/apply-succeeded";
