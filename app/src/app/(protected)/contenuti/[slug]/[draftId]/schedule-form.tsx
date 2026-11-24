"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scheduleContentDraft } from "@/modules/m03-editorial/public";

function nowLocalIso(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function ScheduleDraftForm({ draftId }: { draftId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const minAttr = nowLocalIso();

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
      action={async (formData: FormData) => {
        setError(null);
        setPending(true);
        try {
          const raw = String(formData.get("scheduledAt") ?? "");
          if (!raw) {
            setError("Seleziona una data e ora");
            return;
          }
          // Il valore di datetime-local è senza timezone: interpretalo come locale.
          const local = new Date(raw);
          if (Number.isNaN(local.getTime())) {
            setError("Data non valida");
            return;
          }
          await scheduleContentDraft(draftId, local.toISOString());
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="scheduledAt">Data e ora di pubblicazione</Label>
        <Input
          id="scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          min={minAttr}
          required
          disabled={pending}
        />
        <p className="text-xs text-text-muted">
          Il sistema non pubblica automaticamente in questa fase (F1.5b-α). Quando arriva il
          momento, aprirai il draft e cliccherai &quot;Segna come pubblicato&quot;.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {pending ? "Programmando…" : "Programma"}
        </Button>
      </div>
    </form>
  );
}
