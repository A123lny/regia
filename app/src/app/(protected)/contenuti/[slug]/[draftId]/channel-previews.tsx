"use client";

// RF-4.6 Anteprima fedele per canale.
// Mockup base di come il post appare su IG post/story, FB post, email.
// Aspect ratio corretti + auto-crop centrato se immagine ha ratio diverso dal canale.

import { useState } from "react";
import { ImageIcon, Newspaper, Mail, Smartphone, Printer } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

type Channel = "ig-post" | "ig-story" | "fb-post" | "email" | "print-a4";

type Props = {
  brandDisplayName: string;
  brandLogoUrl: string | null;
  brandFontFamily?: string;
  text: string;
  imageUrl: string | null;
};

const CHANNELS: {
  id: Channel;
  label: string;
  ratio: string;
  icon: typeof ImageIcon;
  hint: string;
}[] = [
  {
    id: "ig-post",
    label: "Instagram post",
    ratio: "1:1",
    icon: ImageIcon,
    hint: "Feed quadrato — 1080x1080",
  },
  {
    id: "ig-story",
    label: "Instagram story",
    ratio: "9:16",
    icon: Smartphone,
    hint: "Story verticale — 1080x1920",
  },
  {
    id: "fb-post",
    label: "Facebook post",
    ratio: "1.91:1",
    icon: Newspaper,
    hint: "Post orizzontale — 1200x628",
  },
  {
    id: "email",
    label: "Email newsletter",
    ratio: "-",
    icon: Mail,
    hint: "Anteprima come apparirebbe in mail client",
  },
  {
    id: "print-a4",
    label: "Stampa A4",
    ratio: "1:√2",
    icon: Printer,
    hint: "RF-4.7 locandina stampabile 300dpi — da attaccare in vetrina/bacheca",
  },
];

export function ChannelPreviews({
  brandDisplayName,
  brandLogoUrl,
  brandFontFamily,
  text,
  imageUrl,
}: Props) {
  const [active, setActive] = useState<Channel>("ig-post");
  // Applica il font del brand come CSS variable per l'anteprima
  const fontStyle = brandFontFamily ? { fontFamily: `${brandFontFamily}, sans-serif` } : undefined;

  return (
    <div className="rounded-lg border border-border bg-surface p-4" style={fontStyle}>
      <div className="mb-3 flex items-center justify-between">
        <h3
          className="text-sm font-medium text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          Anteprima per canale
        </h3>
      </div>

      {/* Tab canali */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          const isActive = c.id === active;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.label}
              <span className="text-[10px] text-text-muted/70">{c.ratio}</span>
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <p className="mb-3 text-[11px] text-text-muted">
        {CHANNELS.find((c) => c.id === active)?.hint}
      </p>

      {/* Mockup */}
      <div className="flex justify-center bg-surface-muted/40 py-4">
        {active === "ig-post" && (
          <IgPostMockup
            brandDisplayName={brandDisplayName}
            brandLogoUrl={brandLogoUrl}
            text={text}
            imageUrl={imageUrl}
          />
        )}
        {active === "ig-story" && (
          <IgStoryMockup
            brandDisplayName={brandDisplayName}
            brandLogoUrl={brandLogoUrl}
            text={text}
            imageUrl={imageUrl}
          />
        )}
        {active === "fb-post" && (
          <FbPostMockup
            brandDisplayName={brandDisplayName}
            brandLogoUrl={brandLogoUrl}
            text={text}
            imageUrl={imageUrl}
          />
        )}
        {active === "print-a4" && (
          <PrintA4Mockup
            brandDisplayName={brandDisplayName}
            brandLogoUrl={brandLogoUrl}
            text={text}
            imageUrl={imageUrl}
          />
        )}
        {active === "email" && (
          <EmailMockup
            brandDisplayName={brandDisplayName}
            brandLogoUrl={brandLogoUrl}
            text={text}
            imageUrl={imageUrl}
          />
        )}
      </div>
    </div>
  );
}

function BrandHeaderRow({
  brandDisplayName,
  brandLogoUrl,
}: {
  brandDisplayName: string;
  brandLogoUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-200 p-2">
      <BrandLogo logoUrl={brandLogoUrl} name={brandDisplayName} size="sm" rounded="full" />
      <span className="text-[13px] font-semibold text-neutral-900">{brandDisplayName}</span>
    </div>
  );
}

function IgPostMockup(props: Props) {
  return (
    <div className="w-full max-w-[360px] overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-md">
      <BrandHeaderRow {...props} />
      <div className="aspect-square bg-neutral-100">
        {props.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.imageUrl} alt="preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
            [nessuna immagine allegata]
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="whitespace-pre-wrap text-[13px] leading-snug text-neutral-800">
          <span className="font-semibold">{props.brandDisplayName}</span> {props.text.slice(0, 300)}
          {props.text.length > 300 && "…"}
        </div>
      </div>
    </div>
  );
}

function IgStoryMockup(props: Props) {
  return (
    <div
      className="relative w-full max-w-[220px] overflow-hidden rounded-2xl border-4 border-black bg-black shadow-md"
      style={{ aspectRatio: "9 / 16" }}
    >
      {props.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.imageUrl}
          alt="preview"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-800 text-xs text-neutral-400">
          [nessuna immagine]
        </div>
      )}
      {/* Overlay testo bottom */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <BrandLogo
            logoUrl={props.brandLogoUrl}
            name={props.brandDisplayName}
            size="xs"
            rounded="full"
          />
          <span className="text-[11px] font-semibold text-white">{props.brandDisplayName}</span>
        </div>
        <div className="whitespace-pre-wrap text-[11px] leading-snug text-white">
          {props.text.slice(0, 150)}
          {props.text.length > 150 && "…"}
        </div>
      </div>
    </div>
  );
}

function FbPostMockup(props: Props) {
  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-md">
      <div className="p-3">
        <BrandHeaderRow {...props} />
        <div className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-neutral-800">
          {props.text}
        </div>
      </div>
      {props.imageUrl ? (
        <div className="bg-neutral-100" style={{ aspectRatio: "1.91 / 1" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.imageUrl} alt="preview" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className="flex items-center justify-center bg-neutral-100 text-xs text-neutral-400"
          style={{ aspectRatio: "1.91 / 1" }}
        >
          [nessuna immagine]
        </div>
      )}
    </div>
  );
}

function EmailMockup(props: Props) {
  return (
    <div className="w-full max-w-[500px] overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-md">
      {/* Header simile a Gmail */}
      <div className="border-b border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-600">
        <div className="mb-1 flex items-center gap-2">
          <BrandLogo
            logoUrl={props.brandLogoUrl}
            name={props.brandDisplayName}
            size="xs"
            rounded="full"
          />
          <span className="font-semibold text-neutral-900">{props.brandDisplayName}</span>
          <span className="text-neutral-400">
            &lt;info@{props.brandDisplayName.toLowerCase().replace(/\s/g, "")}.it&gt;
          </span>
        </div>
        <div className="text-neutral-500">
          <span className="font-medium text-neutral-700">Oggetto:</span>{" "}
          <span className="italic">
            {props.text.split("\n")[0]?.slice(0, 60) || "(nessun oggetto)"}
          </span>
        </div>
      </div>
      {props.imageUrl && (
        <div className="bg-neutral-100 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.imageUrl} alt="preview" className="mx-auto max-h-64 object-contain" />
        </div>
      )}
      <div className="whitespace-pre-wrap p-4 text-[13px] leading-relaxed text-neutral-800">
        {props.text}
      </div>
    </div>
  );
}

// RF-4.6/4.7 Anteprima locandina stampabile A4 (aspect ratio 1:√2).
// Mockup "foglio di carta" con bordo + ombra, testo scalato per leggibilita.
function PrintA4Mockup(props: Props) {
  return (
    <div
      className="relative w-full max-w-[260px] overflow-hidden rounded-sm bg-white shadow-[0_8px_30px_rgba(0,0,0,0.15)] ring-1 ring-neutral-300"
      style={{ aspectRatio: "1 / 1.414" }}
    >
      {/* Banda header colorata, come i template registry */}
      <div className="h-[8%] bg-primary" />
      <div className="flex h-[92%] flex-col px-5 py-6">
        {props.imageUrl ? (
          <div className="mb-3 flex-1 overflow-hidden rounded-sm bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.imageUrl} alt="preview" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="mb-3 flex flex-1 items-center justify-center rounded-sm bg-neutral-100 text-[10px] italic text-neutral-400">
            [area immagine/claim]
          </div>
        )}
        <div className="whitespace-pre-wrap text-[9px] leading-tight text-neutral-800">
          {props.text.slice(0, 240)}
          {props.text.length > 240 && "…"}
        </div>
        <div className="mt-auto flex items-center gap-1.5 border-t border-neutral-200 pt-2">
          <BrandLogo
            logoUrl={props.brandLogoUrl}
            name={props.brandDisplayName}
            size="xs"
            rounded="md"
          />
          <span
            className="text-[9px] font-bold uppercase tracking-widest text-neutral-900"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {props.brandDisplayName}
          </span>
        </div>
      </div>
    </div>
  );
}
