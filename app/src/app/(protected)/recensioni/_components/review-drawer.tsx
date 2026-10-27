"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveReviewAction,
  markReviewPublishedAction,
  resolveSeriousAction,
  reopenSeriousForDraftAction,
  regenerateDraftAction,
  type Review,
} from "@/modules/m08-reviews/public";
import type { Brand } from "@/modules/m02-brand/public";

export function ReviewDrawer({
  review,
  brand,
  onClose,
}: {
  review: Review | null;
  brand: Brand | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draftText, setDraftText] = useState("");
  const [notesText, setNotesText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!review || !brand) return null;

  function refresh() {
    router.refresh();
    onClose();
  }

  async function doApprove() {
    const text = draftText.trim() || review!.suggestedReply?.trim() || "";
    const r = await approveReviewAction({ reviewId: review!.id, approvedReply: text });
    if (!r.ok) setErr(r.error);
    else refresh();
  }

  async function doMarkPublished() {
    const r = await markReviewPublishedAction({ reviewId: review!.id });
    if (!r.ok) setErr(r.error);
    else refresh();
  }

  async function doResolveSerious() {
    const r = await resolveSeriousAction({ reviewId: review!.id, resolvedNotes: notesText });
    if (!r.ok) setErr(r.error);
    else refresh();
  }

  async function doReopenForDraft() {
    const r = await reopenSeriousForDraftAction({ reviewId: review!.id });
    if (!r.ok) setErr(r.error);
    else refresh();
  }

  async function doRegenerate() {
    const r = await regenerateDraftAction({ reviewId: review!.id });
    if (!r.ok) setErr(r.error);
    else refresh();
  }

  async function copyToClipboard() {
    const text = review!.approvedReply ?? "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setErr("Impossibile copiare negli appunti (controlla permessi browser).");
    }
  }

  const googleUrl = brand.googlePlaceId
    ? `https://search.google.com/local/reviews?placeid=${encodeURIComponent(brand.googlePlaceId)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-[560px] overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500">{brand.displayName}</div>
            <h2 className="font-serif text-2xl">{review.authorName ?? "Anonimo"}</h2>
            <div className="text-amber-600">{"★".repeat(review.rating)}</div>
          </div>
          <button className="text-slate-500" onClick={onClose}>
            ✕
          </button>
        </div>

        <section className="mt-4 rounded border border-slate-200 p-3 text-sm">
          {review.textOriginal ?? "(nessun testo)"}
        </section>

        {err && (
          <p className="mt-3 rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-600">
            {err}
          </p>
        )}

        {review.status === "pending" && (
          <section className="mt-4">
            <p className="text-sm text-slate-500">Bozza in generazione…</p>
            <button
              className="mt-2 rounded border px-3 py-1 text-sm"
              disabled={isPending}
              onClick={() => startTransition(doRegenerate)}
            >
              Genera bozza ora
            </button>
          </section>
        )}

        {review.status === "draft_ready" && (
          <section className="mt-4">
            <label className="block text-sm font-medium">Bozza di risposta</label>
            <textarea
              className="mt-1 block w-full rounded border-slate-300"
              rows={6}
              defaultValue={review.suggestedReply ?? ""}
              onChange={(e) => setDraftText(e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500">
              {(draftText || review.suggestedReply || "").length}/500
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white"
                disabled={isPending}
                onClick={() => startTransition(doApprove)}
              >
                Approva risposta
              </button>
              <button
                className="rounded border px-3 py-1.5 text-sm"
                disabled={isPending}
                onClick={() => startTransition(doRegenerate)}
              >
                Rigenera
              </button>
            </div>
          </section>
        )}

        {review.status === "approved" && (
          <section className="mt-4">
            <label className="block text-sm font-medium">Risposta approvata</label>
            <div className="mt-1 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              {review.approvedReply}
            </div>
            <div className="mt-3 flex gap-2">
              <button className="rounded border px-3 py-1.5 text-sm" onClick={copyToClipboard}>
                Copia negli appunti
              </button>
              {googleUrl && (
                <a
                  className="rounded border px-3 py-1.5 text-sm"
                  href={googleUrl}
                  target="_blank"
                  rel="noopener"
                >
                  Apri Google ↗
                </a>
              )}
              <button
                className="rounded bg-emerald-600 px-4 py-1.5 text-sm text-white"
                disabled={isPending}
                onClick={() => startTransition(doMarkPublished)}
              >
                Fatto, pubblicata
              </button>
            </div>
          </section>
        )}

        {review.status === "published_externally" && (
          <section className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
            Pubblicata su Google il{" "}
            {new Date(review.publishedExternallyAt!).toLocaleString("it-IT")}.
          </section>
        )}

        {review.status === "serious_signaled" && (
          <section className="mt-4 space-y-3">
            <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
              Caso grave segnalato (RF-8.4). Prima si risolve privatamente con la persona, poi si
              decide se rispondere pubblicamente.
            </div>
            <label className="block text-sm font-medium">Come hai risolto?</label>
            <textarea
              className="block w-full rounded border-slate-300"
              rows={4}
              placeholder="Minimo 20 caratteri — audit trail (RF-11.3)."
              onChange={(e) => setNotesText(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-40"
                disabled={isPending || notesText.trim().length < 20}
                onClick={() => startTransition(doResolveSerious)}
              >
                Risolto privatamente
              </button>
              <button
                className="rounded border px-3 py-1.5 text-sm"
                disabled={isPending}
                onClick={() => startTransition(doReopenForDraft)}
              >
                Prepara risposta ora
              </button>
            </div>
          </section>
        )}

        {review.status === "serious_resolved" && (
          <section className="mt-4">
            <label className="block text-sm font-medium">Note risoluzione</label>
            <div className="mt-1 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              {review.resolvedNotes}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
