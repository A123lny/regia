/* eslint-disable @typescript-eslint/no-explicit-any */
// Seed demo dati su Supabase Cloud per sessioni di test manuali.
//
// IMPORTANTE: NON eseguire in produzione reale.
// Usa service_role key per bypassare RLS. Idempotente: ri-eseguibile senza
// generare duplicati (UUID deterministici + upsert on conflict).
//
// Lancia con:  cd app && npm run seed:demo
//
// Env richieste (lette da .env.staging):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Richiede inoltre: ALLOW_SEED=1 (safety switch, metti nell'env prima di lanciare)

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

// ============================================================================
// Safety switch
// ============================================================================

if (process.env["ALLOW_SEED"] !== "1") {
  console.error(
    "\n[seed-demo] rifiuto di partire senza ALLOW_SEED=1 nell'env.\n" +
      "Lancia con:  ALLOW_SEED=1 npm run seed:demo\n" +
      "(questo e' un check anti-fat-fingers per non girare in produzione).\n",
  );
  process.exit(1);
}

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[seed-demo] mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (SUPABASE_URL.includes("127.0.0.1") || SUPABASE_URL.includes("localhost")) {
  console.log("[seed-demo] target: Supabase LOCALE");
} else {
  console.log(`[seed-demo] target: ${SUPABASE_URL}`);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ============================================================================
// UUID deterministici (md5(seed) -> formato UUID). Rilanci multipli = stessi id.
// ============================================================================

function demoUuid(seed: string): string {
  const h = createHash("md5").update(`regia-demo-${seed}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function demoCode(seed: string): string {
  const h = createHash("md5").update(`code-${seed}`).digest("hex").toUpperCase();
  return `D${h.slice(0, 7)}`; // 8 char
}

// ============================================================================
// Nomi italiani per contatti e ristoratori (fissi, deterministici)
// ============================================================================

const FIRST_NAMES = [
  "Marco",
  "Luca",
  "Giulia",
  "Francesca",
  "Alessandro",
  "Chiara",
  "Davide",
  "Elena",
  "Simone",
  "Martina",
  "Andrea",
  "Sara",
  "Matteo",
  "Giada",
  "Lorenzo",
  "Ilaria",
  "Nicola",
  "Valentina",
  "Riccardo",
  "Beatrice",
  "Federico",
  "Camilla",
  "Enrico",
  "Alice",
  "Daniele",
  "Silvia",
  "Michele",
  "Giorgia",
  "Antonio",
  "Roberta",
];

const LAST_NAMES = [
  "Rossi",
  "Ferrari",
  "Bianchi",
  "Romano",
  "Colombo",
  "Esposito",
  "Ricci",
  "Marino",
  "Greco",
  "Bruno",
  "Gallo",
  "Conti",
  "De Luca",
  "Mancini",
  "Costa",
  "Giordano",
  "Rizzo",
  "Lombardi",
  "Moretti",
  "Barbieri",
  "Fontana",
  "Santoro",
  "Mariani",
  "Rinaldi",
  "Caruso",
  "Ferrara",
  "Galli",
  "Benedetti",
  "Longo",
  "Villa",
];

const RESTAURANT_NAMES = [
  "La Dispensa",
  "Osteria del Borgo",
  "Pizzeria Napoli",
  "Trattoria Nonna Rosa",
  "Il Girasole",
];

const CUISINE_CATEGORIES = ["pizzeria", "trattoria", "sushi", "pizzeria", "trattoria"];

// ============================================================================
// Resolve organization + brands
// ============================================================================

async function resolveContext() {
  const { data: orgs } = await admin.from("organizations").select("id, name").limit(1);
  if (!orgs || orgs.length === 0) {
    throw new Error("Nessuna organization trovata. Crea prima l'Owner setup.");
  }
  const orgId = orgs[0]!.id as string;
  console.log(`[seed-demo] organization: ${orgs[0]!.name} (${orgId})`);

  const { data: brands } = await admin
    .from("brands")
    .select("id, slug, display_name")
    .eq("organization_id", orgId)
    .eq("is_archived", false);
  if (!brands || brands.length === 0) throw new Error("Nessun brand attivo trovato.");

  const brandMap = new Map<string, string>();
  for (const b of brands) brandMap.set(b.slug as string, b.id as string);
  console.log(`[seed-demo] brands: ${brands.map((b) => b.slug).join(", ")}`);
  return { orgId, brandMap };
}

// ============================================================================
// Helpers
// ============================================================================

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

async function upsert(table: string, rows: any[], onConflict = "id") {
  if (rows.length === 0) return 0;
  const { error, count } = await admin.from(table).upsert(rows, { onConflict, count: "exact" });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
  console.log(`  [${table}] ${count ?? rows.length} righe upsert`);
  return count ?? rows.length;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

// ============================================================================
// Seed contacts (30)
// ============================================================================

async function seedContacts(orgId: string, lennyBrandId: string) {
  console.log("[seed-demo] contatti...");
  const rows: any[] = [];
  for (let i = 0; i < 30; i++) {
    const first = pick(FIRST_NAMES, i);
    const last = pick(LAST_NAMES, i * 7 + 3);
    const emailLocal = `${first.toLowerCase()}.${last.toLowerCase().replace(/\s/g, "")}`;
    rows.push({
      id: demoUuid(`contact-${i}`),
      organization_id: orgId,
      brand_id: lennyBrandId,
      first_name: first,
      last_name: last,
      email: `${emailLocal}${i}@example.com`,
      phone: `+393${String(300000000 + i * 12345).slice(0, 9)}`,
      whatsapp: `+393${String(300000000 + i * 12345).slice(0, 9)}`,
      source: pick(["qr", "web", "manuale", "import"], i),
      tags: i % 5 === 0 ? ["vip"] : i % 3 === 0 ? ["abituale"] : [],
      address_cap: pick(["47900", "47891", "47893", "47894"], i),
    });
  }
  await upsert("contacts", rows);
}

// ============================================================================
// Seed consents (3 canali per ciascun contatto, mix)
// ============================================================================

async function seedConsents(orgId: string) {
  console.log("[seed-demo] consensi...");
  const rows: any[] = [];
  for (let i = 0; i < 30; i++) {
    const contactId = demoUuid(`contact-${i}`);
    for (const channel of ["email", "sms", "whatsapp"]) {
      // Mix: 60% granted, 25% never, 15% revoked
      const r = (i + channel.length) % 20;
      const status = r < 12 ? "granted" : r < 17 ? "never" : "revoked";
      rows.push({
        id: demoUuid(`consent-${i}-${channel}`),
        organization_id: orgId,
        contact_id: contactId,
        channel,
        status,
        source: "manuale",
        // Check constraint: revoked richiede ANCHE granted_at valorizzato (prima
        // ho dato consenso, poi l'ho revocato). never = entrambi null.
        granted_at:
          status === "granted"
            ? isoDaysAgo(60 + i)
            : status === "revoked"
              ? isoDaysAgo(90 + i)
              : null,
        revoked_at: status === "revoked" ? isoDaysAgo(10 + (i % 15)) : null,
      });
    }
  }
  await upsert("contact_consents", rows);
}

// ============================================================================
// Seed vehicles (10 contatti hanno auto Officina)
// ============================================================================

async function seedVehicles(orgId: string) {
  console.log("[seed-demo] veicoli...");
  const rows: any[] = [];
  const models = ["Fiat Panda", "VW Golf", "Ford Focus", "Fiat 500", "Renault Clio"];
  for (let i = 0; i < 10; i++) {
    const lastService = new Date(Date.now() - (300 + i * 10) * 24 * 60 * 60 * 1000);
    rows.push({
      id: demoUuid(`vehicle-${i}`),
      organization_id: orgId,
      contact_id: demoUuid(`contact-${i}`),
      plate: `AB${100 + i}CD`,
      model: pick(models, i),
      kilometers: 30000 + i * 7500,
      tire_type: pick(["estive", "invernali", "4stagioni"], i),
      last_service_at: lastService.toISOString().slice(0, 10), // YYYY-MM-DD (date)
    });
  }
  await upsert("contact_vehicles", rows, "organization_id,plate");
}

// ============================================================================
// Seed catalog (15 prodotti cross-brand)
// ============================================================================

async function seedCatalog(orgId: string, brandMap: Map<string, string>) {
  console.log("[seed-demo] catalogo...");
  const rows: any[] = [];
  const products = [
    {
      brand: "lenny",
      sku: "PIZZA-MARG",
      name: "Pizza Margherita",
      category: "pizza",
      unit: "pezzo",
      price: 700,
    },
    {
      brand: "lenny",
      sku: "PIZZA-DIAV",
      name: "Pizza Diavola",
      category: "pizza",
      unit: "pezzo",
      price: 850,
    },
    {
      brand: "lenny",
      sku: "PASTA-CARB",
      name: "Pasta Carbonara",
      category: "primi",
      unit: "pezzo",
      price: 900,
    },
    {
      brand: "lenny",
      sku: "BEV-COLA",
      name: "Coca Cola 33cl",
      category: "bevande",
      unit: "pezzo",
      price: 300,
    },
    {
      brand: "stazione",
      sku: "CARB-DIES",
      name: "Diesel",
      category: "carburante",
      unit: "litro",
      price: 180,
    },
    {
      brand: "stazione",
      sku: "CARB-BENZ",
      name: "Benzina",
      category: "carburante",
      unit: "litro",
      price: 185,
    },
    {
      brand: "stazione",
      sku: "LAV-BASE",
      name: "Lavaggio base",
      category: "lavaggio",
      unit: "servizio",
      price: 900,
    },
    {
      brand: "stazione",
      sku: "LAV-PREM",
      name: "Lavaggio premium",
      category: "lavaggio",
      unit: "servizio",
      price: 1500,
    },
    {
      brand: "officina",
      sku: "TAGL-STD",
      name: "Tagliando standard",
      category: "manutenzione",
      unit: "servizio",
      price: 12000,
    },
    {
      brand: "officina",
      sku: "GOM-INV",
      name: "Cambio gomme invernali",
      category: "gomme",
      unit: "servizio",
      price: 4000,
    },
    {
      brand: "officina",
      sku: "ORA-OFFI",
      name: "Ora officina",
      category: "manodopera",
      unit: "ora",
      price: 4500,
    },
    {
      brand: "eni-cafe",
      sku: "CAFE-ESPR",
      name: "Caffe espresso",
      category: "bar",
      unit: "pezzo",
      price: 110,
    },
    {
      brand: "eni-cafe",
      sku: "BRIO-NAT",
      name: "Brioche al naturale",
      category: "bar",
      unit: "pezzo",
      price: 150,
    },
    {
      brand: "eni-cafe",
      sku: "COMBO-COLAZ",
      name: "Colazione caffe+brioche",
      category: "bar",
      unit: "servizio",
      price: 230,
    },
    {
      brand: "eni-cafe",
      sku: "TEA",
      name: "The caldo",
      category: "bar",
      unit: "pezzo",
      price: 180,
    },
  ];
  for (let i = 0; i < products.length; i++) {
    const p = products[i]!;
    const brandId = brandMap.get(p.brand);
    if (!brandId) continue;
    rows.push({
      id: demoUuid(`product-${p.sku}`),
      organization_id: orgId,
      brand_id: brandId,
      sku: p.sku,
      name: p.name,
      category: p.category,
      unit: p.unit,
      price_current_cents: p.price,
      cost_current_cents: Math.floor(p.price * 0.5),
      min_margin_pct: 25,
      source: "manuale",
    });
  }
  await upsert("brand_products", rows);
}

// ============================================================================
// Seed orders (30, spalmate 90gg)
// ============================================================================

async function seedOrders(orgId: string, brandMap: Map<string, string>) {
  console.log("[seed-demo] ordini...");
  const rows: any[] = [];
  const brandsSlugs = Array.from(brandMap.keys());
  for (let i = 0; i < 30; i++) {
    const brandSlug = pick(brandsSlugs, i);
    const brandId = brandMap.get(brandSlug)!;
    const daysAgo = (i * 3) % 90;
    const total = 500 + ((i * 1234) % 4500);
    const status = i % 7 === 6 ? "cancelled" : i % 11 === 10 ? "refunded" : "completed";
    const completedAt =
      status === "completed" || status === "refunded" ? isoDaysAgo(Math.max(0, daysAgo - 1)) : null;
    rows.push({
      id: demoUuid(`order-${i}`),
      organization_id: orgId,
      brand_id: brandId,
      contact_id: demoUuid(`contact-${i % 30}`),
      channel: pick(
        brandSlug === "lenny"
          ? ["delivery", "pickup"]
          : brandSlug === "stazione"
            ? ["carburante", "store"]
            : brandSlug === "officina"
              ? ["officina"]
              : ["store"],
        i,
      ),
      status,
      total_cents: total,
      currency: "EUR",
      placed_at: isoDaysAgo(daysAgo),
      completed_at: completedAt,
    });
  }
  await upsert("brand_orders", rows);
}

// ============================================================================
// Seed partner_restaurants (5 Lenny)
// ============================================================================

async function seedPartnerRestaurants(orgId: string, brandMap: Map<string, string>) {
  console.log("[seed-demo] ristoranti Lenny...");
  const lennyBrandId = brandMap.get("lenny");
  if (!lennyBrandId) return;
  const rows: any[] = [];
  for (let i = 0; i < 5; i++) {
    const isLaunching = i === 0;
    const isCooling = i === 1;
    const isLongActive = i >= 2;
    rows.push({
      id: demoUuid(`partner-restaurant-${i}`),
      organization_id: orgId,
      brand_id: lennyBrandId,
      name: pick(RESTAURANT_NAMES, i),
      referent_name: `${pick(FIRST_NAMES, i * 11)} ${pick(LAST_NAMES, i * 13)}`,
      phone: `+39054112${i}456`,
      email: `info-${i}@ristorante-demo.it`,
      address_city: "Rimini",
      address_cap: pick(["47900", "47891", "47893"], i),
      cuisine_category: pick(CUISINE_CATEGORIES, i),
      avg_prep_minutes: 25 + i * 3,
      onboarding_status:
        isLongActive || isLaunching ? "attivo" : isCooling ? "attivo" : "mai_partito",
      cooling_flag: isCooling,
      cooling_reason: isCooling ? "Lamentele ordini mancati nelle ultime 2 settimane" : null,
      launched_at: isLaunching ? isoDaysAgo(5) : isLongActive ? isoDaysAgo(120 + i * 30) : null,
      launch_target_orders: isLaunching ? 30 : null,
      last_contact_at: isoDaysAgo(i * 7),
    });
  }
  await upsert("partner_restaurants", rows);
}

// ============================================================================
// Seed supply partners (3 fornitori)
// ============================================================================

async function seedSupplyPartners(orgId: string) {
  console.log("[seed-demo] fornitori...");
  const rows = [
    {
      id: demoUuid("supply-coca"),
      organization_id: orgId,
      name: "Coca-Cola Italia",
      referent_name: "Giuseppe Vendrame",
      phone: "+39021234567",
      email: "key.account@coca-cola.it",
      category: "Bevande",
      general_consent: true,
      general_consent_note: "Accordo commerciale 2026 valido 31 dicembre",
      involvement_level: "approves",
      advance_notice_days: 7,
    },
    {
      id: demoUuid("supply-barilla"),
      organization_id: orgId,
      name: "Barilla",
      referent_name: "Laura Bianchi",
      phone: "+39023334455",
      email: "trade@barilla.com",
      category: "Pasta",
      general_consent: false,
      involvement_level: "informed",
      advance_notice_days: 3,
    },
    {
      id: demoUuid("supply-eni"),
      organization_id: orgId,
      name: "Eni Trading & Shipping",
      referent_name: "Marco Rossi",
      phone: "+39026789012",
      email: "stazioni@eni.com",
      category: "Carburanti",
      general_consent: false,
      involvement_level: "name_veto",
      advance_notice_days: 14,
      veto_notes: "Eni richiede 'Carburante Eni' invece di 'benzina' nelle comunicazioni ufficiali",
    },
  ];
  await upsert("supply_partners", rows);
}

// ============================================================================
// Seed content_drafts (20 bozze mix di stati)
// ============================================================================

async function seedContentDrafts(orgId: string, brandMap: Map<string, string>, ownerId: string) {
  console.log("[seed-demo] bozze contenuti...");
  const rows: any[] = [];
  const themes = [
    "Promo pizza martedi",
    "Novita menu invernale",
    "Festa patronale sabato",
    "Chiusura ferie agosto",
    "Nuovo lavaggio premium",
    "Cambio gomme invernali",
    "Caffe social hour",
    "Avviso orari natalizi",
    "Riorganizzazione officina",
    "Programma fedelta lancio",
  ];
  const brandsSlugs = ["lenny", "stazione", "officina", "eni-cafe"];
  for (let i = 0; i < 20; i++) {
    const brandSlug = pick(brandsSlugs, i);
    const brandId = brandMap.get(brandSlug);
    if (!brandId) continue;
    // Mix stati: 7 draft, 4 approved, 4 scheduled, 3 published, 2 rejected
    let status: string,
      scheduledAt: string | null = null,
      publishedAt: string | null = null;
    let approvedAt: string | null = null,
      rejectedAt: string | null = null;
    let rejectionReason: string | null = null;
    if (i < 7) status = "draft";
    else if (i < 11) {
      status = "approved";
      approvedAt = isoDaysAgo(2);
    } else if (i < 15) {
      status = "scheduled";
      approvedAt = isoDaysAgo(5);
      scheduledAt = isoDaysFromNow(i - 10);
    } else if (i < 18) {
      status = "published";
      approvedAt = isoDaysAgo(15);
      scheduledAt = isoDaysAgo(10 - (i - 15));
      publishedAt = isoDaysAgo(10 - (i - 15));
    } else {
      status = "rejected";
      rejectedAt = isoDaysAgo(1);
      rejectionReason = "Tono troppo promozionale per questo marchio";
    }
    const theme = pick(themes, i);
    rows.push({
      id: demoUuid(`draft-${i}`),
      organization_id: orgId,
      brand_id: brandId,
      channel: "social",
      theme_input: theme,
      generated_text:
        `${theme}\n\nDa non perdere questa settimana. Vieni a trovarci al numero 0541-123456. ` +
        `Promo valida fino al 30 novembre.`,
      prompt_version: "social-post-v1",
      model_used: "claude-opus-4-7",
      tokens_in: 250 + (i % 100),
      tokens_out: 120 + (i % 50),
      cost_usd: 0.012,
      latency_ms: 1800,
      status,
      rejection_reason: rejectionReason,
      created_by: ownerId,
      approved_at: approvedAt,
      rejected_at: rejectedAt,
      scheduled_at: scheduledAt,
      published_at: publishedAt,
      topic_label: pick(["promozione", "avviso", "ricorrenza", "officina", "bar", "consegna"], i),
    });
  }
  await upsert("content_drafts", rows);
}

// ============================================================================
// Seed voucher_offers (3)
// ============================================================================

async function seedVoucherOffers(orgId: string, brandMap: Map<string, string>) {
  console.log("[seed-demo] offerte voucher...");
  const lenny = brandMap.get("lenny");
  const stazione = brandMap.get("stazione");
  if (!lenny || !stazione) return;
  const rows = [
    {
      id: demoUuid("offer-lavaggio-gratis"),
      organization_id: orgId,
      issuer_brand_id: stazione,
      spendable_brand_id: stazione,
      name: "Lavaggio base gratis",
      description: "Un lavaggio base dopo 10 rifornimenti",
      reward_kind: "servizio_gratis",
      reward_label: "Lavaggio base",
      default_expires_days: 60,
      cumulable: false,
      is_active: true,
    },
    {
      id: demoUuid("offer-10pct-pizza"),
      organization_id: orgId,
      issuer_brand_id: lenny,
      spendable_brand_id: lenny,
      name: "10% su una pizza",
      description: "Sconto 10% sul prossimo ordine pizza",
      reward_kind: "percentuale",
      reward_pct: 10.0,
      default_expires_days: 30,
      cumulable: false,
      is_active: true,
    },
    {
      id: demoUuid("offer-2eur-benz"),
      organization_id: orgId,
      issuer_brand_id: stazione,
      spendable_brand_id: lenny,
      name: "2€ sul prossimo ordine Lenny",
      description: "Voucher incrociato Stazione->Lenny",
      reward_kind: "valore_fisso",
      reward_value_cents: 200,
      default_expires_days: 45,
      cumulable: false,
      is_active: true,
    },
  ];
  await upsert("voucher_offers", rows);
}

// ============================================================================
// Seed vouchers (20)
// ============================================================================

async function seedVouchers(orgId: string) {
  console.log("[seed-demo] voucher...");
  const offers = [
    { id: demoUuid("offer-lavaggio-gratis"), kind: "servizio_gratis", label: "Lavaggio base" },
    { id: demoUuid("offer-10pct-pizza"), kind: "percentuale", pct: 10.0 },
    { id: demoUuid("offer-2eur-benz"), kind: "valore_fisso", value: 200 },
  ];
  const rows: any[] = [];
  for (let i = 0; i < 20; i++) {
    const offer = offers[i % offers.length]!;
    // Mix: 10 issued, 5 redeemed, 3 expired, 2 cancelled
    let status: string;
    let redeemedAt: string | null = null;
    let cancelledAt: string | null = null;
    let cancelledReason: string | null = null;
    let expiresAt: string;
    if (i < 10) {
      status = "issued";
      expiresAt = isoDaysFromNow(30 - (i % 20));
    } else if (i < 15) {
      status = "redeemed";
      redeemedAt = isoDaysAgo(3 + i);
      expiresAt = isoDaysFromNow(30);
    } else if (i < 18) {
      status = "expired";
      expiresAt = isoDaysAgo(5 + i);
    } else {
      status = "cancelled";
      cancelledAt = isoDaysAgo(2);
      cancelledReason = "Cliente ha chiesto annullamento";
      expiresAt = isoDaysFromNow(30);
    }
    rows.push({
      id: demoUuid(`voucher-${i}`),
      organization_id: orgId,
      offer_id: offer.id,
      contact_id: demoUuid(`contact-${i % 30}`),
      code: demoCode(`voucher-${i}`),
      reward_kind: offer.kind,
      reward_value_cents: offer.value ?? null,
      reward_pct: offer.pct ?? null,
      reward_label: offer.label ?? null,
      status,
      issued_at: isoDaysAgo(10 + i),
      expires_at: expiresAt,
      redeemed_at: redeemedAt,
      cancelled_at: cancelledAt,
      cancelled_reason: cancelledReason,
    });
  }
  await upsert("vouchers", rows);
}

// ============================================================================
// Seed segments + campaigns + landings
// ============================================================================

async function seedSegments(orgId: string, brandMap: Map<string, string>) {
  console.log("[seed-demo] segmenti...");
  const lenny = brandMap.get("lenny");
  if (!lenny) return;
  const rows = [
    {
      id: demoUuid("segment-attivi-30gg"),
      organization_id: orgId,
      brand_id: lenny,
      name: "Attivi 30gg",
      description: "Clienti con almeno 1 ordine negli ultimi 30 giorni",
      criteria: { lastOrderMaxDays: 30, minOrderCount: 1 },
      contact_count_materialized: 15,
      refreshed_at: new Date().toISOString(),
    },
    {
      id: demoUuid("segment-dormienti-60gg"),
      organization_id: orgId,
      brand_id: lenny,
      name: "Dormienti 60gg",
      description: "Nessun ordine negli ultimi 60 giorni",
      criteria: { lastOrderMinDays: 60 },
      contact_count_materialized: 8,
      refreshed_at: new Date().toISOString(),
    },
    {
      id: demoUuid("segment-whatsapp-ok"),
      organization_id: orgId,
      brand_id: lenny,
      name: "Opt-in WhatsApp",
      description: "Contatti con consenso WhatsApp attivo",
      criteria: { requiredConsentChannel: "whatsapp" },
      contact_count_materialized: 18,
      refreshed_at: new Date().toISOString(),
    },
  ];
  await upsert("contact_segments", rows);
}

async function seedCampaigns(orgId: string, brandMap: Map<string, string>) {
  console.log("[seed-demo] campagne...");
  const lenny = brandMap.get("lenny");
  const stazione = brandMap.get("stazione");
  if (!lenny || !stazione) return;
  const rows = [
    {
      id: demoUuid("campaign-pizza-martedi"),
      organization_id: orgId,
      brand_id: lenny,
      segment_id: demoUuid("segment-whatsapp-ok"),
      channel: "whatsapp",
      name: "Promo pizza martedi",
      status: "draft",
      notes: "Ciao! Martedi pizza a -20% con codice MERCO. Prenota al 0541-123456.",
    },
    {
      id: demoUuid("campaign-lavaggio-weekend"),
      organization_id: orgId,
      brand_id: stazione,
      segment_id: demoUuid("segment-attivi-30gg"),
      channel: "email",
      name: "Lavaggio weekend",
      status: "scheduled",
      planned_at: isoDaysFromNow(3),
      notes: "Weekend al car wash: lavaggio premium a meta prezzo. Fino a domenica 7,50€.",
    },
  ];
  await upsert("campaigns", rows);
}

async function seedSignupLandings(orgId: string, brandMap: Map<string, string>) {
  console.log("[seed-demo] landing iscrizione...");
  const lenny = brandMap.get("lenny");
  const eniCafe = brandMap.get("eni-cafe");
  if (!lenny) return;
  const rows: any[] = [
    {
      id: demoUuid("landing-benvenuto-lenny"),
      organization_id: orgId,
      brand_id: lenny,
      slug: "benvenuto-lenny",
      headline: "Benvenuto in Lenny",
      subheadline: "Iscriviti per ricevere offerte dedicate",
      benefit_headline: "Primo ordine con sconto 10%",
      audience_prompt: "Sei residente a San Marino o di passaggio?",
      welcome_offer_id: demoUuid("offer-10pct-pizza"),
      is_active: true,
    },
  ];
  if (eniCafe) {
    rows.push({
      id: demoUuid("landing-stazione-bar"),
      organization_id: orgId,
      brand_id: eniCafe,
      slug: "stazione-bar",
      headline: "Caffe e brioche",
      subheadline: "Il bar della stazione San Marino",
      benefit_headline: "Iscriviti e ricevi la colazione gratuita del venerdi",
      is_active: true,
    });
  }
  await upsert("signup_landings", rows);
}

// ============================================================================
// Seed reminders (M09) — 12 misti pending/sent/dismissed, 7 kinds
// ============================================================================

async function seedReminders(orgId: string, lennyBrandId: string) {
  console.log("[seed-demo] promemoria...");
  const KINDS = [
    "welcome",
    "thanks_order",
    "service_call",
    "voucher_expiring",
    "counter_close",
    "dormant_reactivation",
    "review_request",
  ] as const;
  const MESSAGE_HINTS: Record<(typeof KINDS)[number], string> = {
    welcome: "Diamo il benvenuto e proponiamo primo ordine scontato",
    thanks_order: "Ringrazia l'ordine di ieri e invita a tornare",
    service_call: "Tagliando previsto a breve, promemoria chiamata",
    voucher_expiring: "Voucher attivo che scade nei prossimi 7 giorni",
    counter_close: "Vicino alla soglia loyalty, incentivare l'ultimo ordine",
    dormant_reactivation: "Nessun ordine da 60+ giorni, riattivazione",
    review_request: "Esperienza positiva, chiedi recensione Google",
  };
  const CHANNELS = ["email", "sms", "whatsapp", "misto"] as const;

  const rows: any[] = [];

  // 8 pending (scheduled_at tra 2gg fa e 5gg nel futuro)
  for (let i = 0; i < 8; i++) {
    const kind = KINDS[i % KINDS.length]!;
    const daysOffset = (i % 7) - 2; // -2..+4
    rows.push({
      id: demoUuid(`reminder-pending-${i}`),
      organization_id: orgId,
      brand_id: lennyBrandId,
      contact_id: demoUuid(`contact-${i}`),
      kind,
      channel_hint: pick([...CHANNELS], i),
      status: "pending",
      scheduled_at:
        daysOffset <= 0 ? isoDaysAgo(-daysOffset) : isoDaysFromNow(daysOffset),
      message_hint: MESSAGE_HINTS[kind],
      sent_at: null,
      dismissed_at: null,
    });
  }

  // 2 sent (ieri, usano kind diversi dai pending per evitare UNIQUE parziale)
  for (let i = 0; i < 2; i++) {
    const kind = KINDS[(i + 2) % KINDS.length]!;
    rows.push({
      id: demoUuid(`reminder-sent-${i}`),
      organization_id: orgId,
      brand_id: lennyBrandId,
      contact_id: demoUuid(`contact-${10 + i}`),
      kind,
      channel_hint: "email",
      status: "sent",
      scheduled_at: isoDaysAgo(2),
      sent_at: isoDaysAgo(1),
      dismissed_at: null,
      message_hint: MESSAGE_HINTS[kind],
    });
  }

  // 2 dismissed (2gg fa)
  for (let i = 0; i < 2; i++) {
    const kind = KINDS[(i + 4) % KINDS.length]!;
    rows.push({
      id: demoUuid(`reminder-dismissed-${i}`),
      organization_id: orgId,
      brand_id: lennyBrandId,
      contact_id: demoUuid(`contact-${12 + i}`),
      kind,
      channel_hint: "sms",
      status: "dismissed",
      scheduled_at: isoDaysAgo(3),
      sent_at: null,
      dismissed_at: isoDaysAgo(2),
      message_hint: MESSAGE_HINTS[kind],
      notes: "Contatto gia' gestito manualmente",
    });
  }

  await upsert("reminders", rows);
}

// ============================================================================
// Seed abandonment_signals (M09 anti-abbandono) — 10 segnali misti
// 2 high + 3 medium + 3 low + 1 risolto + 1 nel passato (ri-aperto non applicabile)
// ============================================================================

async function seedAbandonmentSignals(orgId: string, lennyBrandId: string) {
  console.log("[seed-demo] segnali abbandono...");
  // Pulizia segnali auto-generati dal detector M09 (notes fingerprint):
  // il detector crea righe con "60+ giorni senza ordini (ultimo:..." che si
  // affiancano a quelle controllate del seed e confondono il conteggio UI.
  // Rilanciare "Ricalcola segnali" dalla UI le ricreera' comunque.
  const { error: delErr, count: delCount } = await admin
    .from("abandonment_signals")
    .delete({ count: "exact" })
    .eq("organization_id", orgId)
    .like("notes", "60+ giorni senza ordini (ultimo:%");
  if (delErr) throw new Error(`cleanup detector signals: ${delErr.message}`);
  if (delCount && delCount > 0)
    console.log(`  [abandonment_signals] ${delCount} auto-generati rimossi`);

  // Mix: 4 kinds x livelli di gravita'. UNIQUE parziale e' per (contact, kind)
  // dove resolved_at IS NULL, quindi varo contact_id per non collidere.
  const SIGNALS: Array<{
    seed: string;
    contactIdx: number;
    kind: "skipped_week" | "dropped_frequency" | "silence_gap" | "inactivity";
    severity: "low" | "medium" | "high";
    daysAgo: number;
    windowDays: number;
    prevCount: number;
    currCount: number;
    notes?: string;
    resolved?: { daysAgo: number; reason: string };
  }> = [
    // 2 high — i piu' urgenti
    {
      seed: "aband-h-1",
      contactIdx: 15,
      kind: "inactivity",
      severity: "high",
      daysAgo: 1,
      windowDays: 60,
      prevCount: 8,
      currCount: 0,
      notes: "Cliente abituale, nessun ordine da 60+ giorni",
    },
    {
      seed: "aband-h-2",
      contactIdx: 16,
      kind: "dropped_frequency",
      severity: "high",
      daysAgo: 2,
      windowDays: 90,
      prevCount: 12,
      currCount: 3,
      notes: "Frequenza passata da 4 a 1 ordine al mese",
    },
    // 3 medium
    {
      seed: "aband-m-1",
      contactIdx: 17,
      kind: "silence_gap",
      severity: "medium",
      daysAgo: 3,
      windowDays: 30,
      prevCount: 4,
      currCount: 0,
      notes: "30+ giorni senza ordini",
    },
    {
      seed: "aband-m-2",
      contactIdx: 18,
      kind: "skipped_week",
      severity: "medium",
      daysAgo: 4,
      windowDays: 14,
      prevCount: 2,
      currCount: 0,
      notes: "Cliente settimanale che ha saltato una settimana",
    },
    {
      seed: "aband-m-3",
      contactIdx: 19,
      kind: "dropped_frequency",
      severity: "medium",
      daysAgo: 5,
      windowDays: 60,
      prevCount: 6,
      currCount: 2,
    },
    // 3 low
    {
      seed: "aband-l-1",
      contactIdx: 20,
      kind: "skipped_week",
      severity: "low",
      daysAgo: 2,
      windowDays: 14,
      prevCount: 1,
      currCount: 0,
    },
    {
      seed: "aband-l-2",
      contactIdx: 21,
      kind: "silence_gap",
      severity: "low",
      daysAgo: 6,
      windowDays: 30,
      prevCount: 2,
      currCount: 0,
    },
    {
      seed: "aband-l-3",
      contactIdx: 22,
      kind: "inactivity",
      severity: "low",
      daysAgo: 7,
      windowDays: 60,
      prevCount: 2,
      currCount: 0,
    },
    // 1 risolto (settimana scorsa) — testa la storia
    {
      seed: "aband-resolved-1",
      contactIdx: 23,
      kind: "silence_gap",
      severity: "medium",
      daysAgo: 20,
      windowDays: 30,
      prevCount: 5,
      currCount: 0,
      notes: "Cliente contattato telefonicamente",
      resolved: { daysAgo: 15, reason: "contattato_e_tornato" },
    },
  ];

  const rows: any[] = SIGNALS.map((s) => {
    const signalAt = isoDaysAgo(s.daysAgo);
    const windowEnd = signalAt;
    const windowStart = new Date(
      new Date(signalAt).getTime() - s.windowDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const row: any = {
      id: demoUuid(s.seed),
      organization_id: orgId,
      brand_id: lennyBrandId,
      contact_id: demoUuid(`contact-${s.contactIdx}`),
      kind: s.kind,
      severity: s.severity,
      signal_at: signalAt,
      window_start: windowStart,
      window_end: windowEnd,
      previous_orders_count: s.prevCount,
      current_orders_count: s.currCount,
      notes: s.notes ?? null,
      resolved_at: null,
      resolved_reason: null,
    };
    if (s.resolved) {
      row.resolved_at = isoDaysAgo(s.resolved.daysAgo);
      row.resolved_reason = s.resolved.reason;
    }
    return row;
  });

  await upsert("abandonment_signals", rows);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\n[seed-demo] inizio seed demo dati\n");
  const { orgId, brandMap } = await resolveContext();

  // Owner id per content_drafts.created_by: cerco il primo user profile
  const { data: profiles } = await admin
    .from("users_profile")
    .select("user_id")
    .eq("organization_id", orgId)
    .limit(1);
  const ownerId = profiles?.[0]?.user_id as string | undefined;
  if (!ownerId) throw new Error("Nessun user_profile trovato per questa org.");
  console.log(`[seed-demo] owner user_id: ${ownerId}\n`);

  const lenny = brandMap.get("lenny");
  if (!lenny) throw new Error("Brand 'lenny' non trovato.");

  await seedContacts(orgId, lenny);
  await seedConsents(orgId);
  await seedVehicles(orgId);
  await seedCatalog(orgId, brandMap);
  await seedOrders(orgId, brandMap);
  await seedPartnerRestaurants(orgId, brandMap);
  await seedSupplyPartners(orgId);
  await seedContentDrafts(orgId, brandMap, ownerId);
  await seedVoucherOffers(orgId, brandMap);
  await seedVouchers(orgId);
  await seedSegments(orgId, brandMap);
  await seedCampaigns(orgId, brandMap);
  await seedSignupLandings(orgId, brandMap);
  await seedReminders(orgId, lenny);
  await seedAbandonmentSignals(orgId, lenny);

  console.log("\n[seed-demo] completato con successo ✓\n");
}

main().catch((err) => {
  console.error("\n[seed-demo] errore:", err);
  process.exit(1);
});
