// M12 Daily-Use — Recent completions: aggrega gli eventi di audit che
// corrispondono alla "chiusura" di un task operativo visibile nella home,
// per mostrarli nella tab "Completati" al fianco dei task manuali.
//
// Mappiamo solo un allowlist di action -> label leggibile. Azioni fuori
// lista non appaiono (il log integrale sta in /impostazioni/audit).

import { getAdminClient } from "@/lib/db/admin";

export type RecentCompletion = {
  id: string;
  action: string;
  label: string;
  target: string | null;
  occurredAt: string;
  details: Record<string, unknown>;
};

// Allowlist: action audit -> label italiano mostrato in dashboard.
// Mappiamo le azioni che chiudono i segnali auto-generati (RF-12.1):
// bozze (M03), abbandoni (M09), partner (M07 gia' coperto via activities),
// voucher (M06), advertising (M13), richieste materiali (M03), zone (M07).
const ACTION_LABELS: Record<string, string> = {
  // M03 Editorial — ciclo bozza
  "editorial.draft_approved": "Approvata bozza",
  "editorial.draft_rejected": "Rifiutata bozza",
  "editorial.draft_scheduled": "Programmata pubblicazione",
  "editorial.draft_rescheduled": "Riprogrammata pubblicazione",
  "editorial.draft_unscheduled": "Annullata programmazione",
  "editorial.draft_deleted": "Eliminata bozza",
  "editorial.recurrence_activated": "Attivata ricorrenza",
  // M09 Reminders — chiusura segnali
  "abandonment.resolved": "Risolto segnale abbandono",
  // M06 Loyalty — voucher
  "loyalty.voucher_issued": "Voucher emesso",
  "loyalty.voucher_redeemed": "Voucher riscattato",
  // M13 Governance — advertising
  "advertising.overrun_requested": "Richiesto sforamento budget",
  "advertising.overrun_approved": "Approvato sforamento",
  "advertising.overrun_rejected": "Rifiutato sforamento",
  "advertising.budget_updated": "Aggiornato budget advertising",
  // M07 Partners — azioni non attivita (quelle sono gia' in listRecentContactActivities)
  "partners.cooling_toggled": "Aggiornato stato cooling",
  "partners.delivery_error_recorded": "Registrato errore consegna",
  // M01 Data hub
  "contacts.merged": "Unificati contatti duplicati",
  "contacts.consent_updated": "Aggiornato consenso",
  // M05 Publishing
  "publishing.unsubscribe_resolved": "Gestita disiscrizione",
};

const ALLOWED_ACTIONS = Object.keys(ACTION_LABELS);

/**
 * Audit events dell'utente nelle ultime N ore, filtrati sulla allowlist
 * di azioni "task-completanti" sopra. Ordinate dalla piu' recente.
 */
export async function listRecentCompletions(
  organizationId: string,
  userId: string,
  hoursBack = 24,
): Promise<RecentCompletion[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from("audit_events")
    .select("id, action, target, details, created_at")
    .eq("organization_id", organizationId)
    .eq("actor_user_id", userId)
    .in("action", ALLOWED_ACTIONS)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Errore lettura completamenti recenti: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    action: row.action,
    label: ACTION_LABELS[row.action] ?? row.action,
    target: row.target,
    occurredAt: row.created_at,
    details: (row.details as Record<string, unknown>) ?? {},
  }));
}
