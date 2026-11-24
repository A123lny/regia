"use client";

// Modal che mostra il QR code di una landing + bottone download PNG.
// Il QR codifica l'URL completo /iscriviti/<slug>. Generazione client-side
// con la libreria `qrcode` (zero backend).

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, X as XIcon, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  slug: string;
  headline: string;
  onClose: () => void;
};

export function QrDialog({ slug, headline, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // typeof window check per evitare ReferenceError in render SSR; questo
  // componente comunque e' "use client" + viene montato solo lato client.
  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}/iscriviti/${slug}` : "";

  useEffect(() => {
    const url = `${window.location.origin}/iscriviti/${slug}`;
    // 512px, errorCorrection H -> resiste anche se stampato male o sporcato
    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#2a2a2a", light: "#ffffff" },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [slug]);

  const download = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qr-${slug}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no-op */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-dialog-title"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0 flex-1">
            <h2
              id="qr-dialog-title"
              className="text-xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              QR code landing
            </h2>
            <p className="mt-1 truncate text-xs text-text-muted">{headline}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted"
            aria-label="Chiudi"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 p-6">
          {dataUrl ? (
            <div className="rounded-lg border border-border bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUrl} alt={`QR code per /iscriviti/${slug}`} className="h-64 w-64" />
            </div>
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-muted">
              Generazione...
            </div>
          )}

          <div className="flex w-full items-center gap-1 rounded-md border border-border bg-bg p-2 text-xs">
            <code className="flex-1 truncate text-text-muted">{fullUrl}</code>
            <button
              type="button"
              onClick={copyUrl}
              className="rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text"
              aria-label="Copia URL"
              title="Copia URL"
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <p className="text-center text-[11px] text-text-muted">
            Stampa questo QR dove vuoi (menu, volantino, adesivo). Scansionando porta alla pagina di
            iscrizione pubblica. Lo stesso QR vale per sempre e per quanti clienti vuoi.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-surface-muted/40 p-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Chiudi
          </Button>
          <Button
            size="sm"
            onClick={download}
            disabled={!dataUrl}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Scarica PNG
          </Button>
        </div>
      </div>
    </div>
  );
}
