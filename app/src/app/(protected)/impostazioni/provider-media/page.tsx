// RF-4.3 Provider media esterna — pagina Owner-only.
// Registrazione fornitori di generazione media (immagini/video) con ToS/diritti
// verificati UNA VOLTA alla registrazione. Non e' un controllo che si ripete a
// ogni generazione: e' una condizione di ammissione del fornitore.
//
// In F1 M04 usa solo template interni (satori). Questa pagina diventa pratica
// quando colleghiamo un provider reale (fal.ai FLUX, Replicate, DALL-E, ecc.).

import Link from "next/link";
import { Shield } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listMediaProviders } from "@/modules/m04-media/public";
import { HelpButton } from "@/components/help/help-button";
import { ProvidersClient } from "./providers-client";

export default async function ProviderMediaPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "media_providers.read")) {
    return (
      <div className="p-8 text-sm text-text-muted">
        I provider di generazione media sono una materia di compliance (ToS + diritti) accessibile
        solo al Proprietario.
      </div>
    );
  }

  const canManage = hasCapability(session.role, "media_providers.manage");
  const providers = await listMediaProviders(session.organizationId, true);

  return (
    <main className="space-y-6 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <nav className="text-xs text-text-muted">
            <Link href="/impostazioni" className="underline">
              Impostazioni
            </Link>{" "}
            / Provider media
          </nav>
          <HelpButton pageKey="provider-media" />
        </div>
        <div className="mt-1 flex items-start gap-3">
          <Shield className="mt-1 h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-2xl font-bold">Provider di generazione media</h1>
            <p className="mt-1 text-sm text-text-muted">
              RF-4.3 · Fornitori AI per immagini/video (es. fal.ai FLUX, Replicate, DALL-E). ToS,
              detentore dei diritti e usi ammessi vengono verificati <strong>una volta</strong> alla
              registrazione del fornitore e tracciati qui per audit. In F1 M04 usa solo template
              interni: questa sezione precede l&apos;integrazione dei provider reali.
            </p>
          </div>
        </div>
      </header>

      <ProvidersClient providers={providers} canManage={canManage} />

      <section className="rounded-lg border border-border bg-surface-muted p-4 text-xs text-text-muted">
        <strong>Perche&apos; non e&apos; un controllo da fare a ogni generazione:</strong> i T&amp;C
        di un provider cambiano raramente, e il modello non deve decidere a run-time se un uso
        e&apos; ammesso (RA-8.6: il codice dispone). La verifica avviene qui, una volta, con un
        umano. Il codice di generazione poi legge solo &quot;c&apos;e&apos; almeno un provider
        attivo per l&apos;uso richiesto?&quot; e si ferma se la risposta e&apos; no.
      </section>
    </main>
  );
}
