import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./password-field";

function safeDecodeError(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Left panel: brand blobs + tagline (fusion visiva dei 4 marchi) */}
      <div className="relative flex min-h-[32vh] items-center justify-center overflow-hidden bg-bg lg:min-h-screen lg:w-1/2">
        {/* 4 blob SVG con colori marchio, sfocati e sovrapposti */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 800 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <filter id="blobBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="70" />
            </filter>
          </defs>
          <g filter="url(#blobBlur)" opacity="0.85">
            {/* Lenny — arancio caldo */}
            <circle cx="180" cy="210" r="200" fill="#FF6B35" />
            {/* Stazione — blu profondo */}
            <circle cx="620" cy="180" r="180" fill="#1E5F8C" />
            {/* Eni Cafè — marrone caldo */}
            <circle cx="220" cy="620" r="190" fill="#8C5E1E" />
            {/* Officina — grigio-blu */}
            <circle cx="600" cy="600" r="200" fill="#3E4C59" />
          </g>
        </svg>
        {/* Overlay per leggibilità testo */}
        <div className="absolute inset-0 bg-white/55 backdrop-blur-[2px]" />
        {/* Contenuto: brand name + tagline + footer */}
        <div className="relative z-10 px-8 text-center lg:px-16">
          <h1 className="mb-4 font-serif text-6xl font-semibold tracking-tight text-text lg:text-7xl">
            Regìa
          </h1>
          <p className="mx-auto max-w-md text-base text-text lg:text-lg">
            Marketing e operazioni per{" "}
            <span className="font-medium" style={{ color: "#FF6B35" }}>
              Lenny
            </span>
            ,{" "}
            <span className="font-medium" style={{ color: "#1E5F8C" }}>
              Stazione
            </span>
            ,{" "}
            <span className="font-medium" style={{ color: "#8C5E1E" }}>
              Eni Cafè
            </span>{" "}
            e{" "}
            <span className="font-medium" style={{ color: "#3E4C59" }}>
              Officina
            </span>
            .
          </p>
          <p className="mt-8 text-xs uppercase tracking-[0.2em] text-text-muted">
            Gruppo Cervellini · San Marino
          </p>
        </div>
      </div>

      {/* Right panel: form login */}
      <div className="flex flex-1 items-center justify-center bg-surface px-4 py-12 lg:px-8">
        <div className="w-full max-w-sm">
          {params.error && (
            <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              {safeDecodeError(params.error)}
            </p>
          )}
          <h2 className="mb-6 font-serif text-2xl font-semibold text-text">
            Accedi alla piattaforma
          </h2>
          <form action={login} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordField />
            </div>
            <Button
              type="submit"
              className="mt-2 bg-primary text-white hover:bg-primary-hover"
            >
              Accedi
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-text-muted">
            Sviluppo locale: crea il primo Owner con{" "}
            <code>bash app/scripts/dev-create-owner.sh</code>
            <br />
            (vedi <code>docs/runbook-primo-owner.md</code>)
          </p>
        </div>
      </div>
    </main>
  );
}
