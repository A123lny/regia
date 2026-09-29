"use client";

// Client component per lista contatti + drawer dettaglio + dialog nuovo contatto.
// Drawer via Sheet (radix). Consensi + veicoli caricati on-demand con API interne
// (fetch) per non appesantire la lista principale.

import { useState, useTransition } from "react";
import {
  UserPlus,
  Mail,
  Phone,
  MessageSquare,
  Archive,
  ArchiveRestore,
  Car,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createContactAction,
  archiveContactAction,
  restoreContactAction,
  upsertConsentAction,
  createVehicleAction,
  deleteVehicleAction,
  CONSENT_CHANNEL_LABELS,
  CONSENT_STATUS_LABELS,
  CONTACT_SOURCE_LABELS,
  TIRE_TYPE_LABELS,
} from "@/modules/m01-data-hub/public";
import type {
  Contact,
  ContactConsent,
  ContactVehicle,
  ContactSource,
  ConsentStatus,
  VehicleTireType,
} from "@/modules/m01-data-hub/public";

type ContactWithBrand = Contact & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
};

type Props = {
  contacts: ContactWithBrand[];
  brands: Array<{ id: string; slug: string; displayName: string; color: string }>;
  canCrud: boolean;
  canManageConsent: boolean;
};

function fullName(c: Contact): string {
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(senza nome)";
}

function primaryContact(c: Contact): { icon: typeof Mail; value: string } | null {
  if (c.email) return { icon: Mail, value: c.email };
  if (c.phone) return { icon: Phone, value: c.phone };
  if (c.whatsapp) return { icon: MessageSquare, value: c.whatsapp };
  return null;
}

export function ContactsAdminClient({ contacts, brands, canCrud, canManageConsent }: Props) {
  const [selected, setSelected] = useState<ContactWithBrand | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div />
        {canCrud && (
          <Sheet open={newContactOpen} onOpenChange={setNewContactOpen}>
            <SheetTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <UserPlus className="mr-2 h-4 w-4" /> Nuovo contatto
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="font-serif">Nuovo contatto</SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <NewContactForm brands={brands} onDone={() => setNewContactOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Tabella contatti */}
      {contacts.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-28 p-3">Marchio</th>
                <th className="p-3">Nome</th>
                <th className="p-3">Recapito principale</th>
                <th className="w-28 p-3">Fonte</th>
                <th className="w-24 p-3">Stato</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const p = primaryContact(c);
                const Icon = p?.icon ?? Mail;
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted ${
                      c.archivedAt ? "opacity-60" : ""
                    }`}
                  >
                    <td className="p-3">
                      <BrandChip
                        slug={c.brandSlug}
                        name={c.brandDisplayName}
                        color={c.brandColor}
                      />
                    </td>
                    <td className="p-3 font-medium text-text">{fullName(c)}</td>
                    <td className="p-3 text-text-muted">
                      {p ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          {p.value}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-xs text-text-muted">
                      {CONTACT_SOURCE_LABELS[c.source]}
                    </td>
                    <td className="p-3">
                      {c.archivedAt ? (
                        <Badge className="border border-border bg-surface-muted text-text-muted">
                          Archiviato
                        </Badge>
                      ) : (
                        <Badge className="border border-success/30 bg-success/15 text-success">
                          Attivo
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer dettaglio */}
      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <ContactDetailDrawer
              contact={selected}
              canCrud={canCrud}
              canManageConsent={canManageConsent}
              onClose={() => setSelected(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============================================================================
// New contact dialog form
// ============================================================================

function NewContactForm({
  brands,
  onDone,
}: {
  brands: Array<{ id: string; slug: string; displayName: string; color: string }>;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaultBrandId = brands[0]?.id ?? "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const firstName = String(fd.get("firstName") ?? "").trim();
          const lastName = String(fd.get("lastName") ?? "").trim();
          const email = String(fd.get("email") ?? "").trim();
          const phone = String(fd.get("phone") ?? "").trim();
          const whatsapp = String(fd.get("whatsapp") ?? "").trim();
          const notes = String(fd.get("notes") ?? "").trim();
          const source = (String(fd.get("source") ?? "manuale") || "manuale") as ContactSource;

          const payload: Parameters<typeof createContactAction>[0] = {
            brandId: String(fd.get("brandId") ?? defaultBrandId),
            source,
          };
          if (firstName) payload.firstName = firstName;
          if (lastName) payload.lastName = lastName;
          if (email) payload.email = email;
          if (phone) payload.phone = phone;
          if (whatsapp) payload.whatsapp = whatsapp;
          if (notes) payload.notes = notes;

          const result = await createContactAction(payload);
          if (result.ok) {
            onDone();
          } else {
            setError(result.error);
          }
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="brandId">Marchio</Label>
        <select
          id="brandId"
          name="brandId"
          required
          defaultValue={defaultBrandId}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="firstName">Nome</Label>
          <Input id="firstName" name="firstName" maxLength={100} />
        </div>
        <div>
          <Label htmlFor="lastName">Cognome</Label>
          <Input id="lastName" name="lastName" maxLength={100} />
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" maxLength={200} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" maxLength={40} />
        </div>
        <div>
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" maxLength={40} />
        </div>
      </div>
      <div>
        <Label htmlFor="source">Fonte</Label>
        <select
          id="source"
          name="source"
          defaultValue="manuale"
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          {(Object.keys(CONTACT_SOURCE_LABELS) as ContactSource[]).map((s) => (
            <option key={s} value={s}>
              {CONTACT_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea id="notes" name="notes" rows={2} maxLength={500} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annulla
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {pending ? "Salvo..." : "Crea contatto"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Detail drawer: consensi + veicoli + edit rapido + archive/restore
// ============================================================================

function ContactDetailDrawer({
  contact,
  canCrud,
  canManageConsent,
  onClose,
}: {
  contact: ContactWithBrand;
  canCrud: boolean;
  canManageConsent: boolean;
  onClose: () => void;
}) {
  const [consents, setConsents] = useState<ContactConsent[] | null>(null);
  const [vehicles, setVehicles] = useState<ContactVehicle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Load on mount (via server component fallback API stub → useEffect)
  // Semplifichiamo: fetch da endpoint interno costruito ad-hoc? No, usiamo
  // server actions restituendo consensi al primo render tramite prop iniziale.
  // Per ora: mostro placeholder e carica al primo render.
  useState(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/contatti/${contact.id}/detail`, { cache: "no-store" });
        if (!res.ok) throw new Error("Errore caricamento dettagli");
        const data = (await res.json()) as {
          consents: ContactConsent[];
          vehicles: ContactVehicle[];
        };
        setConsents(data.consents);
        setVehicles(data.vehicles);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
          {fullName(contact)}
          <BrandChip
            slug={contact.brandSlug}
            name={contact.brandDisplayName}
            color={contact.brandColor}
          />
        </SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-6 px-4 pb-8">
        {/* Recapiti + info base */}
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-text">Recapiti</h3>
          <div className="space-y-1 text-sm text-text-muted">
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> {contact.email}
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> {contact.phone}
              </div>
            )}
            {contact.whatsapp && (
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" /> {contact.whatsapp}
              </div>
            )}
            {!contact.email && !contact.phone && !contact.whatsapp && (
              <span>Nessun recapito registrato</span>
            )}
          </div>
          <div className="pt-2 text-xs text-text-muted">
            Fonte: <strong>{CONTACT_SOURCE_LABELS[contact.source]}</strong>
            {" · "}
            Creato il {new Date(contact.createdAt).toLocaleDateString("it-IT")}
          </div>
          {contact.notes && (
            <div className="mt-2 border-t border-border pt-2 text-xs text-text-muted">
              <strong>Note:</strong> {contact.notes}
            </div>
          )}
        </section>

        {/* Consensi per canale (RF-1.4) */}
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-text">Consensi per canale (RF-1.4)</h3>
          {loading && <p className="text-xs text-text-muted">Caricamento...</p>}
          {consents && (
            <div className="space-y-2">
              {consents.map((c) => (
                <ConsentRow
                  key={c.channel}
                  consent={c}
                  contactId={contact.id}
                  disabled={!canManageConsent || pending}
                />
              ))}
              {!canManageConsent && (
                <p className="pt-1 text-[11px] text-text-muted/70">
                  Solo l&apos;Owner può modificare i consensi (materia legale).
                </p>
              )}
            </div>
          )}
        </section>

        {/* Veicoli (RF-1.3) */}
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Veicoli (RF-1.3)</h3>
            {canCrud && vehicles && (
              <AddVehicleButton
                contactId={contact.id}
                onAdded={(v) => setVehicles([...(vehicles ?? []), v])}
              />
            )}
          </div>
          {loading && <p className="text-xs text-text-muted">Caricamento...</p>}
          {vehicles && vehicles.length === 0 && (
            <p className="text-xs text-text-muted">Nessun veicolo agganciato.</p>
          )}
          {vehicles && vehicles.length > 0 && (
            <ul className="space-y-2">
              {vehicles.map((v) => (
                <VehicleRow
                  key={v.id}
                  vehicle={v}
                  contactId={contact.id}
                  canCrud={canCrud}
                  onDeleted={() => setVehicles((vehicles ?? []).filter((x) => x.id !== v.id))}
                />
              ))}
            </ul>
          )}
        </section>

        {error && (
          <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            {error}
          </div>
        )}

        {/* Azioni */}
        {canCrud && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {contact.archivedAt ? (
              <form
                action={async () => {
                  await restoreContactAction(contact.id);
                  onClose();
                }}
              >
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending}
                  onClick={() => startTransition(() => {})}
                >
                  <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> Ripristina
                </Button>
              </form>
            ) : (
              <form
                action={async () => {
                  await archiveContactAction(contact.id);
                  onClose();
                }}
              >
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending}
                  className="border-danger/40 text-danger hover:bg-danger/10"
                  onClick={() => startTransition(() => {})}
                >
                  <Archive className="mr-1.5 h-3.5 w-3.5" /> Archivia
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ConsentRow({
  consent,
  contactId,
  disabled,
}: {
  consent: ContactConsent;
  contactId: string;
  disabled: boolean;
}) {
  const [status, setStatus] = useState<ConsentStatus>(consent.status);
  const [pending, startTransition] = useTransition();
  const label = CONSENT_CHANNEL_LABELS[consent.channel];
  const statusMeta: Record<ConsentStatus, { cls: string; label: string }> = {
    granted: {
      cls: "border-success/40 bg-success/15 text-success",
      label: CONSENT_STATUS_LABELS.granted,
    },
    revoked: {
      cls: "border-danger/40 bg-danger/15 text-danger",
      label: CONSENT_STATUS_LABELS.revoked,
    },
    never: {
      cls: "border-border bg-surface-muted text-text-muted",
      label: CONSENT_STATUS_LABELS.never,
    },
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg p-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text">{label}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusMeta[status].cls}`}>
          {statusMeta[status].label}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={status}
          disabled={disabled || pending}
          onChange={(e) => {
            const next = e.target.value as ConsentStatus;
            startTransition(async () => {
              const result = await upsertConsentAction({
                contactId,
                channel: consent.channel,
                status: next,
                source: "manuale",
                evidenceText: `Aggiornato manualmente dall'operatore`,
              });
              if (result.ok) setStatus(next);
            });
          }}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs focus:border-primary focus:outline-none disabled:opacity-50"
        >
          <option value="granted">Attivo</option>
          <option value="revoked">Disiscritto</option>
          <option value="never">Mai</option>
        </select>
      </div>
    </div>
  );
}

function AddVehicleButton({
  contactId,
  onAdded,
}: {
  contactId: string;
  onAdded: (v: ContactVehicle) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Aggiungi
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const yearRaw = String(fd.get("year") ?? "").trim();
          const kmRaw = String(fd.get("kilometers") ?? "").trim();
          const tireRaw = String(fd.get("tireType") ?? "").trim();
          const svcRaw = String(fd.get("lastServiceAt") ?? "").trim();

          const payload: Parameters<typeof createVehicleAction>[0] = {
            contactId,
            plate: String(fd.get("plate") ?? ""),
          };
          const modelVal = String(fd.get("model") ?? "").trim();
          if (modelVal) payload.model = modelVal;
          if (yearRaw) payload.year = Number(yearRaw);
          if (kmRaw) payload.kilometers = Number(kmRaw);
          if (svcRaw) payload.lastServiceAt = svcRaw;
          if (tireRaw) payload.tireType = tireRaw as VehicleTireType;

          const result = await createVehicleAction(payload);
          if (result.ok) {
            // Ricarico dal server: costruisco un vehicle placeholder e ricarico
            setOpen(false);
            // Non riabbiamo il record completo — sarebbe meglio un endpoint
            // ma per ora aggiungiamo con dati locali (id vero dal risultato).
            onAdded({
              id: result.vehicleId,
              organizationId: "", // popolato dal server, non necessario per l'UI
              contactId,
              plate: payload.plate.toUpperCase(),
              model: payload.model ?? null,
              year: payload.year ?? null,
              kilometers: payload.kilometers ?? null,
              lastServiceAt: payload.lastServiceAt ?? null,
              tireType: payload.tireType ?? null,
              notes: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else {
            setError(result.error);
          }
        });
      }}
      className="w-full rounded-md border border-border bg-bg p-2"
    >
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Input name="plate" placeholder="Targa (es. AB123CD)" required maxLength={20} />
        <Input name="model" placeholder="Modello" maxLength={100} />
        <Input name="year" placeholder="Anno" type="number" min={1950} max={2100} />
        <Input name="kilometers" placeholder="Km" type="number" min={0} />
        <Input name="lastServiceAt" placeholder="Ultimo tagliando" type="date" />
        <select
          name="tireType"
          defaultValue=""
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs focus:border-primary focus:outline-none"
        >
          <option value="">Tipo gomme…</option>
          {(Object.keys(TIRE_TYPE_LABELS) as VehicleTireType[]).map((t) => (
            <option key={t} value={t}>
              {TIRE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {pending ? "..." : "Salva"}
        </Button>
      </div>
    </form>
  );
}

function VehicleRow({
  vehicle,
  contactId,
  canCrud,
  onDeleted,
}: {
  vehicle: ContactVehicle;
  contactId: string;
  canCrud: boolean;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg p-2 text-xs">
      <div className="flex items-center gap-2">
        <Car className="h-3.5 w-3.5 text-text-muted" />
        <span className="font-mono font-medium text-text">{vehicle.plate}</span>
        {vehicle.model && <span className="text-text-muted">· {vehicle.model}</span>}
        {vehicle.year && <span className="text-text-muted">({vehicle.year})</span>}
        {vehicle.kilometers !== null && (
          <span className="text-text-muted">· {vehicle.kilometers.toLocaleString("it-IT")} km</span>
        )}
        {vehicle.tireType && (
          <span className="text-text-muted">· {TIRE_TYPE_LABELS[vehicle.tireType]}</span>
        )}
      </div>
      {canCrud && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await deleteVehicleAction(vehicle.id, contactId);
              onDeleted();
            });
          }}
          className="rounded-md p-1 text-text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
          aria-label={`Elimina veicolo ${vehicle.plate}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
