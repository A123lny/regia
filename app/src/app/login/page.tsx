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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-12">
      {/* Sfondo con 4 blob brand colors (Lenny/Stazione/Eni/Officina), full page */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 800 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <filter id="blobBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="80" />
          </filter>
        </defs>
        <g filter="url(#blobBlur)" opacity="0.75">
          {/* Lenny — arancio caldo */}
          <circle cx="150" cy="180" r="220" fill="#FF6B35" />
          {/* Stazione — blu profondo */}
          <circle cx="680" cy="150" r="200" fill="#1E5F8C" />
          {/* Eni Cafè — marrone caldo */}
          <circle cx="180" cy="660" r="210" fill="#8C5E1E" />
          {/* Officina — grigio-blu */}
          <circle cx="650" cy="640" r="220" fill="#3E4C59" />
        </g>
      </svg>
      {/* Overlay leggibilità */}
      <div className="absolute inset-0 bg-white/50 backdrop-blur-[3px]" />

      {/* Contenuto centrato: brand + form card */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
        {/* Brand + tagline */}
        <div className="text-center">
          <h1 className="mb-3 font-serif text-6xl font-semibold tracking-tight text-text">
            Regìa
          </h1>
          <p className="mx-auto max-w-md text-sm text-text">
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
        </div>

        {/* Form card */}
        <div className="w-full rounded-lg border border-border bg-surface p-8 shadow-lg">
          {params.error && (
            <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              {safeDecodeError(params.error)}
            </p>
          )}
          <h2 className="mb-6 font-serif text-xl font-semibold text-text">
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
        </div>
      </div>
    </main>
  );
}
