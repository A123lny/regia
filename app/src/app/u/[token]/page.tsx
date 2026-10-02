// RN-64..66 Landing pubblica di disiscrizione.
//
// Vincolo tecnico assoluto (RN-64): il consenso del canale e' revocato
// SUBITO al load della pagina, PRIMA del render del form. Se l'utente
// chiude la pagina a meta', la disiscrizione resta valida.

import { headers } from "next/headers";
import { revokeConsentFromToken, resolveUnsubscribeToken } from "@/modules/m05-publishing/public";
import { UnsubscribeForm } from "./unsubscribe-form";

type PageProps = { params: Promise<{ token: string }> };

const CHANNEL_LABELS: Record<string, string> = {
  email: "email",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

export default async function UnsubscribePage({ params }: PageProps) {
  const { token } = await params;

  // Pre-check: token esistente?
  const resolved = await resolveUnsubscribeToken(token);
  if (!resolved) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-16 text-neutral-800">
        <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow">
          <h1 className="mb-4 text-2xl font-bold">Link non valido</h1>
          <p>
            Questo link di disiscrizione non e&apos; valido o e&apos; stato gia&apos; consumato.
          </p>
          <p className="mt-4 text-sm text-neutral-500">
            Se continui a ricevere messaggi che non desideri, scrivi a chi te li manda e chiedi la
            rimozione manuale.
          </p>
        </div>
      </main>
    );
  }

  // RN-64: revoca immediata, prima del form.
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? undefined;
  const revokeResult = await revokeConsentFromToken(token, ip);
  if (!revokeResult.ok) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-16 text-neutral-800">
        <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow">
          <h1 className="mb-4 text-2xl font-bold">Errore</h1>
          <p>
            Non siamo riusciti a elaborare la disiscrizione automatica. Riprova tra qualche minuto.
          </p>
          <p className="mt-2 text-xs text-neutral-400">Dettagli: {revokeResult.error}</p>
        </div>
      </main>
    );
  }

  const channelLabel = CHANNEL_LABELS[resolved.channel] ?? resolved.channel;

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16 text-neutral-800">
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-full bg-emerald-100 p-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-emerald-600"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Fatto</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Sei stato disiscritto dal canale <strong>{channelLabel}</strong>. Non riceverai
              piu&apos; messaggi su questo canale.
            </p>
          </div>
        </div>

        <UnsubscribeForm token={token} channel={resolved.channel} channelLabel={channelLabel} />
      </div>
    </main>
  );
}
