"use client";

import { useState, useTransition } from "react";
import { updateChannelCredentialsAction, setChannelEnabledAction, testChannelAction } from "@/modules/m05-publishing/public-actions";
// Channel type inlined per evitare import da public.ts (trascina adapter twilio nel browser bundle).
type Channel = "email" | "whatsapp" | "sms" | "facebook" | "instagram" | "google";

type Props = {
  channel: Channel;
  provider: string;
  configured: boolean;
  enabled: boolean;
  verifiedAt: string | null;
  lastTestError: string | null;
};

const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email (Resend)", whatsapp: "WhatsApp (Twilio)",
  sms: "SMS", facebook: "Facebook", instagram: "Instagram", google: "Google",
};

export function ChannelCredentialsCard(props: Props) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const save = () => startTransition(async () => {
    const res = await updateChannelCredentialsAction({
      channel: props.channel, provider: props.provider, apiKey, config,
    });
    setMsg(res.ok ? "Credenziali salvate. Ora fai il test." : res.error);
  });

  const test = () => startTransition(async () => {
    const res = await testChannelAction({ channel: props.channel, testAddress: "" });
    setMsg(res.ok ? "Connessione ok" : `Test fallito: ${res.error}`);
  });

  const toggle = (enabled: boolean) => startTransition(async () => {
    const res = await setChannelEnabledAction({ channel: props.channel, enabled });
    setMsg(res.ok ? (enabled ? "Canale abilitato" : "Canale disabilitato") : res.error);
  });

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{CHANNEL_LABELS[props.channel]}</h3>
        <span className="text-sm">
          {props.verifiedAt ? "🟢 Verificato" : "⚠️ Non verificato"}
        </span>
      </div>
      <div className="space-y-2">
        <label className="text-sm block">
          API key ({props.provider})
          <div className="flex gap-2 mt-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={props.configured ? "•••••••• (inserisci per aggiornare)" : "sk_..."}
              className="flex-1 border rounded px-2 py-1"
            />
            <button type="button" onClick={() => setShowKey(!showKey)} className="text-sm underline">
              {showKey ? "Nascondi" : "Mostra"}
            </button>
          </div>
        </label>
        {props.channel === "whatsapp" && (
          <label className="text-sm block">
            Account SID (Twilio)
            <input type="text" value={config["accountSid"] ?? ""}
                   onChange={(e) => setConfig({ ...config, accountSid: e.target.value })}
                   placeholder="AC..." className="w-full border rounded px-2 py-1 mt-1" />
          </label>
        )}
        {props.channel === "email" && (
          <label className="text-sm block">
            From (indirizzo mittente)
            <input type="text" value={config["from"] ?? ""}
                   onChange={(e) => setConfig({ ...config, from: e.target.value })}
                   placeholder="info@brand.it" className="w-full border rounded px-2 py-1 mt-1" />
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={pending || !apiKey}
                className="bg-black text-white px-3 py-1 rounded text-sm">Salva</button>
        <button onClick={test} disabled={pending || !props.configured}
                className="border px-3 py-1 rounded text-sm">Test</button>
        <label className="flex items-center gap-2 text-sm ml-auto">
          <input type="checkbox" checked={props.enabled} onChange={(e) => toggle(e.target.checked)} />
          Abilitato
        </label>
      </div>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
      {props.lastTestError && !msg && (
        <p className="text-sm text-red-600">Ultimo errore: {props.lastTestError}</p>
      )}
    </div>
  );
}
