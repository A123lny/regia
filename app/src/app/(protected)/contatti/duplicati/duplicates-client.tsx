"use client";

// Client per pagina duplicati: gruppi con selezione survivor + conferma merge.

import { useState, useTransition } from "react";
import {
  Mail,
  Phone,
  MessageSquare,
  Merge,
  Car,
  Gift,
  ShoppingBag,
  Tag as TagIcon,
} from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mergeContactsAction } from "@/modules/m01-data-hub/public";
import type {
  ContactSummary,
  DuplicateGroup,
  DuplicateMatchKind,
} from "@/modules/m01-data-hub/public";

type Props = {
  groups: DuplicateGroup[];
  canMerge: boolean;
};

const MATCH_ICONS: Record<DuplicateMatchKind, typeof Mail> = {
  email: Mail,
  phone: Phone,
  whatsapp: MessageSquare,
};

const MATCH_LABELS: Record<DuplicateMatchKind, string> = {
  email: "Email condivisa",
  phone: "Telefono condiviso",
  whatsapp: "WhatsApp condiviso",
};

function fullName(c: ContactSummary): string {
  const parts = [c.firstName, c.lastName].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" ") : "(senza nome)";
}

function richnessScore(c: ContactSummary): number {
  return (
    (c.email ? 2 : 0) +
    (c.phone ? 2 : 0) +
    (c.whatsapp ? 2 : 0) +
    (c.firstName ? 1 : 0) +
    (c.lastName ? 1 : 0) +
    c.tagsCount +
    (c.hasVehicles ? 3 : 0) +
    c.ordersCount * 2 +
    c.vouchersCount * 2
  );
}

export function DuplicatesClient({ groups, canMerge }: Props) {
  return (
    <div className="space-y-6">
      {groups.map((g, idx) => (
        <DuplicateGroupCard
          key={`${g.matchKind}-${g.matchValue}-${idx}`}
          group={g}
          canMerge={canMerge}
        />
      ))}
    </div>
  );
}

function DuplicateGroupCard({ group, canMerge }: { group: DuplicateGroup; canMerge: boolean }) {
  // Suggerisci il più ricco come survivor di default
  const sortedByRichness = [...group.contacts].sort((a, b) => richnessScore(b) - richnessScore(a));
  const [survivorId, setSurvivorId] = useState<string>(sortedByRichness[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [merged, setMerged] = useState(false);

  const Icon = MATCH_ICONS[group.matchKind];

  if (merged) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/5 p-6 text-center text-sm text-success">
        Duplicati unificati. Ricarica la pagina per aggiornare la lista.
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-text">{MATCH_LABELS[group.matchKind]}</h3>
        <code className="rounded bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
          {group.matchValue}
        </code>
        <Badge className="border border-warning/30 bg-warning/15 text-warning">
          {group.contacts.length} contatti
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {group.contacts.map((c) => {
          const isSurvivor = c.id === survivorId;
          const score = richnessScore(c);
          return (
            <label
              key={c.id}
              className={`cursor-pointer rounded-md border p-3 text-sm transition-colors ${
                isSurvivor
                  ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                  : "border-border bg-bg hover:border-primary/30"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`survivor-${group.matchKind}-${group.matchValue}`}
                    checked={isSurvivor}
                    onChange={() => setSurvivorId(c.id)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <div>
                    <div className="font-medium text-text">{fullName(c)}</div>
                    <div className="text-[10px] text-text-muted">Score {score}</div>
                  </div>
                </div>
                <BrandChip slug={c.brandSlug} name={c.brandDisplayName} color={c.brandColor} />
              </div>
              <div className="space-y-0.5 text-xs text-text-muted">
                {c.email && <div>· {c.email}</div>}
                {c.phone && <div>· {c.phone}</div>}
                {c.whatsapp && <div>· WhatsApp: {c.whatsapp}</div>}
                <div className="text-[10px]">
                  Creato {new Date(c.createdAt).toLocaleDateString("it-IT")} · fonte {c.source}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                {c.tagsCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-text-muted">
                    <TagIcon className="h-3 w-3" />
                    {c.tagsCount} tag
                  </span>
                )}
                {c.hasVehicles && (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <Car className="h-3 w-3" />
                    veicoli
                  </span>
                )}
                {c.ordersCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-text-muted">
                    <ShoppingBag className="h-3 w-3" />
                    {c.ordersCount} ord.
                  </span>
                )}
                {c.vouchersCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-text-muted">
                    <Gift className="h-3 w-3" />
                    {c.vouchersCount} voucher
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {canMerge && group.contacts.length === 2 && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <p className="text-xs text-text-muted">
            <strong className="text-text">Chi tengo:</strong>{" "}
            {fullName(group.contacts.find((c) => c.id === survivorId) ?? group.contacts[0]!)}. Gli
            altri verranno archiviati e i loro dati migrati al survivor.
          </p>
          <Button
            variant="outline"
            disabled={pending || !survivorId}
            onClick={() => {
              const duplicate = group.contacts.find((c) => c.id !== survivorId);
              if (!duplicate) return;
              setError(null);
              startTransition(async () => {
                const result = await mergeContactsAction({
                  survivorId,
                  duplicateId: duplicate.id,
                });
                if (result.ok) setMerged(true);
                else setError(result.error);
              });
            }}
            className="border-primary text-primary hover:bg-primary/10"
          >
            <Merge className="mr-1.5 h-3.5 w-3.5" />
            {pending ? "Unifico..." : "Unifica"}
          </Button>
        </div>
      )}

      {canMerge && group.contacts.length > 2 && (
        <div className="mt-4 border-t border-border pt-3 text-xs text-text-muted">
          Gruppi con più di 2 contatti: unifica prima 2 alla volta (scegli survivor, seleziona un
          solo altro contatto per ora — l&apos;UI multi-merge arriverà se servirà).
        </div>
      )}

      {!canMerge && (
        <div className="mt-4 border-t border-border pt-3 text-xs text-text-muted">
          Solo Owner può unificare contatti (azione distruttiva).
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
          {error}
        </div>
      )}
    </section>
  );
}
