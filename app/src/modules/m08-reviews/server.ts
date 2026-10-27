// M08 Reviews — barrel SERVER-ONLY (RS-1 split per Turbopack bundling).
// Esporta funzioni specifiche per cron e server-side fetch di recensioni.

export { fetchAllBrandsReviews } from "./internal/reviews-fetcher";
export { GooglePlacesAdapter, MockGooglePlacesAdapter } from "./internal/google-places-adapter";
