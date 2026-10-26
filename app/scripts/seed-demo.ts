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

  // 3 duplicati sintetici per far vedere il detector in azione.
  // Dedup-detector matcha su email/phone/whatsapp normalizzati (lowercase,
  // phone senza spazi/trattini/+). I 3 casi coprono i 3 criteri.
  // Prendo come "principale" i contatti 0, 1, 2 esistenti e creo un
  // duplicato per ciascuno con un campo match differente.
  const base0 = rows[0]!; // Caso A: stessa email del principale
  const base1 = rows[1]!; // Caso B: stesso telefono (ma con formato diverso)
  const base2 = rows[2]!; // Caso C: stesso whatsapp
  rows.push(
    {
      // Duplicato per EMAIL: stesso valore di base0.email
      id: demoUuid("contact-dup-email"),
      organization_id: orgId,
      brand_id: lennyBrandId,
      first_name: base0.first_name,
      last_name: base0.last_name,
      email: base0.email, // STESSA email -> match
      phone: `+393999000001`,
      whatsapp: `+393999000001`,
      source: "web",
      tags: [],
      address_cap: "47900",
    },
    {
      // Duplicato per PHONE: stesso numero scritto con spazi (il normalizer li toglie)
      id: demoUuid("contact-dup-phone"),
      organization_id: orgId,
      brand_id: lennyBrandId,
      first_name: base1.first_name,
      last_name: base1.last_name,
      email: `${(base1.first_name as string).toLowerCase()}.alt@example.com`,
      phone: (base1.phone as string)
        .replace("+393", "+39 3")
        .replace(/(.{3})(.{3})(.{3})/, "$1 $2 $3"), // stesso numero con spazi
      whatsapp: null,
      source: "manuale",
      tags: [],
      address_cap: "47891",
    },
    {
      // Duplicato per WHATSAPP: stesso numero
      id: demoUuid("contact-dup-whatsapp"),
      organization_id: orgId,
      brand_id: lennyBrandId,
      first_name: base2.first_name,
      last_name: base2.last_name,
      email: `${(base2.first_name as string).toLowerCase()}.b@example.com`,
      phone: `+393999000003`,
      whatsapp: base2.whatsapp, // STESSO whatsapp -> match
      source: "import",
      tags: [],
      address_cap: "47893",
    },
  );
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
  // Pulizia residui vecchi: i piatti Lenny food (pizza/pasta/bevande) sono
  // stati rimossi dal catalogo di Regia. Il ristoratore li gestisce nel suo
  // gestionale. Nel catalogo di Lenny stanno solo le CONSEGNE (unico
  // prodotto economico di cui il gruppo e' proprietario).
  const lennyFoodSkus = ["PIZZA-MARG", "PIZZA-DIAV", "PASTA-CARB", "BEV-COLA"];
  const { error: delErr, count: delCount } = await admin
    .from("brand_products")
    .delete({ count: "exact" })
    .eq("organization_id", orgId)
    .in("sku", lennyFoodSkus);
  if (delErr) throw new Error(`cleanup lenny food: ${delErr.message}`);
  if (delCount && delCount > 0)
    console.log(`  [brand_products] ${delCount} piatti Lenny rimossi (gestiti dal ristoratore)`);

  const rows: any[] = [];
  // Convenzione:
  // - Lenny: solo CONSEGNA. Il gruppo guadagna sulla logistica (rider).
  //   I piatti sono del ristoratore -> non entrano in catalogo Regia.
  // - Stazione / Officina / Eni-cafe: stock di proprieta' -> cost+margin pieni.
  const products: Array<{
    brand: string;
    sku: string;
    name: string;
    category: string;
    unit: string;
    price: number;
    cost?: number;
    marginPct?: number;
  }> = [
    // Lenny consegna: il gruppo guadagna sulla logistica
    {
      brand: "lenny",
      sku: "CONSEGNA-STD",
      name: "Consegna standard",
      category: "consegna",
      unit: "servizio",
      price: 300,
      cost: 180, // rider + packaging ammortizzato
      marginPct: 40,
    },
    {
      brand: "lenny",
      sku: "CONSEGNA-EXP",
      name: "Consegna espressa <20min",
      category: "consegna",
      unit: "servizio",
      price: 500,
      cost: 250,
      marginPct: 50,
    },
    // Stazione/Officina/Eni-cafe: stock di proprieta' con cost+margin pieni
    {
      brand: "stazione",
      sku: "CARB-DIES",
      name: "Diesel",
      category: "carburante",
      unit: "litro",
      price: 180,
      cost: 160,
      marginPct: 11,
    },
    {
      brand: "stazione",
      sku: "CARB-BENZ",
      name: "Benzina",
      category: "carburante",
      unit: "litro",
      price: 185,
      cost: 165,
      marginPct: 11,
    },
    {
      brand: "stazione",
      sku: "LAV-BASE",
      name: "Lavaggio base",
      category: "lavaggio",
      unit: "servizio",
      price: 900,
      cost: 300,
      marginPct: 66,
    },
    {
      brand: "stazione",
      sku: "LAV-PREM",
      name: "Lavaggio premium",
      category: "lavaggio",
      unit: "servizio",
      price: 1500,
      cost: 500,
      marginPct: 66,
    },
    {
      brand: "officina",
      sku: "TAGL-STD",
      name: "Tagliando standard",
      category: "manutenzione",
      unit: "servizio",
      price: 12000,
      cost: 6000,
      marginPct: 50,
    },
    {
      brand: "officina",
      sku: "GOM-INV",
      name: "Cambio gomme invernali",
      category: "gomme",
      unit: "servizio",
      price: 4000,
      cost: 2000,
      marginPct: 50,
    },
    {
      brand: "officina",
      sku: "ORA-OFFI",
      name: "Ora officina",
      category: "manodopera",
      unit: "ora",
      price: 4500,
      cost: 2250,
      marginPct: 50,
    },
    {
      brand: "eni-cafe",
      sku: "CAFE-ESPR",
      name: "Caffe espresso",
      category: "bar",
      unit: "pezzo",
      price: 110,
      cost: 25,
      marginPct: 77,
    },
    {
      brand: "eni-cafe",
      sku: "BRIO-NAT",
      name: "Brioche al naturale",
      category: "bar",
      unit: "pezzo",
      price: 150,
      cost: 60,
      marginPct: 60,
    },
    {
      brand: "eni-cafe",
      sku: "COMBO-COLAZ",
      name: "Colazione caffe+brioche",
      category: "bar",
      unit: "servizio",
      price: 230,
      cost: 80,
      marginPct: 65,
    },
    {
      brand: "eni-cafe",
      sku: "TEA",
      name: "The caldo",
      category: "bar",
      unit: "pezzo",
      price: 180,
      cost: 40,
      marginPct: 77,
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
      cost_current_cents: p.cost ?? null,
      min_margin_pct: p.marginPct ?? null,
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
  // SKU di catalogo per generare righe plausibili. Lenny: solo consegne +
  // righe "piatto generico" senza product_id (snapshot name = "Pizza/Pasta/..."
  // -> simula quello che arriverebbe dal gestionale ristoratore in futuro).
  const PRODUCT_POOLS: Record<string, Array<{ sku?: string; name: string; price: number }>> = {
    lenny: [
      { name: "Pizza del territorio", price: 850 },
      { name: "Primo di stagione", price: 950 },
      { name: "Bevanda 33cl", price: 300 },
      { sku: "CONSEGNA-STD", name: "Consegna standard", price: 300 },
      { sku: "CONSEGNA-EXP", name: "Consegna espressa <20min", price: 500 },
    ],
    stazione: [
      { sku: "CARB-DIES", name: "Diesel", price: 180 },
      { sku: "CARB-BENZ", name: "Benzina", price: 185 },
      { sku: "LAV-BASE", name: "Lavaggio base", price: 900 },
      { sku: "LAV-PREM", name: "Lavaggio premium", price: 1500 },
    ],
    officina: [
      { sku: "TAGL-STD", name: "Tagliando standard", price: 12000 },
      { sku: "GOM-INV", name: "Cambio gomme invernali", price: 4000 },
      { sku: "ORA-OFFI", name: "Ora officina", price: 4500 },
    ],
    "eni-cafe": [
      { sku: "CAFE-ESPR", name: "Caffe espresso", price: 110 },
      { sku: "BRIO-NAT", name: "Brioche al naturale", price: 150 },
      { sku: "COMBO-COLAZ", name: "Colazione caffe+brioche", price: 230 },
      { sku: "TEA", name: "The caldo", price: 180 },
    ],
  };

  const orders: any[] = [];
  const lines: any[] = [];
  const brandsSlugs = Array.from(brandMap.keys());
  for (let i = 0; i < 30; i++) {
    const brandSlug = pick(brandsSlugs, i);
    const brandId = brandMap.get(brandSlug)!;
    const daysAgo = (i * 3) % 90;
    const status = i % 7 === 6 ? "cancelled" : i % 11 === 10 ? "refunded" : "completed";
    const completedAt =
      status === "completed" || status === "refunded" ? isoDaysAgo(Math.max(0, daysAgo - 1)) : null;
    const orderId = demoUuid(`order-${i}`);

    // Costruzione righe: 1-3 prodotti dal pool del brand
    const pool = PRODUCT_POOLS[brandSlug] ?? [];
    const nLines = Math.min(pool.length, 1 + (i % 3));
    let totalCents = 0;
    for (let j = 0; j < nLines; j++) {
      const p = pool[(i * 7 + j) % pool.length]!;
      const qty = p.sku === "CARB-DIES" || p.sku === "CARB-BENZ" ? 20 + (i % 15) : 1 + (j % 2);
      const lineTotal = p.price * qty;
      totalCents += lineTotal;
      lines.push({
        id: demoUuid(`order-line-${i}-${j}`),
        order_id: orderId,
        product_id: p.sku ? demoUuid(`product-${p.sku}`) : null,
        name_snapshot: p.name,
        unit_price_cents: p.price,
        quantity: qty,
        line_total_cents: lineTotal,
      });
    }
    // Per Lenny delivery assicuriamoci che ci sia una consegna
    if (
      brandSlug === "lenny" &&
      !lines.some((l) => l.order_id === orderId && l.name_snapshot.startsWith("Consegna"))
    ) {
      const consegna = pool.find((p) => p.sku === "CONSEGNA-STD")!;
      totalCents += consegna.price;
      lines.push({
        id: demoUuid(`order-line-${i}-consegna`),
        order_id: orderId,
        product_id: demoUuid(`product-${consegna.sku}`),
        name_snapshot: consegna.name,
        unit_price_cents: consegna.price,
        quantity: 1,
        line_total_cents: consegna.price,
      });
    }

    orders.push({
      id: orderId,
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
      total_cents: totalCents,
      currency: "EUR",
      placed_at: isoDaysAgo(daysAgo),
      completed_at: completedAt,
    });
  }
  await upsert("brand_orders", orders);
  await upsert("brand_order_lines", lines);
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
  // Pulizia Barilla: nel seed precedente c'era ma non ha senso nel modello
  // del gruppo. Lenny non ha fornitori propri (ingredienti gestiti dai
  // ristoratori partner). I fornitori veri sono solo per Stazione (Eni
  // carburanti), Officina (ricambi) ed Eni Cafe (bar).
  await admin.from("supply_partners").delete().eq("organization_id", orgId).eq("name", "Barilla");

  const rows = [
    // Stazione: fornitore carburanti con name_veto (Eni ha brand da proteggere)
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
    // Eni Cafe: Illy per il caffe (approves, serve OK sulle promo con il brand)
    {
      id: demoUuid("supply-illy"),
      organization_id: orgId,
      name: "Illycaffe S.p.A.",
      referent_name: "Elena Marchetti",
      phone: "+39040389021",
      email: "trade.it@illy.com",
      category: "Caffe",
      general_consent: true,
      general_consent_note: "Accordo HORECA 2026: promo standard pre-approvate",
      involvement_level: "approves",
      advance_notice_days: 7,
    },
    // Eni Cafe: Melegatti per brioche (informed, nessun gate)
    {
      id: demoUuid("supply-melegatti"),
      organization_id: orgId,
      name: "Melegatti",
      referent_name: "Alberto Veneziani",
      phone: "+39045678901",
      email: "horeca@melegatti.it",
      category: "Brioche e dolci da bar",
      general_consent: false,
      involvement_level: "informed",
      advance_notice_days: 3,
    },
    // Eni Cafe: Coca-Cola per bevande (approves + blanket)
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
    // Officina: Bosch per ricambi (informed, grandi marchi)
    {
      id: demoUuid("supply-bosch"),
      organization_id: orgId,
      name: "Bosch Service",
      referent_name: "Thomas Müller",
      phone: "+390118901234",
      email: "aftermarket.it@bosch.com",
      category: "Ricambi auto",
      general_consent: false,
      involvement_level: "informed",
      advance_notice_days: 3,
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
  // Attribuzione RF-9.3: 6 voucher collegati ai 3 draft published (seed i=15,16,17).
  // Serve a popolare la sezione "Attribuzione contenuto -> vendita" in /analytics.
  // Risultato atteso: copertura 30% (6/20), 3 attribuiti redeemed.
  const sourceDraftByVoucher: Record<number, string> = {
    0: demoUuid("draft-15"), // issued -> emesso attribuito
    1: demoUuid("draft-15"),
    2: demoUuid("draft-16"), // issued -> emesso attribuito
    10: demoUuid("draft-16"), // redeemed -> riscattato attribuito
    11: demoUuid("draft-17"), // redeemed -> riscattato attribuito
    12: demoUuid("draft-17"), // redeemed -> riscattato attribuito
  };
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
      source_draft_id: sourceDraftByVoucher[i] ?? null,
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
  // Pulizia reminder auto-generati dal detector M09 (fingerprint: channel_hint IS NULL):
  // il bottone "Ricalcola segnali" scansiona veicoli/voucher/dormienti e crea
  // pending con channel_hint non settato (lo decide sendReminderNow al momento).
  // Noi del seed settiamo channel_hint esplicito, quindi la IS NULL discrimina
  // tutto cio' che e' stato auto-generato.
  const { error: delErr, count: delCount } = await admin
    .from("reminders")
    .delete({ count: "exact" })
    .eq("organization_id", orgId)
    .is("channel_hint", null);
  if (delErr) throw new Error(`cleanup detector reminders: ${delErr.message}`);
  if (delCount && delCount > 0) console.log(`  [reminders] ${delCount} auto-generati rimossi`);

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
      scheduled_at: daysOffset <= 0 ? isoDaysAgo(-daysOffset) : isoDaysFromNow(daysOffset),
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
