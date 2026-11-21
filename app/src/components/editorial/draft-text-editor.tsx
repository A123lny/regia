// Editor del testo generato di una bozza. Form server-action.
// Permette all'owner di correggere a mano il testo prima dell'approvazione.
// Bozze published/rejected sono read-only (coerente con policy).

import { Pencil } from "lucide-react";
import { updateContentDraftGeneratedText } from "@/modules/m03-editorial/public";

type Props = {
  draftId: string;
  currentText: string;
  disabled?: boolean;
};

export function DraftTextEditor({ draftId, currentText, disabled }: Props) {
  if (disabled) return null;

  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        const newText = String(formData.get("generatedText") ?? "");
        await updateContentDraftGeneratedText(draftId, newText);
      }}
      className="space-y-2 rounded-md border border-border bg-surface p-3"
    >
      <label
        htmlFor={`generated-${draftId}`}
        className="flex items-center gap-2 text-xs font-medium text-text-muted"
      >
        <Pencil className="h-3.5 w-3.5" /> Modifica testo generato
      </label>
      <textarea
        id={`generated-${draftId}`}
        name="generatedText"
        defaultValue={currentText}
        rows={8}
        maxLength={5000}
        className="w-full rounded-md border border-border bg-bg p-3 text-sm text-text focus:border-primary focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-text-muted">
          Max 5000 caratteri. Il testo pubblicato in archivio sara&apos; quello salvato qui.
        </p>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
        >
          Salva testo
        </button>
      </div>
    </form>
  );
}
