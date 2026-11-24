"use client";

import { useState } from "react";
import {
  CLASSIFICATION_LABELS,
  STATUS_LABELS,
  type Review,
  type ReviewClassification,
} from "@/modules/m08-reviews/public";
import type { Brand } from "@/modules/m02-brand/public";
import { ReviewDrawer } from "./review-drawer";

function ageLabel(
  postedAt: string,
  brandSlug: string,
  nowMs: number,
): { text: string; color: string } {
  const hours = (nowMs - new Date(postedAt).getTime()) / 3600000;
  const isDelivery = brandSlug === "lenny";
  if (isDelivery) {
    if (hours < 4) return { text: `${Math.round(hours)}h fa`, color: "text-emerald-600" };
    if (hours < 12) return { text: `${Math.round(hours)}h fa`, color: "text-amber-600" };
    if (hours < 24) return { text: `${Math.round(hours)}h fa`, color: "text-orange-600" };
    return {
      text: hours < 48 ? `${Math.round(hours)}h fa` : `${Math.floor(hours / 24)}gg fa`,
      color: "text-rose-600",
    };
  }
  if (hours < 24) return { text: `${Math.round(hours)}h fa`, color: "text-emerald-600" };
  if (hours < 48) return { text: `${Math.round(hours)}h fa`, color: "text-amber-600" };
  return { text: `${Math.floor(hours / 24)}gg fa`, color: "text-rose-600" };
}

export function ReviewsTable({
  reviews,
  brands,
  nowMs,
}: {
  reviews: Review[];
  brands: Brand[];
  /** Timestamp di riferimento per i label di età (iniettato dal server component). */
  nowMs: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = reviews.find((r) => r.id === openId) ?? null;

  function brandLabel(id: string): string {
    return brands.find((b) => b.id === id)?.displayName ?? id;
  }

  const openBrand = open ? (brands.find((b) => b.id === open.brandId) ?? null) : null;

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="py-2 pr-3">Marchio</th>
            <th className="pr-3">Autore</th>
            <th className="pr-3">Rating</th>
            <th className="pr-3">Testo</th>
            <th className="pr-3">Classif.</th>
            <th className="pr-3">Stato</th>
            <th className="pr-3">Età</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((r) => {
            const brand = brands.find((b) => b.id === r.brandId);
            const age = ageLabel(r.postedAt, brand?.slug ?? "", nowMs);
            return (
              <tr key={r.id} className="border-b hover:bg-slate-50">
                <td className="py-2 pr-3">{brandLabel(r.brandId)}</td>
                <td className="pr-3">{r.authorName ?? "—"}</td>
                <td className="pr-3">{"★".repeat(r.rating)}</td>
                <td className="max-w-xs truncate pr-3">{r.textOriginal ?? "—"}</td>
                <td className="pr-3">
                  <ClassBadge classification={r.classification} />
                </td>
                <td className="pr-3 text-xs text-slate-600">{STATUS_LABELS[r.status]}</td>
                <td className={`pr-3 ${age.color}`}>{age.text}</td>
                <td>
                  <button className="text-slate-600 underline" onClick={() => setOpenId(r.id)}>
                    Apri
                  </button>
                </td>
              </tr>
            );
          })}
          {reviews.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-500">
                Nessuna recensione nei filtri correnti.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <ReviewDrawer
        key={open?.id ?? "closed"}
        review={open}
        brand={openBrand}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

function ClassBadge({ classification }: { classification: ReviewClassification }) {
  const cls =
    classification === "positive"
      ? "bg-emerald-100 text-emerald-800"
      : classification === "negative"
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-800";
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>
      {CLASSIFICATION_LABELS[classification]}
    </span>
  );
}
