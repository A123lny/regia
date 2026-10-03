// M01 Data Hub — interfaccia pubblica (RS-1).
// Tutto cio che non e' esportato qui e' privato: non importarlo da fuori.

// Types
export type {
  Contact,
  ContactConsent,
  ContactVehicle,
  ContactSource,
  ConsentChannel,
  ConsentStatus,
  ConsentSource,
  VehicleTireType,
} from "./internal/contacts-types";

export {
  CONTACT_SOURCE_LABELS,
  CONSENT_CHANNEL_LABELS,
  CONSENT_STATUS_LABELS,
  TIRE_TYPE_LABELS,
} from "./internal/contacts-types";

// Queries (RSC)
export { listContacts, getContact, getContactsStats } from "./internal/contacts-repo";
export type { ListContactsInput, ListContactsResult } from "./internal/contacts-repo";

export { listConsentsByContact } from "./internal/consents-repo";

export { listVehiclesByContact } from "./internal/vehicles-repo";

// Server actions
export {
  createContactAction,
  updateContactAction,
  archiveContactAction,
  restoreContactAction,
  upsertConsentAction,
  createVehicleAction,
  updateVehicleAction,
  deleteVehicleAction,
  mergeContactsAction,
  upsertSupplyPartnerAction,
} from "./internal/actions";
export type { UpsertSupplyPartnerActionInput } from "./internal/actions";

// M6a Partner spesa — RF-6.19
export {
  listSupplyPartners,
  getSupplyPartner,
  upsertSupplyPartner,
  findProductsWithoutPartnerConsent,
} from "./internal/supply-partners-repo";
export type { SupplyPartner } from "./internal/supply-partners-repo";

// RF-1.7 dedup
export { findDuplicateGroups } from "./internal/dedup-detector";
export type { DuplicateGroup, DuplicateMatchKind, ContactSummary } from "./internal/dedup-detector";
export type { MergeResult } from "./internal/merge-repo";
export type {
  CreateContactActionInput,
  UpdateContactActionInput,
  UpsertConsentActionInput,
  CreateVehicleActionInput,
  UpdateVehicleActionInput,
} from "./internal/actions";

// ---- Blocco 2: catalogo + pricing + ordini ----

// Types catalogo/ordini
export type {
  BrandProduct,
  ProductPriceSnapshot,
  BrandOrder,
  OrderLine,
  ProductUnit,
  ProductSource,
  OrderChannel,
  OrderStatus,
} from "./internal/catalog-types";

export {
  PRODUCT_UNIT_LABELS,
  PRODUCT_SOURCE_LABELS,
  ORDER_CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  formatCents,
} from "./internal/catalog-types";

// Query catalogo
export { listProducts, getProduct, listProductCategories } from "./internal/products-repo";
export type { ListProductsInput, ListProductsResult } from "./internal/products-repo";

// Storico prezzi
export { listPriceHistoryByProduct } from "./internal/product-prices-repo";

// Query ordini
export { listOrders, getOrder, listOrderLines, getOrdersStats } from "./internal/orders-repo";
export type { ListOrdersInput, ListOrdersResult, OrderRow } from "./internal/orders-repo";

// Server actions catalog + pricing
export {
  createProductAction,
  updateProductAction,
  archiveProductAction,
  restoreProductAction,
  recordPriceChangeAction,
  updateMarginAction,
} from "./internal/catalog-actions";
export type {
  CreateProductActionInput,
  UpdateProductActionInput,
  RecordPriceChangeActionInput,
  UpdateMarginActionInput,
} from "./internal/catalog-actions";

// RF-1.9 Richieste dati personali
export { buildContactDossier, listDataRequests } from "./internal/data-dossier-repo";
export type {
  ContactDossier,
  ContactDataRequest,
  ContactDataRequestRow,
  DataRequestType,
  DataRequestStatus,
} from "./internal/data-dossier-repo";
export {
  getContactDossierAction,
  listDataRequestsAction,
  createContactDataRequestAction,
  fulfillContactDataRequestAction,
} from "./internal/actions";
