// M01 Data Hub Blocco 2 — types catalogo + ordini + storico prezzi.
// Prezzi/costi in centesimi (int) per evitare floating-point drift.

export type ProductUnit = "pezzo" | "litro" | "kg" | "ora" | "servizio";
export type ProductSource = "manuale" | "gestionale" | "import";

export type OrderChannel =
  "delivery" | "pickup" | "store" | "officina" | "carburante" | "online" | "altro";
export type OrderStatus = "pending" | "completed" | "cancelled" | "refunded";

export type BrandProduct = {
  id: string;
  organizationId: string;
  brandId: string;
  sku: string;
  name: string;
  category: string;
  unit: ProductUnit;
  priceCurrentCents: number | null;
  costCurrentCents: number | null;
  minMarginPct: number | null;
  source: ProductSource;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductPriceSnapshot = {
  id: string;
  organizationId: string;
  productId: string;
  priceCents: number;
  costCents: number | null;
  validFrom: string;
  validTo: string | null;
  note: string | null;
  changedBy: string | null;
  createdAt: string;
};

export type BrandOrder = {
  id: string;
  organizationId: string;
  brandId: string;
  contactId: string | null;
  externalRef: string | null;
  channel: OrderChannel;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  placedAt: string;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderLine = {
  id: string;
  orderId: string;
  productId: string | null;
  nameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  createdAt: string;
};

// UI labels
export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  pezzo: "Pezzo",
  litro: "Litro",
  kg: "Kg",
  ora: "Ora",
  servizio: "Servizio",
};

export const PRODUCT_SOURCE_LABELS: Record<ProductSource, string> = {
  manuale: "Inserimento manuale",
  gestionale: "Gestionale aziendale",
  import: "Import massivo",
};

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  delivery: "Consegna a domicilio",
  pickup: "Ritiro in sede",
  store: "Cassa/negozio",
  officina: "Officina",
  carburante: "Colonnina carburante",
  online: "Online",
  altro: "Altro",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "In attesa",
  completed: "Completato",
  cancelled: "Annullato",
  refunded: "Rimborsato",
};

// Formatter centesimi → stringa EUR
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
