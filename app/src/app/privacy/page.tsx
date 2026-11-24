// Informativa privacy pubblica — accessibile senza autenticazione.
// Linkata dal form di iscrizione delle landing (/iscriviti/[slug]).

import type { Metadata } from "next";

export const metadata: Metadata = {
 // Il layout root ha template "%s · Regìa", quindi "Informativa privacy"
 // diventa "Informativa privacy · Regìa" senza doppioni.
 title: "Informativa privacy",
 description: "Informativa sul trattamento dei dati personali raccolti tramite le landing di iscrizione.",
};

export default function PrivacyPage() {
 return (
 <main className="mx-auto max-w-2xl p-6 text-sm leading-relaxed">
 <h1 className="mb-4 text-2xl font-semibold">Informativa privacy</h1>

 <p className="mb-4">
 Questa informativa descrive come i dati personali raccolti tramite i moduli di
 iscrizione (landing /iscriviti/*) vengono trattati, in conformità al Regolamento
 (UE) 2016/679 (GDPR).
 </p>

 <h2 className="mt-6 mb-2 text-lg font-semibold">Titolare del trattamento</h2>
 <p className="mb-4">
 Il titolare del trattamento è l&apos;attività commerciale che ospita la landing
 (ristorante, bar, stazione di servizio del gruppo). I dati di contatto del
 titolare sono reperibili presso il punto vendita o nei canali ufficiali
 dell&apos;attività.
 </p>

 <h2 className="mt-6 mb-2 text-lg font-semibold">Dati raccolti</h2>
 <ul className="mb-4 list-disc pl-6">
 <li>Nome e cognome (se forniti)</li>
 <li>Email, numero di telefono o WhatsApp (almeno uno è obbligatorio)</li>
 <li>
 Tipo di pubblico selezionato (es. residente / turista), se richiesto dalla
 landing
 </li>
 <li>
 Canali su cui hai dato consenso esplicito a ricevere comunicazioni (email,
 SMS, WhatsApp)
 </li>
 <li>
 Data di iscrizione, landing di provenienza e un hash non reversibile del tuo
 indirizzo IP (per prevenzione abusi)
 </li>
 </ul>

 <h2 className="mt-6 mb-2 text-lg font-semibold">Finalità</h2>
 <p className="mb-4">
 I dati sono trattati esclusivamente per inviarti comunicazioni commerciali e
 promozionali relative all&apos;attività (offerte, novità, eventi), sui canali che
 hai esplicitamente autorizzato.
 </p>

 <h2 className="mt-6 mb-2 text-lg font-semibold">Base giuridica</h2>
 <p className="mb-4">
 Il trattamento si fonda sul tuo consenso esplicito (art. 6.1.a GDPR), rilasciato
 selezionando i canali desiderati al momento dell&apos;iscrizione. Il consenso è
 separato per ogni canale: puoi autorizzarne alcuni e rifiutarne altri.
 </p>

 <h2 className="mt-6 mb-2 text-lg font-semibold">Conservazione</h2>
 <p className="mb-4">
 I dati sono conservati fino alla revoca del consenso o fino a 36 mesi di
 inattività (nessuna interazione con le nostre comunicazioni), dopodiché vengono
 archiviati con oscuramento dei recapiti.
 </p>

 <h2 className="mt-6 mb-2 text-lg font-semibold">I tuoi diritti</h2>
 <p className="mb-4">
 Hai diritto, in qualsiasi momento, di: accedere ai tuoi dati, correggerli,
 chiederne la cancellazione, limitarne il trattamento, ottenerne una copia
 portatile, opporti al trattamento, revocare il consenso. Per esercitarli puoi:
 </p>
 <ul className="mb-4 list-disc pl-6">
 <li>
 Cliccare il link &quot;disiscriviti&quot; presente in ogni comunicazione che ricevi:
 revoca il consenso in modo immediato e automatico.
 </li>
 <li>
 Scriverci ai riferimenti ufficiali dell&apos;attività: ogni richiesta viene
 evasa entro i termini di legge (30 giorni).
 </li>
 </ul>

 <h2 className="mt-6 mb-2 text-lg font-semibold">Destinatari</h2>
 <p className="mb-4">
 I dati sono accessibili al personale autorizzato dell&apos;attività e ai
 fornitori tecnici (hosting, invio email/SMS/WhatsApp) che agiscono come
 responsabili del trattamento. Nessun dato viene ceduto a terzi per finalità di
 marketing diretto.
 </p>

 <h2 className="mt-6 mb-2 text-lg font-semibold">Reclamo all&apos;autorità</h2>
 <p className="mb-4">
 Se ritieni che il trattamento violi la normativa puoi presentare reclamo al
 Garante per la protezione dei dati personali (<a
 href="https://www.garanteprivacy.it"
 target="_blank"
 rel="noopener noreferrer"
 className="underline"
 >
 garanteprivacy.it
 </a>
 ).
 </p>

 <p className="mt-8 text-xs text-text-muted">
 Ultimo aggiornamento: novembre 2026.
 </p>
 </main>
 );
}
