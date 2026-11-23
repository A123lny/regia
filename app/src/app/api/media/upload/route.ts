// Upload media via API Route invece che via Server Action.
// Motivo: la server action su Vercel andava in React error #441 con payload
// multipart anche piccoli (il protocollo RSC non gradisce blob medium).
// Qui riceviamo FormData nativo e scriviamo su Supabase Storage.

import { NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { uploadMediaAsset } from "@/modules/m04-media/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Errore con messaggio sicuro da restituire al client (gia' validato per
 * non contenere dettagli tecnici). Tutti gli errori che non sono di questo
 * tipo vengono convertiti in "Errore upload." generico.
 */
class SafeClientError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  // 1) Auth esplicita: 401 se non c'e' sessione, 403 se mancano i permessi.
  //    getSessionOrRedirect fa redirect per pagine SSR; qui vogliamo 401 JSON.
  let session;
  try {
    session = await getSessionOrRedirect();
  } catch (err) {
    if (isRedirectError(err)) {
      return json(401, { ok: false, error: "Non autenticato." });
    }
    throw err;
  }
  try {
    requireCapability(session, "brand.kit.edit");
  } catch {
    return json(403, { ok: false, error: "Permessi insufficienti." });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    console.error("[api/media/upload] formData parse fallito", {
      err: err instanceof Error ? err.message : String(err),
    });
    return json(400, { ok: false, error: "Richiesta malformata." });
  }

  const brandId = String(formData.get("brandId") ?? "");
  if (!brandId) {
    return json(400, { ok: false, error: "brandId mancante." });
  }

  try {
    const asset = await uploadMediaAsset(brandId, formData);
    return json(200, { ok: true, asset });
  } catch (err) {
    // I redirect() di Next.js attraversano le exception: li re-throw cosi'
    // il framework puo' gestirli invece di finirli in 500.
    if (isRedirectError(err)) throw err;

    // Log pieno server-side (Vercel log), risposta generica al client.
    console.error("[api/media/upload] uploadMediaAsset fallito", {
      userId: session.userId,
      organizationId: session.organizationId,
      brandId,
      err: err instanceof Error ? err.message : String(err),
    });

    // Messaggio al client: una whitelist di errori "safe" che l'utente puo'
    // leggere (validazione input, bucket). Tutto il resto -> generico.
    const raw = err instanceof Error ? err.message : "";
    const safeMessages = [
      "File mancante",
      "File vuoto",
      "File troppo grande",
      "Formato non supportato",
      "Marchio non trovato",
      "Impossibile leggere il file",
      "Impossibile salvare l'immagine",
    ];
    const isSafe = safeMessages.some((m) => raw.startsWith(m));
    const clientMsg = isSafe ? raw : "Errore upload. Riprova tra un istante.";
    const status = err instanceof SafeClientError ? err.status : 500;
    return json(status, { ok: false, error: clientMsg });
  }
}
