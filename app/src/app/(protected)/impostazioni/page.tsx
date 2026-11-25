import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Share2 } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Impostazioni" };
import { getAdminClient } from "@/lib/db/admin";
import { ROLE_LABELS, hasCapability, type Role } from "@/lib/auth/permissions";
import {
  listBrands,
  listBrandSocialAccounts,
  SOCIAL_PLATFORMS,
  type BrandSocialAccount,
} from "@/modules/m02-brand/public";
import {
  getAiSafetyStatus,
  getSpendSummaries,
  getPlatformBranding,
} from "@/modules/m11-admin/public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logout } from "@/app/(protected)/logout-action";
import { SocialConfigClient } from "./social-config-client";
import { AiKillSwitchCard } from "@/components/admin/ai-kill-switch-card";
import { AiBudgetsCard } from "@/components/admin/ai-budgets-card";
import { ConnectionsHealthCard } from "@/components/admin/connections-health-card";
import { PlatformBrandingCard } from "@/components/admin/platform-branding-card";
import { HelpButton } from "@/components/help/help-button";
import { ChannelCredentialsCard } from "@/components/admin/channel-credentials-card";
import { listChannelsAction } from "@/modules/m05-publishing";

const ROLE_VARIANTS: Record<Role, "default" | "secondary" | "outline"> = {
  owner: "default",
  editor: "secondary",
  delegate: "outline",
  agent: "outline",
};

function maskUrl(url: string): string {
  // Maschera gli ultimi N caratteri prima del path
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host.length <= 4) return url;
    const masked = host.slice(0, host.length - 4) + "****";
    u.hostname = masked;
    return u.origin;
  } catch {
    return url.slice(0, url.length - 4) + "****";
  }
}

function maskApiKey(raw: string | undefined): { present: boolean; masked: string } {
  const key = (raw ?? "").trim();
  if (!key) return { present: false, masked: "" };
  // Non mostrare byte finali della key (fingerprint). Prefix (max 8 char) + lunghezza.
  const prefix = key.slice(0, Math.min(8, key.length));
  return { present: true, masked: `${prefix}… (${key.length} char)` };
}

export default async function ImpostazioniPage() {
  const session = await getSessionOrRedirect();
  const admin = getAdminClient();

  const { data: userRow } = await admin.auth.admin.getUserById(session.userId);
  const email = userRow.user?.email ?? "—";

  // AI kill switch + budget: solo Owner (team.manage)
  const canManageAiSafety = hasCapability(session.role, "team.manage");
  const aiSafetyStatus = canManageAiSafety ? await getAiSafetyStatus(session.organizationId) : null;
  const aiSpendSummaries = canManageAiSafety
    ? await getSpendSummaries(session.organizationId)
    : null;
  const platformBranding = canManageAiSafety
    ? await getPlatformBranding(session.organizationId)
    : null;

  // Social accounts config: solo Owner (credentials sono dati sensibili)
  const canConfigureSocial = hasCapability(session.role, "brand.crud");
  const brands = canConfigureSocial ? await listBrands(session.organizationId, "active") : [];
  const socialAccounts: BrandSocialAccount[] = [];
  if (canConfigureSocial) {
    for (const b of brands) {
      const accs = await listBrandSocialAccounts(session.organizationId, b.id);
      socialAccounts.push(...accs);
    }
  }

  // Canali di invio: solo Owner (publishing.credentials.manage)
  const canManageChannels = hasCapability(session.role, "publishing.credentials.manage");
  const channels = canManageChannels ? await listChannelsAction() : [];
  const emailCred = channels.find((c) => c.channel === "email");
  const waCred = channels.find((c) => c.channel === "whatsapp");

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  const appVersion = process.env["npm_package_version"] ?? "0.1.0";
  const gitSha = process.env["GIT_SHA"] ?? "n/d";

  const anthropic = maskApiKey(process.env["ANTHROPIC_API_KEY"]);
  const voyage = maskApiKey(process.env["VOYAGE_API_KEY"]);
  const gemini = maskApiKey(process.env["GEMINI_API_KEY"]);
  const falKey = maskApiKey(process.env["FAL_KEY"]);
  const creatomateKey = maskApiKey(process.env["CREATOMATE_API_KEY"]);

  // Commit sha (Vercel ne espone la versione completa; la tagliamo a 7 char).
  const commitSha = (process.env["VERCEL_GIT_COMMIT_SHA"] ?? "").slice(0, 7) || "dev";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-text-muted">
          Profilo, chiavi API, kill switch AI, tetti spesa e integrazioni.
        </p>
        <HelpButton pageKey="impostazioni" />
      </div>

      {/* Sezione profilo */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Il tuo profilo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Email
            </span>
            <span className="text-sm text-text">{email}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Ruolo
            </span>
            <div>
              <Badge variant={ROLE_VARIANTS[session.role] ?? "outline"}>
                {ROLE_LABELS[session.role] ?? session.role}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Organization ID
            </span>
            <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
              {session.organizationId}
            </code>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">MFA</span>
            <span className="text-sm text-text-muted">
              Non richiesto in F0-b.{" "}
              <span className="text-xs text-text-muted/70">
                (Attivazione pianificata in fase successiva.)
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* AI kill switch — solo Owner */}
      {canManageAiSafety && aiSafetyStatus && <AiKillSwitchCard initialStatus={aiSafetyStatus} />}

      {/* Tetti spesa AI — solo Owner */}
      {canManageAiSafety && aiSpendSummaries && <AiBudgetsCard summaries={aiSpendSummaries} />}

      {/* Salute connessioni social — solo Owner */}
      {canConfigureSocial && <ConnectionsHealthCard brands={brands} accounts={socialAccounts} />}

      {/* White label piattaforma — solo Owner */}
      {canManageAiSafety && platformBranding && <PlatformBrandingCard initial={platformBranding} />}

      {/* Sezione Account social (per-brand, per-platform) — solo Owner */}
      {canConfigureSocial && (
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Share2 className="h-5 w-5" /> Account social
            </CardTitle>
            <CardDescription>
              Credenziali di pubblicazione per ogni marchio e piattaforma (predisposizione M14
              auto-publishing). Le credenziali sono al sicuro nel DB e mai mostrate in chiaro dopo
              il primo salvataggio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SocialConfigClient
              brands={brands}
              accounts={socialAccounts}
              schemas={SOCIAL_PLATFORMS}
            />
          </CardContent>
        </Card>
      )}

      {/* Canali di invio (email/WhatsApp) — solo Owner */}
      {canManageChannels && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Canali di invio</h2>
          <p className="text-sm text-gray-600">
            Configura le API key dei provider (Resend per email, Twilio per WhatsApp). Le chiavi
            sono cifrate in Supabase Vault, mai visibili in chiaro dopo il salvataggio.
          </p>
          <ChannelCredentialsCard
            channel="email"
            provider="resend"
            configured={!!emailCred}
            enabled={emailCred?.enabled ?? false}
            verifiedAt={emailCred?.verifiedAt ?? null}
            lastTestError={emailCred?.lastTestError ?? null}
          />
          <ChannelCredentialsCard
            channel="whatsapp"
            provider="twilio"
            configured={!!waCred}
            enabled={waCred?.enabled ?? false}
            verifiedAt={waCred?.verifiedAt ?? null}
            lastTestError={waCred?.lastTestError ?? null}
          />
        </section>
      )}

      {/* Link a sotto-pagine di config avanzata */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Configurazioni avanzate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Link
            href="/impostazioni/ricorrenze"
            className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 hover:border-primary/40"
          >
            <span className="text-text">Ricorrenze annuali</span>
            <span className="text-xs text-text-muted">Natale, gomme, ferie...</span>
          </Link>
          {session.role === "owner" && (
            <>
              <Link
                href="/impostazioni/memoria-agente"
                className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 hover:border-primary/40"
              >
                <span className="text-text">Memoria agente</span>
                <span className="text-xs text-text-muted">
                  Cosa l&apos;AI ha imparato dall&apos;uso
                </span>
              </Link>
              <Link
                href="/impostazioni/provider-media"
                className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 hover:border-primary/40"
              >
                <span className="text-text">Provider media</span>
                <span className="text-xs text-text-muted">
                  ToS/diritti fornitori AI immagini/video
                </span>
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sezione ambiente */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Ambiente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              URL Supabase
            </span>
            <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
              {supabaseUrl ? maskUrl(supabaseUrl) : "—"}
            </code>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Versione app
            </span>
            <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
              {appVersion}
            </code>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Commit
            </span>
            <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">{gitSha}</code>
          </div>
        </CardContent>
      </Card>

      {/* Sezione chiavi AI (read-only, RNF-1) — solo Owner */}
      {session.role === "owner" && (
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Chiavi AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Google Gemini (generazione testi, robottino)
              </span>
              {gemini.present ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">chiave presente</span>
                  <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                    {gemini.masked}
                  </code>
                </div>
              ) : (
                <span className="text-sm text-danger">chiave non impostata</span>
              )}
              <span className="text-[11px] text-text-muted/80">
                &quot;Chiave presente&quot; non significa &quot;chiamata riuscita&quot;: una chiave
                scaduta o senza budget pu&ograve; comunque fallire a runtime.
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Anthropic API (Claude, generazione testi)
              </span>
              {anthropic.present ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">chiave presente</span>
                  <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                    {anthropic.masked}
                  </code>
                </div>
              ) : (
                <span className="text-sm text-danger">chiave non impostata</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Voyage AI (embeddings, retrieval anti-pattern)
              </span>
              {voyage.present ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">chiave presente</span>
                  <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                    {voyage.masked}
                  </code>
                </div>
              ) : (
                <span className="text-sm text-danger">
                  non configurata (opzionale)
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                fal.ai (generazione immagini)
              </span>
              {falKey.present ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">chiave presente</span>
                  <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                    {falKey.masked}
                  </code>
                </div>
              ) : (
                <span className="text-sm text-danger">chiave non impostata</span>
              )}
              <span className="text-[11px] text-text-muted/80">
                Oltre alla chiave serve un provider attivo con slug <code>fal-ai</code> in{" "}
                <Link href="/impostazioni/provider-media" className="underline hover:no-underline">
                  Provider media
                </Link>
                .
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Creatomate (video e immagini da template)
              </span>
              {creatomateKey.present ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">chiave presente</span>
                  <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                    {creatomateKey.masked}
                  </code>
                </div>
              ) : (
                <span className="text-sm text-danger">chiave non impostata</span>
              )}
              <span className="text-[11px] text-text-muted/80">
                Oltre alla chiave serve un provider attivo con slug <code>creatomate</code> in{" "}
                <Link href="/impostazioni/provider-media" className="underline hover:no-underline">
                  Provider media
                </Link>
                . I template specifici per marchio si registrano in Marchio → sezione Creatomate.
              </span>
            </div>

            <p className="border-t border-border pt-3 text-xs text-text-muted">
              Le chiavi sono configurate come variabili d&apos;ambiente del deploy.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Versione/commit in produzione — utile per capire se un fix è attivo */}
      <div className="border-t border-border pt-4 text-xs text-text-muted">
        Versione:{" "}
        <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px]">{commitSha}</code>
      </div>

      {/* Logout */}
      <div className="pt-2">
        <form action={logout}>
          <Button
            type="submit"
            variant="outline"
            className="flex items-center gap-2 border-danger/40 text-danger hover:bg-danger/10"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Esci dalla piattaforma
          </Button>
        </form>
      </div>
    </div>
  );
}
