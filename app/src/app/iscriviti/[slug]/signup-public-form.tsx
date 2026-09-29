"use client";

// Form pubblico di iscrizione. No auth. Chiama server action `submitSignupClient`.

import { useState, useTransition } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitSignupClient } from "./actions";
import type { AudienceKind, ConsentChannel } from "@/modules/m10-signup/public";

type Props = {
  landingSlug: string;
  audiencePrompt: string | null;
  audienceResidenteLabel: string;
  audienceTuristaLabel: string;
};

export function SignupPublicForm({
  landingSlug,
  audiencePrompt,
  audienceResidenteLabel,
  audienceTuristaLabel,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ code: string | null; message: string } | null>(null);
  const [channels, setChannels] = useState<Set<ConsentChannel>>(new Set(["email"]));

  function toggleChannel(ch: ConsentChannel) {
    const next = new Set(channels);
    if (next.has(ch)) next.delete(ch);
    else next.add(ch);
    setChannels(next);
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <div>
          <h2
            className="text-2xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Grazie!
          </h2>
          <p className="mt-2 text-sm text-text-muted">{success.message}</p>
        </div>
        {success.code && (
          <div className="rounded-lg border-2 border-dashed border-success/40 bg-success/5 p-4">
            <div className="text-xs uppercase tracking-widest text-success/70">
              Codice benvenuto
            </div>
            <code
              className="mt-2 block text-3xl font-bold tracking-widest text-success"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {success.code}
            </code>
            <p className="mt-2 text-xs text-text-muted">
              Salvalo o fanne uno screenshot. Presentalo al banco per il riscatto.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof submitSignupClient>[0] = {
            landingSlug,
            channelsGranted: Array.from(channels),
          };
          const firstName = String(fd.get("firstName") ?? "").trim();
          if (firstName) payload.firstName = firstName;
          const lastName = String(fd.get("lastName") ?? "").trim();
          if (lastName) payload.lastName = lastName;
          const email = String(fd.get("email") ?? "").trim();
          if (email) payload.email = email;
          const phone = String(fd.get("phone") ?? "").trim();
          if (phone) payload.phone = phone;
          const whatsapp = String(fd.get("whatsapp") ?? "").trim();
          if (whatsapp) payload.whatsapp = whatsapp;
          const audience = String(fd.get("audience") ?? "").trim();
          if (audience) payload.audienceKind = audience as AudienceKind;
          const honeypot = String(fd.get("website") ?? "").trim();
          if (honeypot) payload.honeypot = honeypot;

          const result = await submitSignupClient(payload);
          if (result.ok) {
            setSuccess({ code: result.welcomeCode, message: result.message });
          } else {
            setError(result.error);
          }
        });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="firstName">Nome</Label>
          <Input id="firstName" name="firstName" maxLength={100} placeholder="Mario" />
        </div>
        <div>
          <Label htmlFor="lastName">Cognome</Label>
          <Input id="lastName" name="lastName" maxLength={100} placeholder="Rossi" />
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          maxLength={200}
          placeholder="mario.rossi@example.com"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" type="tel" maxLength={40} placeholder="+39 ..." />
        </div>
        <div>
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" type="tel" maxLength={40} placeholder="+39 ..." />
        </div>
      </div>

      {audiencePrompt && (
        <div>
          <Label>{audiencePrompt}</Label>
          <div className="mt-1 space-y-1.5">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-bg p-2 text-sm hover:bg-surface-muted">
              <input type="radio" name="audience" value="residente" className="accent-primary" />
              {audienceResidenteLabel}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-bg p-2 text-sm hover:bg-surface-muted">
              <input type="radio" name="audience" value="turista" className="accent-primary" />
              {audienceTuristaLabel}
            </label>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-bg p-3">
        <Label className="text-xs">Voglio ricevere aggiornamenti via</Label>
        <div className="mt-2 space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={channels.has("email")}
              onChange={() => toggleChannel("email")}
              className="h-4 w-4 accent-primary"
            />
            Email
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={channels.has("sms")}
              onChange={() => toggleChannel("sms")}
              className="h-4 w-4 accent-primary"
            />
            SMS
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={channels.has("whatsapp")}
              onChange={() => toggleChannel("whatsapp")}
              className="h-4 w-4 accent-primary"
            />
            WhatsApp
          </label>
        </div>
      </div>

      {/* Honeypot: campo nascosto, i bot lo compilano — se pieno rifiutiamo */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
        aria-hidden="true"
      />

      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={pending || channels.size === 0}
        className="w-full bg-primary py-6 text-base font-semibold text-white hover:bg-primary-hover"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {pending ? "Iscrizione in corso..." : "Iscrivimi"}
      </Button>
    </form>
  );
}
