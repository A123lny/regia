import { LogOut } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logout } from "@/app/(protected)/logout-action";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietario",
  editor: "Editor",
  delegate: "Delegato",
  agent: "Agente",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
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

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  const appVersion = process.env["npm_package_version"] ?? "0.1.0";
  const gitSha = process.env["GIT_SHA"] ?? "n/d";

  const anthropic = maskApiKey(process.env["ANTHROPIC_API_KEY"]);
  const voyage = maskApiKey(process.env["VOYAGE_API_KEY"]);
  const fal = maskApiKey(process.env["FAL_API_KEY"]);
  const gemini = maskApiKey(process.env["GEMINI_API_KEY"]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-text">Impostazioni</h1>
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

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                fal.ai (FLUX, immagini AI)
              </span>
              {fal.present ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">✅ configurata</span>
                  <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                    {fal.masked}
                  </code>
                </div>
              ) : (
                <span className="text-sm text-danger">
                  ❌ non configurata (M4-γ non funzionerà senza)
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Google Gemini (compose prompt immagine)
              </span>
              {gemini.present ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">✅ configurata</span>
                  <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                    {gemini.masked}
                  </code>
                </div>
              ) : (
                <span className="text-sm text-danger">
                  ❌ non configurata (M4-γ suggerimento prompt non funzionerà)
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
