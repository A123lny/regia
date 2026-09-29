// RF-11.2 Stato salute connessioni social (server component read-only).
// Elenca brand_social_accounts con avvisi di prossima scadenza token
// (Meta/LinkedIn: 60gg). Nessuna verifica live in F1 — solo metadati salvati.

import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Brand, BrandSocialAccount } from "@/modules/m02-brand/public";
import { SOCIAL_PLATFORMS } from "@/modules/m02-brand/public";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/brand-logo";

// Soglia di allarme: 55gg dall'ultimo update → warning (Meta scade a 60gg).
const WARN_DAYS = 55;
const CRITICAL_DAYS = 60;

function daysSinceUpdate(iso: string): number {
  const now = Date.now();
  const then = new Date(iso).getTime();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function platformLabel(p: string): string {
  const schema = SOCIAL_PLATFORMS.find((s) => s.platform === p);
  return schema?.displayName ?? p;
}

function platformColor(p: string): string {
  const schema = SOCIAL_PLATFORMS.find((s) => s.platform === p);
  return schema?.brandColor ?? "#7a6857";
}

type Props = {
  brands: Brand[];
  accounts: BrandSocialAccount[];
};

export function ConnectionsHealthCard({ brands, accounts }: Props) {
  const items = accounts.map((a) => {
    const brand = brands.find((b) => b.id === a.brandId);
    const days = daysSinceUpdate(a.updatedAt);
    const state: "ok" | "warn" | "critical" =
      days >= CRITICAL_DAYS ? "critical" : days >= WARN_DAYS ? "warn" : "ok";
    return { account: a, brand, days, state };
  });

  const criticalCount = items.filter((i) => i.state === "critical").length;
  const warnCount = items.filter((i) => i.state === "warn").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          <Activity className="h-5 w-5 text-primary" /> Salute connessioni social
        </CardTitle>
        <CardDescription>
          RF-11.2: monitor delle credenziali social configurate per marchio. I token Meta/LinkedIn
          hanno tipicamente scadenza 60 giorni: qui vedi quanti giorni sono passati dall&apos;ultimo
          aggiornamento. Verifica live arriva con M5 publisher (F2+).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-md border border-border bg-surface-muted/40 p-3 text-sm text-text-muted">
            Nessuna connessione social configurata. Vai su Impostazioni → Account social per
            aggiungere credenziali per Facebook, Instagram, Google Business, ecc.
          </p>
        ) : (
          <>
            {(criticalCount > 0 || warnCount > 0) && (
              <div
                className={`rounded-md border p-2 text-xs ${
                  criticalCount > 0
                    ? "border-danger/30 bg-danger/10 text-danger"
                    : "border-warning/30 bg-warning/10 text-warning"
                }`}
              >
                <AlertTriangle className="mr-1 inline-block h-3.5 w-3.5" />
                {criticalCount > 0 && (
                  <>
                    <strong>
                      {criticalCount} connession{criticalCount === 1 ? "e" : "i"} da rinnovare
                      urgentemente
                    </strong>
                    {warnCount > 0 && ", "}
                  </>
                )}
                {warnCount > 0 && (
                  <>
                    {warnCount} in attenzione (prossim{warnCount === 1 ? "a" : "e"} scadenza)
                  </>
                )}
              </div>
            )}
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="p-3">Marchio</th>
                    <th className="p-3">Piattaforma</th>
                    <th className="p-3">Ultimo update</th>
                    <th className="p-3">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ account, brand, days, state }) => (
                    <tr key={account.id} className="border-b border-border/60 last:border-0">
                      <td className="p-3">
                        {brand ? (
                          <div className="flex items-center gap-2">
                            <BrandLogo
                              logoUrl={brand.logoUrl}
                              name={brand.displayName}
                              size="xs"
                              rounded="full"
                            />
                            <Link
                              href={`/marchi/${brand.slug}`}
                              className="text-xs font-medium text-text hover:text-primary"
                            >
                              {brand.displayName}
                            </Link>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted">(marchio rimosso)</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-text">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: platformColor(account.platform) }}
                            aria-hidden="true"
                          />
                          {platformLabel(account.platform)}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-text-muted">
                        {days === 0 ? "oggi" : `${days} giorn${days === 1 ? "o" : "i"} fa`}
                      </td>
                      <td className="p-3">
                        {state === "critical" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                            <AlertTriangle className="h-3 w-3" /> RINNOVA
                          </span>
                        ) : state === "warn" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                            <AlertTriangle className="h-3 w-3" /> Attenzione
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-text-muted/70">
              Soglie: warning &gt;{WARN_DAYS}gg · critico &gt;={CRITICAL_DAYS}gg. Per rinnovare vai
              su Impostazioni → Account social → Modifica.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
