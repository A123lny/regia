// Matrice permessi centralizzata (RU-1..RU-3, RA-8.6).
// Ogni capability e' una "azione atomica" che l'utente puo compiere.
// Aggiungere una nuova capability significa: aggiungerla al type, aggiungerla
// alla matrice CAPABILITIES, chiamare requireCapability() nel punto giusto.
//
// Regola: la UI puo NASCONDERE azioni non permesse, ma NON puo fidarsi della UI:
// tutte le mutation (server actions, route handler) DEVONO chiamare
// requireCapability() prima di eseguire.
//
// Ruoli attivi F1: 'owner', 'editor'. 'delegate' e 'agent' sono nel DB enum
// (users_profile.role) ma dormienti: nessun modo di assegnarli via UI/script,
// il loro comportamento e "come editor" per fallback silente.

import type { Session } from "./session";

export type Role = Session["role"]; // 'owner' | 'editor' | 'delegate' | 'agent'

/**
 * Capability = azione atomica. Nome puntato per leggibilita.
 * Convenzione: <dominio>.<verbo> (o <dominio>.<oggetto>.<verbo>).
 */
export type Capability =
  // Contenuti (m03-editorial)
  | "content.generate"
  | "content.approve"
  | "content.reject"
  | "content.schedule"
  | "content.unschedule"
  | "content.reschedule"
  | "content.publish"
  | "content.delete"
  // Marchi (m02-brand)
  | "brand.crud"
  | "brand.kit.edit"
  // Team
  | "team.read"
  | "team.manage"
  // Audit
  | "audit.read"
  // Contatti (m01-data-hub) — RF-1.2..1.4, RF-1.7
  | "contacts.read"
  | "contacts.crud"
  | "contacts.consent.manage"
  | "contacts.dedup.read"
  | "contacts.dedup.merge"
  // M6a Partner spesa (m01-data-hub) — RF-6.19
  | "supply.read"
  | "supply.crud"
  // Catalogo prodotti/servizi (m01-data-hub) — RF-1.2, RF-1.5
  | "catalog.read"
  | "catalog.crud"
  // Margini/prezzi (RF-6.11 valore vivo, decisione strategica)
  | "pricing.manage"
  // Ordini/vendite — read-only in F1 (sync gestionali RF-1.6 futuro)
  | "orders.read"
  // Fedeltà + voucher (m06-loyalty) — RF-6.1..6.10, RF-6.26
  | "loyalty.read"
  | "loyalty.crud.counters" // config contatori: strategica
  | "loyalty.crud.offers" // config offerte: strategica
  | "voucher.issue" // emissione manuale (operativa)
  | "voucher.redeem" // riscatto al banco (operativa)
  | "voucher.cancel" // annullamento (Owner-only per sicurezza)
  // Segmenti + campagne (m07-outreach) — RF-1.8 + predisposizione M5
  | "segment.read"
  | "segment.crud"
  | "campaign.read"
  | "campaign.crud"
  | "campaign.mark_sent" // Owner-only (marker manuale audit-critical)
  // Rete ristoranti Lenny (m07-partners) — RF-7.1..7.6
  | "partner.read"
  | "partner.crud"
  | "partner.activity.log"
  // Landing pubbliche iscrizione (m10-signup) — RF-10.1..10.4
  | "signup.landing.crud"
  | "signup.events.read"
  // Analytics cross-modulo (m08-analytics) — RF-8.x
  // RU-1a: separazione marketing (visibile Editor) vs commerciale (solo Owner).
  // 'analytics.read' resta come alias legacy = marketing-level per retro-compat.
  | "analytics.read"
  | "analytics.marketing.read"
  | "analytics.commercial.read"
  // Governance (m13-governance) — §8.2 categorie mai autonome + RF-6.15..6.20
  | "governance.read"
  | "governance.crud"
  // Reminders (m09-reminders) — RF-6.22 promemoria automatici
  | "reminders.read"
  | "reminders.crud"
  | "reminders.refresh"
  // Anti-abbandono (m09-reminders esteso) — RN-40, RF-9.x
  | "abandonment.read"
  | "abandonment.resolve"
  | "abandonment.detect"
  // M05 Publishing (RF-5.x) - invii verso l'esterno
  | "publishing.credentials.manage"
  | "publishing.send"
  | "publishing.send_bulk"
  | "publishing.retry_dead"
  // M13 Advertising (RF-13.x) - motore promo
  | "advertising.read"
  | "advertising.budgets.manage"
  | "advertising.toggle"
  | "advertising.classify"
  | "advertising.overrun.request"
  | "advertising.overrun.decide"
  // Capacita rider (RF-6.18 + RN-41..43) - guardia promo food Lenny
  | "rider_capacity.read"
  | "rider_capacity.manage"
  | "rider_shift.request"
  | "rider_shift.fulfill"
  // Richieste dati personali RF-1.9 (gestione manuale, Owner-only)
  | "contacts.data_request.read"
  | "contacts.data_request.fulfill"
  // Memoria agente RA-8.11 (correzioni, motivi rifiuto, esiti promo, preferenze stile)
  | "agent_memory.read"
  // Zone di consegna variabili RN-52 (clima/eventi/chiusure stradali)
  | "delivery_zones.read"
  | "delivery_zones.manage"
  | "delivery_zones.blackout.toggle"
  // Provider media esterna RF-4.3 (registrazione ToS/diritti)
  | "media_providers.read"
  | "media_providers.manage"
  // RF-12.1 Operational tasks (todo manuali assegnabili tra utenti)
  | "tasks.read"
  | "tasks.crud";

const CAPABILITIES: Record<Capability, Role[]> = {
  // Editor puo generare bozze, l'Owner decide se pubblicare
  "content.generate": ["owner", "editor"],
  // Approvazione / rifiuto: solo Owner (cancello editoriale, decisione tua)
  "content.approve": ["owner"],
  "content.reject": ["owner"],
  // Programmazione / esecuzione: editor puo, e' lavoro operativo
  "content.schedule": ["owner", "editor"],
  "content.unschedule": ["owner", "editor"],
  "content.reschedule": ["owner", "editor"],
  "content.publish": ["owner", "editor"],
  // Delete: solo Owner (irreversibile su bozze/approvate; published sempre vietato dal repo)
  "content.delete": ["owner"],
  // CRUD marchi: solo Owner (decisione strategica)
  "brand.crud": ["owner"],
  // Brand kit editing: editor puo (tono, pilastri, parole vietate, argomenti sensibili)
  "brand.kit.edit": ["owner", "editor"],
  // Team
  "team.read": ["owner", "editor"],
  "team.manage": ["owner"],
  // Audit
  "audit.read": ["owner"],
  // Contatti: editor puo leggere ed editare anagrafica base, solo Owner tocca consensi
  // (RF-1.4: il consenso e' materia legale, non delegabile silenziosamente).
  "contacts.read": ["owner", "editor"],
  "contacts.crud": ["owner", "editor"],
  "contacts.consent.manage": ["owner"],
  "contacts.dedup.read": ["owner", "editor"],
  "contacts.dedup.merge": ["owner"], // distruttivo: solo Owner
  "supply.read": ["owner", "editor"],
  "supply.crud": ["owner"], // assenso partner = decisione contrattuale, Owner
  // Catalogo: editor puo consultare e aggiungere/aggiornare campi anagrafici,
  // ma NON puo toccare margine minimo e prezzo/costo (pricing.manage separato).
  "catalog.read": ["owner", "editor"],
  "catalog.crud": ["owner", "editor"],
  "pricing.manage": ["owner"], // RF-6.11 strategico
  "orders.read": ["owner", "editor"],
  "loyalty.read": ["owner", "editor"],
  "loyalty.crud.counters": ["owner"], // config strategica
  "loyalty.crud.offers": ["owner"], // config strategica
  "voucher.issue": ["owner", "editor"], // operativo
  "voucher.redeem": ["owner", "editor"], // operativo al banco
  "voucher.cancel": ["owner"], // sicurezza: annullo solo Owner
  "segment.read": ["owner", "editor"],
  "segment.crud": ["owner", "editor"],
  "campaign.read": ["owner", "editor"],
  "campaign.crud": ["owner", "editor"],
  "campaign.mark_sent": ["owner"], // audit-critical: solo Owner
  "partner.read": ["owner", "editor"],
  "partner.crud": ["owner", "editor"],
  "partner.activity.log": ["owner", "editor"], // log contatti operativi
  "signup.landing.crud": ["owner", "editor"],
  "signup.events.read": ["owner", "editor"],
  // RU-1a: marketing visibile anche a Editor; commerciale (fatturato,
  // margini, esiti promo in euro) riservato all'Owner.
  "analytics.read": ["owner", "editor"],
  "analytics.marketing.read": ["owner", "editor"],
  "analytics.commercial.read": ["owner"],
  "governance.read": ["owner", "editor"], // visibile a tutti, modifica solo Owner
  "governance.crud": ["owner"], // strategica: solo Owner
  "reminders.read": ["owner", "editor"],
  "reminders.crud": ["owner", "editor"], // dismiss/mark_sent operativi
  "reminders.refresh": ["owner"], // scan periodico: solo Owner (potenzialmente pesante)
  "abandonment.read": ["owner", "editor"],
  "abandonment.resolve": ["owner", "editor"],
  "abandonment.detect": ["owner"],
  "publishing.credentials.manage": ["owner"], // API keys strategiche
  "publishing.send": ["owner", "editor"], // invio singolo (test o operativo)
  "publishing.send_bulk": ["owner"], // bulk = costo + rischio, Owner-only (v2)
  "publishing.retry_dead": ["owner"], // recovery manuale
  // M13 Advertising RF-13.x
  "advertising.read": ["owner", "editor"],
  "advertising.budgets.manage": ["owner"], // strategica
  "advertising.toggle": ["owner"], // RF-13.2 accensione sempre esplicita del titolare
  "advertising.classify": ["owner", "editor"], // classificazione draft
  "advertising.overrun.request": ["owner", "editor"], // apre la richiesta
  "advertising.overrun.decide": ["owner"], // RF-13.6 decisione mai automatica, Owner-only
  // Capacita rider RF-6.18 + RN-41..43
  "rider_capacity.read": ["owner", "editor"],
  "rider_capacity.manage": ["owner"], // config strategica, decisione del titolare
  "rider_shift.request": ["owner", "editor"], // apre richieste quantificate
  "rider_shift.fulfill": ["owner", "editor"], // aggiorna slots_filled quando qualcuno si offre
  // RF-1.9 richieste dati personali: entrambe Owner-only (materia legale/GDPR)
  "contacts.data_request.read": ["owner"],
  "contacts.data_request.fulfill": ["owner"],
  "agent_memory.read": ["owner"], // vista strategica di cosa l'AI ha imparato
  // Zone consegna RN-52
  "delivery_zones.read": ["owner", "editor"],
  "delivery_zones.manage": ["owner"], // config CRUD strategica
  "delivery_zones.blackout.toggle": ["owner", "editor"], // operativa (emergenza clima)
  // RF-4.3 provider media esterna: lettura e gestione entrambe Owner (compliance ToS/diritti)
  "media_providers.read": ["owner"],
  "media_providers.manage": ["owner"],
  // RF-12.1 operational tasks: entrambi i ruoli (operativo quotidiano)
  "tasks.read": ["owner", "editor"],
  "tasks.crud": ["owner", "editor"],
};

export function hasCapability(role: Role, cap: Capability): boolean {
  return CAPABILITIES[cap].includes(role);
}

/**
 * Guardia server-side: throw se il ruolo della session non ha la capability.
 * Da usare in TUTTE le server action prima di eseguire mutazioni.
 */
export function requireCapability(session: Session, cap: Capability): void {
  if (!hasCapability(session.role, cap)) {
    throw new Error(
      `Permesso negato: il tuo ruolo (${session.role}) non puo eseguire "${cap}" (RU-1a)`,
    );
  }
}

/**
 * Ritorna l'elenco delle capability del ruolo. Usato dalla UI Team per mostrare
 * cosa puo fare ciascun ruolo in modo dichiarativo.
 */
export function listCapabilities(role: Role): Capability[] {
  return (Object.keys(CAPABILITIES) as Capability[]).filter((c) => hasCapability(role, c));
}

/**
 * Etichette leggibili per la UI Team.
 */
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Proprietario",
  editor: "Marketing",
  delegate: "Delegato",
  agent: "Agente AI",
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "content.generate": "Generare bozze",
  "content.approve": "Approvare bozze",
  "content.reject": "Rifiutare bozze",
  "content.schedule": "Programmare in calendario",
  "content.unschedule": "Togliere dal calendario",
  "content.reschedule": "Spostare (cambiare data/ora)",
  "content.publish": "Pubblicare",
  "content.delete": "Eliminare definitivamente",
  "brand.crud": "Creare/archiviare/rinominare marchi",
  "brand.kit.edit": "Modificare brand kit",
  "team.read": "Vedere elenco team",
  "team.manage": "Invitare/rimuovere membri (via script)",
  "audit.read": "Leggere audit log",
  "contacts.read": "Vedere elenco contatti",
  "contacts.crud": "Creare/modificare/archiviare contatti",
  "contacts.consent.manage": "Gestire consensi (iscrizioni/disiscrizioni)",
  "contacts.dedup.read": "Vedere possibili duplicati",
  "contacts.dedup.merge": "Unificare contatti duplicati (distruttivo)",
  "supply.read": "Vedere fornitori (partner spesa)",
  "supply.crud": "Gestire fornitori e assensi partner",
  "catalog.read": "Vedere catalogo prodotti/servizi",
  "catalog.crud": "Creare/modificare/archiviare prodotti",
  "pricing.manage": "Modificare prezzi, costi e margine minimo",
  "orders.read": "Vedere ordini e vendite",
  "loyalty.read": "Vedere contatori, offerte e voucher",
  "loyalty.crud.counters": "Configurare contatori fedeltà",
  "loyalty.crud.offers": "Configurare offerte voucher",
  "voucher.issue": "Emettere voucher a un contatto",
  "voucher.redeem": "Riscattare un voucher al banco",
  "voucher.cancel": "Annullare un voucher emesso",
  "segment.read": "Vedere segmenti contatti",
  "segment.crud": "Creare/modificare segmenti",
  "campaign.read": "Vedere campagne",
  "campaign.crud": "Creare/modificare campagne",
  "campaign.mark_sent": "Registrare invio campagna (marker manuale)",
  "partner.read": "Vedere rete ristoranti",
  "partner.crud": "Creare/modificare ristoranti partner",
  "partner.activity.log": "Registrare contatti e attività",
  "signup.landing.crud": "Configurare landing di iscrizione",
  "signup.events.read": "Vedere eventi iscrizione",
  "analytics.read": "Vedere cruscotto analytics (alias legacy = marketing)",
  "analytics.marketing.read": "Analytics marketing: contatti, campagne, iscrizioni (no €)",
  "analytics.commercial.read": "Analytics commerciale: fatturato, esiti promo in euro (RU-1a)",
  "governance.read": "Vedere regole autonomia e vincoli commerciali",
  "governance.crud": "Modificare regole autonomia e blocchi prodotto",
  "reminders.read": "Vedere promemoria da fare",
  "reminders.crud": "Marcare inviati / ignorare promemoria",
  "reminders.refresh": "Ricalcolare i promemoria automatici",
  "abandonment.read": "Vedere segnali di abbandono clienti",
  "abandonment.resolve": "Risolvere segnali di abbandono",
  "abandonment.detect": "Ricalcolare i segnali di abbandono",
  "publishing.credentials.manage": "Configurare canali di invio (API keys)",
  "publishing.send": "Inviare un messaggio (test o singolo)",
  "publishing.send_bulk": "Inviare a piu destinatari (bulk)",
  "publishing.retry_dead": "Rilanciare invii falliti definitivamente",
  "advertising.read": "Vedere budget e campagne pubblicitarie",
  "advertising.budgets.manage": "Impostare tetti di spesa per marchio e categoria",
  "advertising.toggle": "Accendere/spegnere categoria pubblicitaria",
  "advertising.classify": "Classificare un contenuto per advertising (organico/spinto)",
  "advertising.overrun.request": "Richiedere sforamento tetto",
  "advertising.overrun.decide": "Approvare/rifiutare sforamento tetto (RF-13.6)",
  "rider_capacity.read": "Vedere finestre capacita rider",
  "rider_capacity.manage": "Configurare finestre capacita rider",
  "rider_shift.request": "Aprire richieste rider quantificate",
  "rider_shift.fulfill": "Aggiornare slot filled su richiesta rider",
  "contacts.data_request.read": "Vedere dossier dati personali di un contatto (RF-1.9)",
  "contacts.data_request.fulfill": "Rispondere a richieste export/cancellazione (RF-1.9)",
  "agent_memory.read": "Vedere la memoria dell'agente AI (correzioni, rifiuti, preferenze)",
  "delivery_zones.read": "Vedere zone di consegna",
  "delivery_zones.manage": "Configurare zone di consegna (CRUD)",
  "delivery_zones.blackout.toggle": "Attivare/chiudere blackout zone (emergenza)",
  "media_providers.read": "Vedere provider di generazione media esterna (RF-4.3)",
  "media_providers.manage": "Registrare/modificare provider media (ToS, diritti, usi)",
  "tasks.read": "Vedere operational tasks del team",
  "tasks.crud": "Creare/assegnare/completare operational tasks",
};
