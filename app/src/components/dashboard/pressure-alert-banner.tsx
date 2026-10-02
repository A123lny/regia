// RN-67: banner dashboard quando il motivo "troppi messaggi" prevale sulle disiscrizioni
// degli ultimi 30gg. Avvisa prima che il danno si estenda.

import { AlertTriangle } from "lucide-react";
import type { PressureAlert } from "@/modules/m05-publishing/public";

const CHANNEL_LABELS: Record<string, string> = {
  email: "email",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

export function PressureAlertBanner({ alerts }: { alerts: PressureAlert[] }) {
  const triggered = alerts.filter((a) => a.isAlert);
  if (triggered.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 text-amber-900">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1 space-y-2">
          <h3 className="font-serif text-base font-bold">Attenzione: pressione commerciale alta</h3>
          <p className="text-sm">
            Negli ultimi 30 giorni, piu&apos; della meta&apos; delle disiscrizioni e&apos; per{" "}
            <strong>&quot;troppi messaggi&quot;</strong>. Ridurre la frequenza prima che il danno si
            estenda.
          </p>
          <ul className="space-y-1 text-sm">
            {triggered.map((a) => {
              const pct = Math.round(a.tooManyRatio * 100);
              return (
                <li key={a.channel}>
                  <strong>{CHANNEL_LABELS[a.channel] ?? a.channel}</strong>: {a.tooMany30d}/
                  {a.revocations30d} revoche ({pct}%)
                  {a.reduceFrequency30d > 0 && (
                    <span className="text-amber-700">
                      {" "}
                      · {a.reduceFrequency30d} richieste &quot;scrivetemi meno&quot;
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
