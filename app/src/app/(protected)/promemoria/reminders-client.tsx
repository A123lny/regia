"use client";

// Client per pagina promemoria: tabella con azioni inline dismiss/mark_sent + refresh.

import { useState, useTransition } from "react";
import {
  RefreshCw,
  CheckCircle2,
  X as XIcon,
  Sparkles,
  Heart,
  Wrench,
  Clock,
  Target,
  UserX,
  Star,
  Send,
} from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  dismissReminderAction,
  markReminderSentAction,
  refreshAllRemindersAction,
  sendReminderNowAction,
  REMINDER_KIND_LABELS,
  REMINDER_STATUS_LABELS,
  REMINDER_STATUS_STYLES,
} from "@/modules/m09-reminders/public";
import type { ReminderKind, ReminderRow } from "@/modules/m09-reminders/public";

type Props = {
  reminders: ReminderRow[];
  canCrud: boolean;
  canRefresh: boolean;
};

const KIND_ICONS: Record<ReminderKind, typeof Sparkles> = {
  welcome: Sparkles,
  thanks_order: Heart,
  service_call: Wrench,
  voucher_expiring: Clock,
  counter_close: Target,
  dormant_reactivation: UserX,
  review_request: Star,
};

const KIND_COLORS: Record<ReminderKind, string> = {
  welcome: "text-primary",
  thanks_order: "text-success",
  service_call: "text-warning",
  voucher_expiring: "text-danger",
  counter_close: "text-primary",
  dormant_reactivation: "text-text-muted",
  review_request: "text-warning",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Oggi";
  if (diffDays === 1) return "Domani";
  if (diffDays === -1) return "Ieri";
  if (diffDays < 0) return `${-diffDays}gg fa`;
  if (diffDays < 7) return `Tra ${diffDays}gg`;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function RemindersClient({ reminders, canCrud, canRefresh }: Props) {
  const [pending, startTransition] = useTransition();
  const [refreshSummary, setRefreshSummary] = useState<{
    totalCreated: number;
    details: string;
  } | null>(null);

  return (
    <div className="space-y-3">
      {/* Toolbar refresh */}
      {canRefresh && (
        <div className="flex items-center justify-between">
          <div>
            {refreshSummary && (
              <p className="text-xs text-text-muted">
                <strong className="text-success">{refreshSummary.totalCreated}</strong> nuov
                {refreshSummary.totalCreated === 1 ? "o promemoria" : "i promemoria"}:{" "}
                {refreshSummary.details}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await refreshAllRemindersAction();
                if (result.ok) {
                  const parts: string[] = [];
                  if (result.serviceCall.created)
                    parts.push(`${result.serviceCall.created} tagliandi`);
                  if (result.voucherExpiring.created)
                    parts.push(`${result.voucherExpiring.created} voucher scad.`);
                  if (result.dormant.created) parts.push(`${result.dormant.created} dormienti`);
                  if (result.counterClose.created)
                    parts.push(`${result.counterClose.created} vicini soglia`);
                  setRefreshSummary({
                    totalCreated: result.totalCreated,
                    details: parts.length > 0 ? parts.join(", ") : "nessuno nuovo",
                  });
                }
              });
            }}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
            {pending ? "Calcolo..." : "Ricalcola promemoria"}
          </Button>
        </div>
      )}

      {/* Tabella */}
      {reminders.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-24 p-3">Quando</th>
                <th className="w-28 p-3">Marchio</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Nota</th>
                <th className="w-24 p-3">Stato</th>
                {canCrud && <th className="w-24 p-3" />}
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => {
                const Icon = KIND_ICONS[r.kind];
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
                  >
                    <td className="p-3 text-xs text-text-muted">{formatDate(r.scheduledAt)}</td>
                    <td className="p-3">
                      <BrandChip
                        slug={r.brandSlug}
                        name={r.brandDisplayName}
                        color={r.brandColor}
                      />
                    </td>
                    <td className="p-3">
                      <div className="text-sm text-text">
                        {r.contactFullName ?? (
                          <span className="italic text-text-muted">senza nome</span>
                        )}
                      </div>
                      {r.contactEmail && (
                        <div className="text-[11px] text-text-muted">{r.contactEmail}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs ${KIND_COLORS[r.kind]}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {REMINDER_KIND_LABELS[r.kind]}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-text-muted">
                      {r.messageHint ?? <span className="italic">—</span>}
                    </td>
                    <td className="p-3">
                      <Badge className={`border ${REMINDER_STATUS_STYLES[r.status]}`}>
                        {REMINDER_STATUS_LABELS[r.status]}
                      </Badge>
                    </td>
                    {canCrud && r.status === "pending" && (
                      <td className="p-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              startTransition(async () => {
                                const res = await sendReminderNowAction(r.id);
                                if (!res.ok) {
                                  alert(`Invio non riuscito: ${res.error}`);
                                }
                              });
                            }}
                            className="rounded-md p-1 text-text-muted hover:bg-primary/10 hover:text-primary"
                            aria-label="Invia ora via M05 (WA o email a seconda del tipo)"
                            title="Invia ora (M05)"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              startTransition(async () => {
                                await markReminderSentAction(r.id);
                              });
                            }}
                            className="rounded-md p-1 text-text-muted hover:bg-success/10 hover:text-success"
                            aria-label="Marca inviato (manuale, senza M05)"
                            title="Marca inviato manualmente"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              startTransition(async () => {
                                await dismissReminderAction(r.id);
                              });
                            }}
                            className="rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text"
                            aria-label="Ignora"
                            title="Ignora"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                    {canCrud && r.status !== "pending" && <td className="p-3" />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
