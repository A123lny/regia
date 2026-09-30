import Link from "next/link";
import { LogOut, Share2 } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
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
import { listChannelsAction } from "@/modules/m05-publishing/public-actions";

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

  // Canali di invio (RF-2.7): solo Owner (publishing.credentials.manage)
  const canManageChannels = hasCapability(session.role, "publishing.credentials.manage");
  const channels = canManageChannels ? await listChannelsAction() : [];
  const emailCred = channels.find((c) => c.channel === "email");
  const waCred = channels.find((c) => c.channel === "whatsapp");

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  const appVersion = process.env["npm_package_version"] ?? "0.1.0";
  const gitSha = process.env["GIT_SHA"] ?? "n/d";

  const anthropic = maskApiKey(process.env["ANTHROPIC_API_KEY"]);
  const voyage = maskApiKey(process.env["VOYAGE_API_KEY"]);

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-serif text-3xl font-semibold text-text">Impostazioni</h1>
          <HelpButton pageKey="impostazioni" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Profilo utente e informazioni sull&apos;ambiente di esecuzione.
        </p>
      </header>

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

      {/* RF-11.4 AI kill switch — solo Owner */}
      {canManageAiSafety && aiSafetyStatus && <AiKillSwitchCard initialStatus={aiSafetyStatus} />}

      {/* RF-11.5 Tetti spesa AI — solo Owner */}
      {canManageAiSafety && aiSpendSummaries && <AiBudgetsCard summaries={aiSpendSummaries} />}

      {/* RF-11.2 Salute connessioni social — solo Owner */}
      {canConfigureSocial && <ConnectionsHealthCard brands={brands} accounts={socialAccounts} />}

      {/* RF-2.7 White label piattaforma — solo Owner */}
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

      {/* RF-2.7 Canali di invio (email/WhatsApp) — solo Owner */}
      {canManageChannels && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Canali di invio</h2>
          <p className="text-sm text-gray-600">
            Configura le API key dei provider (Resend per email, Twilio per WhatsApp). Le chiavi
            sono cifrate in Supabase Vault, mai visibili in chiaro dopo il salvataggio.
          </p>
          <ChannelCredentialsCard
            channel="email" provider="resend"
            configured={!!emailCred} enabled={emailCred?.enabled ?? false}
            verifiedAt={emailCred?.verifiedAt ?? null}
            lastTestError={emailCred?.lastTestError ?? null}
          />
          <ChannelCredentialsCard
            channel="whatsapp" provider="twilio"
            configured={!!waCred} enabled={waCred?.enabled ?? false}
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
            <span className="text-text">Ricorrenze annuali (RF-12.4)</span>
            <span className="text-xs text-text-muted">Natale, gomme, ferie...</span>
          </Link>
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

      {/* Sezione chiavi AI (read-only, RNF-1) — solo Owner (RU-1a) */}
      {session.role === "owner" && (
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Chiavi AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Anthropic API (Claude, generazione testi)
              </span>
              {anthropic.present ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">✅ configurata</span>
                  <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                    {anthropic.masked}
                  </code>
                </div>
              ) : (
                <span className="text-sm text-danger">❌ non configurata</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Voyage AI (embeddings, retrieval anti-pattern)
              </span>
              {voyage.present ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">✅ configurata</span>
                  <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                    {voyage.masked}
                  </code>
                </div>
              ) : (
                <span className="text-sm text-danger">
                  ❌ non configurata (opzionale — F1.5a degrada senza)
                </span>
              )}
            </div>

            <p className="border-t border-border pt-3 text-xs text-text-muted">
              La modifica delle chiavi avviene in <code>app/.env.local</code> (edit + riavvio dev
              server). UI di edit + test connessione prevista in F1.6 configurazione runtime.
            </p>
          </CardContent>
        </Card>
      )}

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
