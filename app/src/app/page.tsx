import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <h1 className="font-serif text-5xl font-semibold text-text md:text-6xl">Regìa</h1>
      <p className="mt-4 max-w-lg text-lg text-text-muted">
        Piattaforma di marketing e operazioni commerciali multi-marchio. Gruppo Lenny + Stazione,
        San Marino.
      </p>
      <Button asChild size="lg" className="mt-8 bg-primary text-white hover:bg-primary-hover">
        <Link href="/login">Accedi</Link>
      </Button>
      <footer className="mt-16 text-xs text-text-muted">
        Cantiere F0 · 8 set 2026 · Fase corrente: F1.1 layout
      </footer>
    </main>
  );
}
