// RF-11.3: unico punto di ingresso all'audit log dall'applicazione.
// Nessun modulo funzionale deve scrivere in audit_events tramite altri percorsi.
// L'invariante append-only vive comunque nel DB (RS-3), questo file impone
// solo la disciplina di *cosa* si registra e in quale formato.

import { getAdminClient } from "../db/admin";
import type { AuditEventInput } from "./types";

// Tipo row per l'inserimento — allineato alla tabella audit_events (migrazione _000005_).
// In F1, quando verranno generati i tipi Supabase, questo tipo sarà sostituito
// dall'equivalente generato e il cast potrà essere rimosso.
type AuditEventRow = {
  organization_id: string;
  actor_user_id: string | null;
  actor_kind: string;
  action: string;
  target: string | null;
  details: Record<string, unknown>;
};

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  const admin = getAdminClient();
  const row: AuditEventRow = {
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    actor_kind: input.actorKind,
    action: input.action,
    target: input.target ?? null,
    details: input.details ?? {},
  };
  // Il cast è necessario finché non esistono tipi Supabase generati (F1).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await admin.from("audit_events").insert(row as any);
  if (error) {
    // Un errore di logging non deve mascherare un errore di dominio, ma
    // nemmeno passare in silenzio. Rilanciamo: chi chiama decide se
    // trattarlo come critico (per azioni sensibili) o assorbibile.
    throw new Error(`audit log failed: ${error.message}`);
  }
}
