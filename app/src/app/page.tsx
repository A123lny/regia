import Link from "next/link";
import {
  Fuel,
  Coffee,
  Wrench,
  ShoppingBag,
  Sparkles,
  MessageSquare,
  Gift,
  BarChart3,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Pallini colorati per ciascun marchio
function BrandDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

// Divisore ornamentale — 3 pallini terracotta separati da linee sottili
function OrnamentalDivider() {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      <span className="h-px w-16 bg-[#C25A3B]/30" />
      <span className="h-2 w-2 rounded-full bg-[#C25A3B]/60" />
      <span className="h-px w-6 bg-[#C25A3B]/30" />
      <span className="h-2 w-2 rounded-full bg-[#C25A3B]/80" />
      <span className="h-px w-6 bg-[#C25A3B]/30" />
      <span className="h-2 w-2 rounded-full bg-[#C25A3B]/60" />
      <span className="h-px w-16 bg-[#C25A3B]/30" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="flex min-h-[500px] flex-col items-center justify-center px-6 py-20 text-center">
        <Badge variant="secondary" className="mb-8 text-xs tracking-wide">
          Cantiere F0 · in costruzione
        </Badge>

        <h1 className="font-serif text-7xl font-semibold leading-none tracking-tight text-text md:text-8xl">
          Regìa
        </h1>

        <p className="mt-6 max-w-xl font-serif text-xl italic leading-relaxed text-text-muted">
          Piattaforma di marketing e operazioni commerciali per il gruppo Lenny e la stazione Eni di
          San Marino.
        </p>

        <OrnamentalDivider />

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-primary text-white hover:bg-primary-hover">
            <Link href="/login">Accedi alla piattaforma</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#marchi">Scopri di più</a>
          </Button>
        </div>
      </section>

      {/* ── SEZIONE MARCHI ───────────────────────────────────────── */}
      <section id="marchi" className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-3xl font-semibold text-text md:text-4xl">
              I quattro marchi
            </h2>
            <p className="mt-3 text-sm text-text-muted">
              Voci distinte, obiettivi complementari, un solo strumento di regia.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {/* Lenny */}
            <Card className="border-border bg-surface hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-[#FF6B35]" aria-hidden="true" />
                  <BrandDot color="#FF6B35" />
                  <span className="font-semibold text-text">Lenny</span>
                </div>
                <p className="text-sm leading-relaxed text-text-muted">
                  Food delivery e spesa a domicilio. Frequenza e riattivazione.
                </p>
              </CardContent>
            </Card>

            {/* Stazione */}
            <Card className="border-border bg-surface hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-[#1E5F8C]" aria-hidden="true" />
                  <BrandDot color="#1E5F8C" />
                  <span className="font-semibold text-text">Stazione</span>
                </div>
                <p className="text-sm leading-relaxed text-text-muted">
                  Carburanti, lavaggi, shop. Notorietà residenti e nuovi servizi.
                </p>
              </CardContent>
            </Card>

            {/* Eni Cafè */}
            <Card className="border-border bg-surface hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Coffee className="h-5 w-5 text-[#8C5E1E]" aria-hidden="true" />
                  <BrandDot color="#8C5E1E" />
                  <span className="font-semibold text-text">Eni Cafè</span>
                </div>
                <p className="text-sm leading-relaxed text-text-muted">
                  Il bar in apertura. Voce quotidiana, cadenza giornaliera.
                </p>
              </CardContent>
            </Card>

            {/* Officina */}
            <Card className="border-border bg-surface hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-[#556B2F]" aria-hidden="true" />
                  <BrandDot color="#556B2F" />
                  <span className="font-semibold text-text">Officina</span>
                </div>
                <p className="text-sm leading-relaxed text-text-muted">
                  Tagliandi, gomme, piccoli lavori. Fiducia e prime recensioni.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── SEZIONE FEATURE ─────────────────────────────────────── */}
      <section className="bg-surface-muted px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-3xl font-semibold text-text md:text-4xl">
              Cosa fa la piattaforma
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex gap-3 rounded-lg border border-border bg-surface p-5">
              <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold text-text">Piani editoriali</p>
                <p className="mt-1 text-sm text-text-muted">
                  Contenuti coerenti con l&apos;identità di ogni marchio.
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-border bg-surface p-5">
              <MessageSquare
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-text">Pubblicazione multicanale</p>
                <p className="mt-1 text-sm text-text-muted">Social, email, WhatsApp, Google.</p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-border bg-surface p-5">
              <Gift className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold text-text">Voucher incrociati</p>
                <p className="mt-1 text-sm text-text-muted">
                  Un lavaggio guadagna un ordine, un ordine premia un tagliando.
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-border bg-surface p-5">
              <BarChart3 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold text-text">Analytics per marchio</p>
                <p className="mt-1 text-sm text-text-muted">
                  Frequenza, riattivazioni, travaso tra marche.
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-border bg-surface p-5">
              <Wrench className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold text-text">Rete ristoranti</p>
                <p className="mt-1 text-sm text-text-muted">
                  50 micro-partner, non una lista di destinatari.
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-border bg-surface p-5">
              <ScrollText
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-text">Autonomia progressiva</p>
                <p className="mt-1 text-sm text-text-muted">
                  L&apos;AI propone, l&apos;operatore approva. Cresce sui numeri.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-surface px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 h-px bg-border" aria-hidden="true" />
          <div className="text-center">
            <p className="font-serif text-base font-medium text-text">
              Regìa <span className="font-sans font-normal text-text-muted">· Cantiere F0</span>
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Sviluppo locale · 14 settembre 2026 · Fase F1.1 layout in corso
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
