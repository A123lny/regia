// M04 — RF-4.2 Registry degli 8 template grafici di marca.
// Ogni template è una funzione che riceve TemplateRenderInput e ritorna JSX
// per satori (subset di CSS supportato).
// Layout: sfondo colorato brand, banda in cima, titolo grande, sottotitolo,
// footer con brand name. Variazioni per uso specifico.

import type { ReactNode } from "react";
import type { TemplateDefinition, TemplateRenderInput } from "./template-types";

type TemplateRenderer = (input: TemplateRenderInput) => ReactNode;

// ── Helper: sfondo colorato con banda header ────────────────────────────────
function bgWithHeader(color: string, children: ReactNode): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#faf7f2",
      }}
    >
      <div
        style={{
          display: "flex",
          height: "8%",
          backgroundColor: color,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "60px 80px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function brandFooter(input: TemplateRenderInput): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginTop: "auto",
        paddingTop: 40,
        borderTop: `4px solid ${input.brandColor}`,
      }}
    >
      {input.brandLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={input.brandLogoUrl}
          alt=""
          width={60}
          height={60}
          style={{
            width: 60,
            height: 60,
            borderRadius: 12,
            objectFit: "cover",
            marginRight: 20,
          }}
        />
      )}
      <div
        style={{
          fontSize: 40,
          fontWeight: 800,
          fontFamily: "Bricolage",
          color: input.brandColor,
          textTransform: "uppercase",
          letterSpacing: 4,
        }}
      >
        {input.brandDisplayName}
      </div>
    </div>
  );
}

// ── LENNY: Ristorante della settimana ───────────────────────────────────────
const lennyRestaurantOfWeek: TemplateRenderer = (input) =>
  bgWithHeader(
    input.brandColor,
    <>
      <div
        style={{
          display: "flex",
          fontSize: 32,
          color: input.brandColor,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 4,
          marginBottom: 30,
        }}
      >
        Ristorante della settimana
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 90,
          fontWeight: 800,
          fontFamily: "Bricolage",
          color: "#2c1810",
          lineHeight: 1.1,
          marginBottom: 30,
        }}
      >
        {input.fields["title"] || "Nome ristorante"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 40,
          color: "#2c1810",
          lineHeight: 1.4,
        }}
      >
        {input.fields["description"] || "Descrizione del ristorante e dei suoi piatti di punta."}
      </div>
      {brandFooter(input)}
    </>,
  );

// ── LENNY: Annuncio promozionale ────────────────────────────────────────────
const lennyPromoAnnounce: TemplateRenderer = (input) =>
  bgWithHeader(
    input.brandColor,
    <>
      <div
        style={{
          display: "flex",
          fontSize: 200,
          fontWeight: 800,
          fontFamily: "Bricolage",
          color: input.brandColor,
          lineHeight: 0.9,
          marginBottom: 20,
        }}
      >
        {input.fields["headline"] || "-20%"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 60,
          fontWeight: 700,
          color: "#2c1810",
          lineHeight: 1.1,
          marginBottom: 30,
        }}
      >
        {input.fields["title"] || "Su tutti gli ordini del mercoledì"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 36,
          color: "#7a6857",
          lineHeight: 1.3,
        }}
      >
        {input.fields["details"] || "Solo con codice: MERCO"}
      </div>
      {brandFooter(input)}
    </>,
  );

// ── LENNY/STAZIONE: Avviso di servizio ──────────────────────────────────────
const serviceNotice: TemplateRenderer = (input) =>
  bgWithHeader(
    input.brandColor,
    <>
      <div
        style={{
          display: "flex",
          fontSize: 32,
          color: input.brandColor,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 6,
          marginBottom: 40,
        }}
      >
        Avviso
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 72,
          fontWeight: 800,
          fontFamily: "Bricolage",
          color: "#2c1810",
          lineHeight: 1.15,
          marginBottom: 30,
        }}
      >
        {input.fields["title"] || "Chiuso venerdì per formazione"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 44,
          color: "#7a6857",
          lineHeight: 1.4,
        }}
      >
        {input.fields["details"] || "Riapertura sabato mattina alle 8."}
      </div>
      {brandFooter(input)}
    </>,
  );

// ── LENNY: Reclutamento rider ───────────────────────────────────────────────
const lennyRiderRecruitment: TemplateRenderer = (input) =>
  bgWithHeader(
    input.brandColor,
    <>
      <div
        style={{
          display: "flex",
          fontSize: 80,
          fontWeight: 800,
          fontFamily: "Bricolage",
          color: input.brandColor,
          lineHeight: 1,
          marginBottom: 30,
        }}
      >
        Cerchiamo rider
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 56,
          fontWeight: 700,
          color: "#2c1810",
          lineHeight: 1.15,
          marginBottom: 30,
        }}
      >
        {input.fields["headline"] || "Fasce 19-22, weekend"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 38,
          color: "#7a6857",
          lineHeight: 1.35,
        }}
      >
        {input.fields["details"] ||
          "Bici o scooter propri. Compenso a consegna + bonus fasce piene."}
      </div>
      {brandFooter(input)}
    </>,
  );

// ── STAZIONE: Servizio in evidenza ──────────────────────────────────────────
const stazioneServiceHighlight: TemplateRenderer = (input) =>
  bgWithHeader(
    input.brandColor,
    <>
      <div
        style={{
          display: "flex",
          fontSize: 28,
          color: input.brandColor,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 4,
          marginBottom: 40,
        }}
      >
        Servizio in evidenza
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 96,
          fontWeight: 800,
          fontFamily: "Bricolage",
          color: "#2c1810",
          lineHeight: 1,
          marginBottom: 30,
        }}
      >
        {input.fields["service"] || "Cambio olio"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 48,
          color: "#7a6857",
          lineHeight: 1.3,
          marginBottom: 30,
        }}
      >
        {input.fields["details"] || "Su prenotazione. Prezzo trasparente, olio e filtro inclusi."}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 36,
          color: input.brandColor,
          fontWeight: 700,
        }}
      >
        {input.fields["cta"] || "Prenota in officina o telefona"}
      </div>
      {brandFooter(input)}
    </>,
  );

// ── STAZIONE: Consiglio pratico stagionale ──────────────────────────────────
const stazioneSeasonalTip: TemplateRenderer = (input) =>
  bgWithHeader(
    input.brandColor,
    <>
      <div
        style={{
          display: "flex",
          fontSize: 32,
          color: input.brandColor,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 6,
          marginBottom: 40,
        }}
      >
        Consiglio del mese
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 68,
          fontWeight: 800,
          fontFamily: "Bricolage",
          color: "#2c1810",
          lineHeight: 1.1,
          marginBottom: 40,
        }}
      >
        {input.fields["tip"] || "Controlla la pressione gomme prima delle ferie"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 40,
          color: "#7a6857",
          lineHeight: 1.35,
        }}
      >
        {input.fields["details"] || "Pressione corretta = meno consumo + meno usura."}
      </div>
      {brandFooter(input)}
    </>,
  );

// ── STAZIONE: Volti del personale ───────────────────────────────────────────
const stazioneStaffPortrait: TemplateRenderer = (input) =>
  bgWithHeader(
    input.brandColor,
    <>
      <div
        style={{
          display: "flex",
          fontSize: 28,
          color: input.brandColor,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 4,
          marginBottom: 40,
        }}
      >
        Le persone
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 108,
          fontWeight: 800,
          fontFamily: "Bricolage",
          color: "#2c1810",
          lineHeight: 1,
          marginBottom: 20,
        }}
      >
        {input.fields["name"] || "Marco"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 40,
          color: input.brandColor,
          fontWeight: 700,
          marginBottom: 40,
        }}
      >
        {input.fields["role"] || "Meccanico dal 2018"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 38,
          color: "#7a6857",
          lineHeight: 1.35,
          fontStyle: "italic",
        }}
      >
        &ldquo;{input.fields["quote"] || "Il cliente lo capisce quando gli spieghi cosa fai."}
        &rdquo;
      </div>
      {brandFooter(input)}
    </>,
  );

// ── RF-4.7 Locandina Lenny promo A4 (300dpi, font scalati) ──────────────────
const lennyLocandinaA4: TemplateRenderer = (input) =>
  bgWithHeader(
    input.brandColor,
    <>
      <div
        style={{
          display: "flex",
          fontSize: 72,
          color: input.brandColor,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 10,
          marginBottom: 80,
        }}
      >
        {input.fields["kicker"] || "Promo del mese"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 480,
          fontWeight: 800,
          fontFamily: "Bricolage",
          color: input.brandColor,
          lineHeight: 0.9,
          marginBottom: 60,
        }}
      >
        {input.fields["headline"] || "-20%"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 140,
          fontWeight: 700,
          color: "#2c1810",
          lineHeight: 1.1,
          marginBottom: 80,
        }}
      >
        {input.fields["title"] || "Su tutti gli ordini del mercoledì"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 72,
          color: "#7a6857",
          lineHeight: 1.3,
        }}
      >
        {input.fields["details"] || "Solo con codice: MERCO · fino al 30/11"}
      </div>
      {brandFooter(input)}
    </>,
  );

// ── RF-4.7 Locandina Stazione servizio A4 (300dpi, font scalati) ────────────
const stazioneLocandinaA4: TemplateRenderer = (input) =>
  bgWithHeader(
    input.brandColor,
    <>
      <div
        style={{
          display: "flex",
          fontSize: 72,
          color: input.brandColor,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 10,
          marginBottom: 80,
        }}
      >
        {input.fields["kicker"] || "Avviso officina"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 220,
          fontWeight: 800,
          fontFamily: "Bricolage",
          color: "#2c1810",
          lineHeight: 1,
          marginBottom: 60,
        }}
      >
        {input.fields["title"] || "Cambio gomme invernali"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 110,
          fontWeight: 700,
          color: input.brandColor,
          marginBottom: 60,
        }}
      >
        {input.fields["cta"] || "Prenota adesso"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 72,
          color: "#7a6857",
          lineHeight: 1.35,
        }}
      >
        {input.fields["details"] || "Hai tempo fino al 15 novembre per lo scambio."}
      </div>
      {brandFooter(input)}
    </>,
  );

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: "lenny-restaurant-of-week",
    name: "Ristorante della settimana",
    description: "Highlight di un ristorante della rete Lenny",
    brandSlugs: ["lenny"],
    format: "square",
    fields: [
      { key: "title", label: "Nome ristorante", required: true, maxLength: 60 },
      {
        key: "description",
        label: "Descrizione (piatti, storia, cosa piace)",
        required: true,
        maxLength: 200,
        multiline: true,
      },
    ],
  },
  {
    id: "lenny-promo-announce",
    name: "Annuncio promozionale",
    description: "Percentuale grande + dettagli sotto",
    brandSlugs: ["lenny"],
    format: "square",
    fields: [
      { key: "headline", label: "Percentuale/prezzo (grande)", required: true, maxLength: 10 },
      { key: "title", label: "Titolo promo", required: true, maxLength: 60 },
      { key: "details", label: "Dettagli (codice, condizioni)", required: false, maxLength: 100 },
    ],
  },
  {
    id: "lenny-service-notice",
    name: "Avviso di servizio (Lenny)",
    description: "Chiusure, cambi orario, disservizi",
    brandSlugs: ["lenny"],
    format: "square",
    fields: [
      { key: "title", label: "Cosa comunicare", required: true, maxLength: 80 },
      {
        key: "details",
        label: "Dettagli aggiuntivi",
        required: false,
        maxLength: 150,
        multiline: true,
      },
    ],
  },
  {
    id: "lenny-rider-recruitment",
    name: "Reclutamento rider",
    description: "Annuncio ricerca rider",
    brandSlugs: ["lenny"],
    format: "square",
    fields: [
      { key: "headline", label: "Fasce/turni", required: true, maxLength: 60 },
      {
        key: "details",
        label: "Compenso / requisiti",
        required: false,
        maxLength: 150,
        multiline: true,
      },
    ],
  },
  {
    id: "stazione-service-highlight",
    name: "Servizio in evidenza",
    description: "Servizio della stazione (officina, bar, ecc.)",
    brandSlugs: ["stazione", "officina", "eni-cafe"],
    format: "square",
    fields: [
      { key: "service", label: "Nome servizio", required: true, maxLength: 40 },
      { key: "details", label: "Cosa include / condizioni", required: false, maxLength: 150 },
      { key: "cta", label: "Call to action", required: false, maxLength: 60 },
    ],
  },
  {
    id: "stazione-service-notice",
    name: "Avviso di servizio (Stazione)",
    description: "Chiusure, cambi orario stazione",
    brandSlugs: ["stazione", "officina", "eni-cafe"],
    format: "square",
    fields: [
      { key: "title", label: "Cosa comunicare", required: true, maxLength: 80 },
      { key: "details", label: "Dettagli", required: false, maxLength: 150, multiline: true },
    ],
  },
  {
    id: "stazione-seasonal-tip",
    name: "Consiglio pratico stagionale",
    description: "Consiglio del mese (gomme, batteria, ecc.)",
    brandSlugs: ["stazione", "officina"],
    format: "square",
    fields: [
      { key: "tip", label: "Consiglio", required: true, maxLength: 80 },
      { key: "details", label: "Perche funziona", required: false, maxLength: 150 },
    ],
  },
  {
    id: "stazione-staff-portrait",
    name: "Volti del personale",
    description: "Presentazione membro dello staff",
    brandSlugs: ["stazione", "officina", "eni-cafe"],
    format: "square",
    fields: [
      { key: "name", label: "Nome", required: true, maxLength: 30 },
      { key: "role", label: "Ruolo (es. Meccanico dal 2018)", required: true, maxLength: 60 },
      { key: "quote", label: "Frase o quote personale", required: false, maxLength: 120 },
    ],
  },
  // RF-4.7 Locandine A4 stampabili
  {
    id: "lenny-locandina-a4",
    name: "Locandina promo A4 (Lenny)",
    description: "Locandina stampabile 300dpi — da attaccare in vetrina/all'ingresso",
    brandSlugs: ["lenny"],
    format: "a4-portrait",
    fields: [
      { key: "kicker", label: "Occhiello (es. Promo del mese)", required: false, maxLength: 40 },
      { key: "headline", label: "Numero/claim gigante (es. -20%)", required: true, maxLength: 10 },
      { key: "title", label: "Titolo", required: true, maxLength: 60 },
      {
        key: "details",
        label: "Dettagli (condizioni, codice, scadenza)",
        required: false,
        maxLength: 150,
      },
    ],
  },
  {
    id: "stazione-locandina-a4",
    name: "Locandina servizio A4 (Stazione)",
    description: "Locandina stampabile 300dpi per avvisi officina/stazione",
    brandSlugs: ["stazione", "officina"],
    format: "a4-portrait",
    fields: [
      { key: "kicker", label: "Occhiello (es. Avviso officina)", required: false, maxLength: 40 },
      { key: "title", label: "Cosa comunicare", required: true, maxLength: 60 },
      { key: "cta", label: "Call to action (es. Prenota adesso)", required: false, maxLength: 40 },
      { key: "details", label: "Dettagli / scadenza", required: false, maxLength: 150 },
    ],
  },
];

const RENDERERS: Record<string, TemplateRenderer> = {
  "lenny-restaurant-of-week": lennyRestaurantOfWeek,
  "lenny-promo-announce": lennyPromoAnnounce,
  "lenny-service-notice": serviceNotice,
  "lenny-rider-recruitment": lennyRiderRecruitment,
  "stazione-service-highlight": stazioneServiceHighlight,
  "stazione-service-notice": serviceNotice,
  "stazione-seasonal-tip": stazioneSeasonalTip,
  "stazione-staff-portrait": stazioneStaffPortrait,
  "lenny-locandina-a4": lennyLocandinaA4,
  "stazione-locandina-a4": stazioneLocandinaA4,
};

export function getTemplateDefinition(id: string): TemplateDefinition | undefined {
  return TEMPLATE_DEFINITIONS.find((t) => t.id === id);
}

export function renderTemplateJsx(id: string, input: TemplateRenderInput): ReactNode {
  const renderer = RENDERERS[id];
  if (!renderer) throw new Error(`Template "${id}" non trovato`);
  return renderer(input);
}

export function listTemplatesForBrand(brandSlug: string): TemplateDefinition[] {
  return TEMPLATE_DEFINITIONS.filter(
    (t) => t.brandSlugs.length === 0 || t.brandSlugs.includes(brandSlug),
  );
}
