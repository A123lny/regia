"use client";

// Card "Account social": selettore marchio + 6 sotto-card per piattaforma
// con status connesso/non connesso, bottone "Configura" / "Modifica" / "Disconnetti".
// Nessun campo credenziale mostrato in chiaro dopo il primo save (solo count fields set).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X as XIcon, ExternalLink, Trash2 } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import type { Brand } from "@/modules/m02-brand/public";
import type {
  BrandSocialAccount,
  SocialPlatform,
  SocialPlatformSchema,
} from "@/modules/m02-brand/public";
import { saveBrandSocialAccount, disconnectBrandSocialAccount } from "@/modules/m02-brand/public";

type Props = {
  brands: Brand[];
  accounts: BrandSocialAccount[]; // tutti gli account attivi di tutti i brand, filtreremo per brandId
  schemas: SocialPlatformSchema[];
};

export function SocialConfigClient({ brands, accounts, schemas }: Props) {
  const router = useRouter();
  const [selectedBrandId, setSelectedBrandId] = useState<string>(brands[0]?.id ?? "");
  const [configuring, setConfiguring] = useState<{
    brand: Brand;
    schema: SocialPlatformSchema;
    existing: BrandSocialAccount | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (brands.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Nessun marchio attivo. Crea prima un marchio in <code>/marchi</code>.
      </p>
    );
  }

  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? brands[0];
  if (!selectedBrand) return null;
  const brandAccounts = accounts.filter((a) => a.brandId === selectedBrand.id);

  function handleDisconnect(platform: SocialPlatform) {
    if (!selectedBrand) return;
    const brand = selectedBrand;
    if (!confirm(`Disconnettere ${platform} da ${brand.displayName}?`)) return;
    setBusy(`${brand.id}:${platform}`);
    startTransition(async () => {
      try {
        await disconnectBrandSocialAccount(brand.id, platform);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore disconnessione");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}{" "}
          <button
            type="button"
            onClick={() => setError(null)}
            className="underline"
            aria-label="Chiudi errore"
          >
            chiudi
          </button>
        </div>
      )}

      {/* Selettore marchio (tab) */}
      <div className="mb-4 flex flex-wrap gap-1">
        {brands.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelectedBrandId(b.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              b.id === selectedBrand.id
                ? "bg-primary/10 text-primary"
                : "text-text-muted hover:bg-surface-muted"
            }`}
          >
            <BrandLogo logoUrl={b.logoUrl} name={b.displayName} size="xs" rounded="full" />
            {b.displayName}
          </button>
        ))}
      </div>

      {/* Card per piattaforma */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {schemas.map((schema) => {
          const existing = brandAccounts.find((a) => a.platform === schema.platform) ?? null;
          const isConnected = existing?.isConnected ?? false;
          const busyKey = `${selectedBrand.id}:${schema.platform}`;
          const isBusy = busy === busyKey;
          return (
            <div
              key={schema.platform}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                isConnected ? "border-success/30 bg-success/5" : "border-border bg-surface-muted/30"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: schema.brandColor }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-text">{schema.displayName}</span>
                  {isConnected ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-success/30 bg-success/10 px-1.5 py-0 text-[10px] font-medium text-success">
                      <Check className="h-3 w-3" /> connesso
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface px-1.5 py-0 text-[10px] font-medium text-text-muted">
                      <XIcon className="h-3 w-3" /> non configurato
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  {schema.fields.length} campi
                  {schema.docsUrl && (
                    <>
                      {" · "}
                      <a
                        href={schema.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 underline hover:text-primary"
                      >
                        docs <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setConfiguring({ brand: selectedBrand, schema, existing })}
                  className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text hover:border-primary/50 disabled:opacity-50"
                >
                  {isConnected ? "Modifica" : "Configura"}
                </button>
                {isConnected && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDisconnect(schema.platform)}
                    className="rounded-md p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
                    aria-label={`Disconnetti ${schema.displayName}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {configuring && (
        <ConfigDialog
          brand={configuring.brand}
          schema={configuring.schema}
          existing={configuring.existing}
          onClose={() => setConfiguring(null)}
          onError={setError}
          onSuccess={() => {
            setConfiguring(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ConfigDialog({
  brand,
  schema,
  existing,
  onClose,
  onSuccess,
  onError,
}: {
  brand: Brand;
  schema: SocialPlatformSchema;
  existing: BrandSocialAccount | null;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  // Se esiste, precompilo con i valori esistenti (visibili solo se l'utente li rivede).
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of schema.fields) {
      init[f.key] = existing?.credentials[f.key] ?? "";
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await saveBrandSocialAccount(brand.id, schema.platform, values);
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: schema.brandColor }}
            aria-hidden="true"
          />
          <h2
            className="text-xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {schema.displayName} · {brand.displayName}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {schema.fields.map((field) => (
            <label key={field.key} className="block">
              <span className="text-xs font-medium text-text">
                {field.label}
                {field.required && <span className="ml-1 text-danger">*</span>}
              </span>
              <input
                type={field.type}
                value={values[field.key] ?? ""}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                required={field.required}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none font-mono"
                placeholder={field.required ? "obbligatorio" : "opzionale"}
                autoComplete="off"
              />
              {field.help && (
                <span className="mt-1 block text-[10px] text-text-muted">{field.help}</span>
              )}
            </label>
          ))}
          {schema.docsUrl && (
            <p className="rounded-md border border-border bg-surface-muted/40 p-2 text-[11px] text-text-muted">
              Se non sai come ottenere questi valori, consulta la{" "}
              <a
                href={schema.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                documentazione ufficiale
              </a>
              .
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Salvo…" : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
