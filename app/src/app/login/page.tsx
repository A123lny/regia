import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-center font-serif text-3xl font-semibold text-text">Regìa</h1>
        {params.error && (
          <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {decodeURIComponent(params.error)}
          </p>
        )}
        <form action={login} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="bg-primary text-white hover:bg-primary-hover">
            Accedi
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-text-muted">
          Sviluppo locale: crea il primo Owner con <code>bash app/scripts/dev-create-owner.sh</code>
          <br />
          (vedi <code>docs/runbook-primo-owner.md</code>)
        </p>
      </div>
    </main>
  );
}
