// RF-1.9 Dossier dati personali.
// Pagina Owner-only: mostra TUTTO quello che Regia possiede sul contatto,
// con bottoni per registrare una richiesta export/cancellazione e per
// marcarla fulfilled/rejected. Nessuna automazione: il titolare risponde a mano.

import Link from "next/link";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { buildContactDossier, listDataRequests } from "@/modules/m01-data-hub/public";
import { HelpButton } from "@/components/help/help-button";
import { DataRequestsClient } from "./data-requests-client";

type PageProps = { params: Promise<{ id: string }> };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCents(c: number): string {
  return `${(c / 100).toFixed(2)}€`;
}

export default async function DossierPage({ params }: PageProps) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "contacts.data_request.read")) {
    return (
      <div className="p-8 text-sm text-text-muted">
        Richieste dati personali: materia legale/GDPR, accessibile solo al Proprietario.
      </div>
    );
  }
  const { id } = await params;
  const [dossier, previousRequests] = await Promise.all([
    buildContactDossier(session.organizationId, id),
    listDataRequests(session.organizationId, { contactId: id }),
  ]);
  if (!dossier) {
    return <div className="p-8 text-sm text-text-muted">Contatto non trovato.</div>;
  }
  const canFulfill = hasCapability(session.role, "contacts.data_request.fulfill");
  const fullName =
    [dossier.contact.firstName, dossier.contact.lastName].filter(Boolean).join(" ") ||
    "(senza nome)";
  const isArchived = dossier.contact.archivedAt !== null;

  return (
    <main className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <nav className="text-xs text-text-muted">
            <Link href="/contatti" className="underline">
              Contatti
            </Link>{" "}
            / Dati personali
          </nav>
          <h1 className="mt-1 font-serif text-2xl font-bold">
            {fullName}
            {isArchived && (
              <span className="ml-2 rounded bg-amber-100 px-2 py-1 text-xs font-normal text-amber-900">
                Archiviato
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            RF-1.9 · Dossier completo. Il sistema <strong>non invia nulla, non decide</strong>:
            raccogli, mostra all&apos;interessato, registra qui l&apos;esito.
          </p>
        </div>
        <HelpButton pageKey="contatti-dati-personali" />
      </header>

      <DataRequestsClient
        contactId={dossier.contact.id}
        previousRequests={previousRequests}
        canFulfill={canFulfill}
      />

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-serif text-lg font-semibold">Anagrafica</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-text-muted">Nome</dt>
            <dd>{dossier.contact.firstName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Cognome</dt>
            <dd>{dossier.contact.lastName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Email</dt>
            <dd>{dossier.contact.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Telefono</dt>
            <dd>{dossier.contact.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">WhatsApp</dt>
            <dd>{dossier.contact.whatsapp ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Origine</dt>
            <dd>{dossier.contact.source}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Creato</dt>
            <dd>{formatDate(dossier.contact.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Archiviato</dt>
            <dd>{formatDate(dossier.contact.archivedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Tag</dt>
            <dd>{dossier.contact.tags.join(", ") || "—"}</dd>
          </div>
        </dl>
      </section>

      <DossierSection
        title={`Consensi per canale (${dossier.consents.length})`}
        empty="Nessun consenso registrato."
        items={dossier.consents.map((c) => (
          <li key={c.channel} className="rounded border bg-surface-muted p-2 text-sm">
            <strong>{c.channel}</strong>: {c.status}
            {c.grantedAt && <> · dato {formatDate(c.grantedAt)}</>}
            {c.revokedAt && <> · revocato {formatDate(c.revokedAt)}</>}
            {c.source && <> · fonte: {c.source}</>}
            {c.unsubscribeReason && <> · motivo: {c.unsubscribeReason}</>}
            {c.reduceFrequency && <> · scrivetemi meno</>}
          </li>
        ))}
      />

      <DossierSection
        title={`Veicoli (${dossier.vehicles.length})`}
        empty="Nessun veicolo registrato."
        items={dossier.vehicles.map((v) => (
          <li key={v.plate} className="rounded border bg-surface-muted p-2 text-sm">
            <strong>{v.plate}</strong>
            {v.brand && <> · {v.brand}</>}
            {v.model && <> {v.model}</>}
            {v.lastServiceAt && <> · ultimo intervento {v.lastServiceAt}</>}
          </li>
        ))}
      />

      <DossierSection
        title={`Voucher (${dossier.vouchers.length})`}
        empty="Nessun voucher emesso."
        items={dossier.vouchers.map((v) => (
          <li key={v.code} className="rounded border bg-surface-muted p-2 text-sm">
            <strong>{v.code}</strong>: {v.status} · {v.rewardKind} · emesso {formatDate(v.issuedAt)}{" "}
            · scade {formatDate(v.expiresAt)}
            {v.redeemedAt && <> · riscattato {formatDate(v.redeemedAt)}</>}
          </li>
        ))}
      />

      <DossierSection
        title={`Ordini (${dossier.orders.length})`}
        empty="Nessun ordine registrato."
        items={dossier.orders.map((o) => (
          <li key={o.externalId} className="rounded border bg-surface-muted p-2 text-sm">
            <strong>{o.externalId}</strong>: {formatCents(o.totalCents)} · {o.status} ·{" "}
            {formatDate(o.placedAt)}
          </li>
        ))}
      />

      <DossierSection
        title={`Iscrizioni via landing (${dossier.signupEvents.length})`}
        empty="Nessuna iscrizione via landing pubblica."
        items={dossier.signupEvents.map((s, i) => (
          <li
            key={`${s.landingSlug}-${s.createdAt}-${i}`}
            className="rounded border bg-surface-muted p-2 text-sm"
          >
            Landing <strong>{s.landingSlug ?? "—"}</strong>
            {s.audienceKind && <> · pubblico {s.audienceKind}</>}
            {" · canali: "}
            {s.channelsGranted.join(", ")}
            <> · {formatDate(s.createdAt)}</>
          </li>
        ))}
      />

      <DossierSection
        title={`Promemoria (${dossier.reminders.length})`}
        empty="Nessun promemoria generato."
        items={dossier.reminders.map((r, i) => (
          <li
            key={`${r.kind}-${r.scheduledAt}-${i}`}
            className="rounded border bg-surface-muted p-2 text-sm"
          >
            <strong>{r.kind}</strong>: {r.status} · schedulato {formatDate(r.scheduledAt)}
            {r.sentAt && <> · inviato {formatDate(r.sentAt)}</>}
          </li>
        ))}
      />

      <DossierSection
        title={`Log invii (${dossier.publishLog.length})`}
        empty="Nessun invio registrato."
        items={dossier.publishLog.slice(0, 50).map((p, i) => (
          <li key={`${p.sentAt}-${i}`} className="rounded border bg-surface-muted p-2 text-xs">
            {p.channel} · {p.status} · {p.recipientAddress} · {formatDate(p.sentAt)}
          </li>
        ))}
      />

      <section className="rounded-lg border border-border bg-surface-muted p-4 text-xs text-text-muted">
        <strong>Note sui dati esterni (RF-1.1):</strong> Regia e&apos; sola lettura verso i
        gestionali Lenny/Stazione. Dati come storico acquisti al banco, dettaglio preventivi
        officina, scontrini bar vivono SOLO li&apos;. Per rispondere a una richiesta che li includa,
        inoltrare separatamente al team interno.
      </section>
    </main>
  );
}

function DossierSection({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: React.ReactNode[];
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm italic text-text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1">{items}</ul>
      )}
    </section>
  );
}
