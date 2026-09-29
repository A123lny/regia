"use client";

// Client per pagina fornitori: tabella + dialog CRUD.

import { useState, useTransition } from "react";
import { Plus, ShieldCheck, ShieldAlert, Phone, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertSupplyPartnerAction } from "@/modules/m01-data-hub/public";
import type { SupplyPartner } from "@/modules/m01-data-hub/public";

type Props = {
  partners: SupplyPartner[];
  canCrud: boolean;
};

export function SuppliersClient({ partners, canCrud }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplyPartner | null>(null);

  return (
    <div className="space-y-3">
      {canCrud && (
        <div className="flex justify-end">
          <Sheet
            open={dialogOpen}
            onOpenChange={(o) => {
              setDialogOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <SheetTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <Plus className="mr-2 h-4 w-4" /> Nuovo fornitore
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="font-serif">
                  {editing ? "Modifica fornitore" : "Nuovo fornitore"}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <PartnerForm
                  initial={editing}
                  onDone={() => {
                    setDialogOpen(false);
                    setEditing(null);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {partners.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun fornitore configurato.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="p-3">Fornitore</th>
                <th className="w-40 p-3">Referente</th>
                <th className="w-32 p-3">Categoria</th>
                <th className="p-3">Assenso RF-6.19</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    if (canCrud) {
                      setEditing(p);
                      setDialogOpen(true);
                    }
                  }}
                  className={`border-b border-border/60 last:border-0 ${
                    canCrud ? "cursor-pointer hover:bg-surface-muted" : ""
                  }`}
                >
                  <td className="p-3">
                    <div className="font-medium text-text">{p.name}</div>
                    {p.notes && <div className="text-xs text-text-muted">{p.notes}</div>}
                  </td>
                  <td className="p-3 text-xs">
                    {p.referentName && <div className="text-text">{p.referentName}</div>}
                    {p.phone && (
                      <div className="flex items-center gap-1 text-text-muted">
                        <Phone className="h-3 w-3" /> {p.phone}
                      </div>
                    )}
                    {p.email && (
                      <div className="flex items-center gap-1 text-text-muted">
                        <Mail className="h-3 w-3" /> {p.email}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-text-muted">
                    {p.category ?? <span className="italic">—</span>}
                  </td>
                  <td className="p-3">
                    {p.generalConsent ? (
                      <div>
                        <Badge className="border border-success/40 bg-success/15 text-success">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          Assenso attivo
                        </Badge>
                        {p.generalConsentNote && (
                          <div className="mt-1 text-[11px] italic text-text-muted">
                            {p.generalConsentNote}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge className="border border-warning/40 bg-warning/15 text-warning">
                        <ShieldAlert className="mr-1 h-3 w-3" />
                        Nessun assenso
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PartnerForm({ initial, onDone }: { initial: SupplyPartner | null; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generalConsent, setGeneralConsent] = useState(initial?.generalConsent ?? false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof upsertSupplyPartnerAction>[0] = {
            name: String(fd.get("name") ?? ""),
            generalConsent,
          };
          if (initial) payload.partnerId = initial.id;
          const ref = String(fd.get("referentName") ?? "").trim();
          if (ref) payload.referentName = ref;
          const phone = String(fd.get("phone") ?? "").trim();
          if (phone) payload.phone = phone;
          const email = String(fd.get("email") ?? "").trim();
          if (email) payload.email = email;
          const cat = String(fd.get("category") ?? "").trim();
          if (cat) payload.category = cat;
          const notes = String(fd.get("notes") ?? "").trim();
          if (notes) payload.notes = notes;
          if (generalConsent) {
            const note = String(fd.get("generalConsentNote") ?? "").trim();
            if (note) payload.generalConsentNote = note;
          }
          const result = await upsertSupplyPartnerAction(payload);
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="name">Nome fornitore</Label>
        <Input id="name" name="name" required maxLength={200} defaultValue={initial?.name ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="referentName">Referente</Label>
          <Input
            id="referentName"
            name="referentName"
            maxLength={200}
            defaultValue={initial?.referentName ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" maxLength={40} defaultValue={initial?.phone ?? ""} />
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          maxLength={200}
          defaultValue={initial?.email ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="category">Categoria</Label>
        <Input
          id="category"
          name="category"
          maxLength={100}
          defaultValue={initial?.category ?? ""}
          placeholder="es. Bevande, Pasta, Carne"
        />
      </div>

      <div className="rounded-md border border-border bg-bg p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={generalConsent}
            onChange={(e) => setGeneralConsent(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Assenso generale a promozioni (RF-6.19)
        </label>
        {generalConsent && (
          <div className="mt-2">
            <Label htmlFor="generalConsentNote" className="text-xs">
              Motivo/scadenza accordo (obbligatorio)
            </Label>
            <Textarea
              id="generalConsentNote"
              name="generalConsentNote"
              rows={2}
              maxLength={500}
              defaultValue={initial?.generalConsentNote ?? ""}
              placeholder="es. Accordo commerciale 2026, scadenza dicembre"
              required={generalConsent}
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={500}
          defaultValue={initial?.notes ?? ""}
        />
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
          {pending ? "Salvo..." : "Salva"}
        </Button>
      </div>
    </form>
  );
}
