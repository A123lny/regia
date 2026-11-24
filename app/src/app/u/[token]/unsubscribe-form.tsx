"use client";

import { useState, useTransition } from "react";
import type { Channel, UnsubscribeReason } from "@/modules/m05-publishing/public";
import { submitUnsubscribeDetails } from "./actions";

const REASON_LABELS: Record<UnsubscribeReason, string> = {
  too_many_messages: "Troppi messaggi",
  not_interested: "Non mi interessa",
  not_customer_anymore: "Non sono piu' cliente",
  other: "Altro (scrivi sotto)",
};

const OTHER_CHANNELS: Channel[] = ["email", "whatsapp", "sms"];

type Props = {
  token: string;
  channel: Channel;
  channelLabel: string;
};

export function UnsubscribeForm({ token, channel, channelLabel }: Props) {
  const [reason, setReason] = useState<UnsubscribeReason | "">("");
  const [reasonFree, setReasonFree] = useState("");
  const [reduceFrequency, setReduceFrequency] = useState(false);
  const [alsoChannels, setAlsoChannels] = useState<Channel[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleAlsoChannel = (ch: Channel) => {
    setAlsoChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await submitUnsubscribeDetails({
        token,
        reason: reason || null,
        reasonFree: reasonFree.trim() || null,
        reduceFrequency,
        alsoChannels,
      });
      if (res.ok) setSubmitted(true);
      else setError(res.error);
    });
  };

  if (submitted) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        Grazie. Ci aiuta sapere il motivo per non commettere lo stesso errore con altre persone.
      </div>
    );
  }

  const otherChannelOptions = OTHER_CHANNELS.filter((c) => c !== channel);

  return (
    <div className="space-y-4 border-t border-neutral-200 pt-6">
      <p className="text-sm font-medium text-neutral-700">
        Ci dai una mano a capire perche&apos;? Nessun campo e&apos; obbligatorio.
      </p>

      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700">Motivo</label>
        <div className="space-y-1">
          {(Object.keys(REASON_LABELS) as UnsubscribeReason[]).map((r) => (
            <label key={r} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                disabled={pending}
                className="mt-1"
              />
              <span>{REASON_LABELS[r]}</span>
            </label>
          ))}
        </div>
      </div>

      {reason === "other" && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-neutral-700">Scrivi liberamente</label>
          <textarea
            value={reasonFree}
            onChange={(e) => setReasonFree(e.target.value)}
            disabled={pending}
            rows={3}
            className="w-full rounded border border-neutral-300 p-2 text-sm"
          />
        </div>
      )}

      {reason === "too_many_messages" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={reduceFrequency}
              onChange={(e) => setReduceFrequency(e.target.checked)}
              disabled={pending}
              className="mt-1"
            />
            <span>
              <strong>Scrivetemi meno</strong> invece di uscire del tutto. Riceverai solo i messaggi
              veramente importanti.
            </span>
          </label>
        </div>
      )}

      {otherChannelOptions.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700">
            Vuoi uscire anche da altri canali?
          </label>
          <div className="space-y-1">
            {otherChannelOptions.map((ch) => (
              <label key={ch} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={alsoChannels.includes(ch)}
                  onChange={() => toggleAlsoChannel(ch)}
                  disabled={pending}
                  className="mt-1"
                />
                <span>
                  Disiscrivimi anche da <strong>{ch}</strong>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? "Invio…" : "Conferma"}
        </button>
        <p className="text-xs text-neutral-500">Gia&apos; disiscritto da {channelLabel}.</p>
      </div>
    </div>
  );
}
