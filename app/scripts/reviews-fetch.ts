// Trigger manuale fetch recensioni (per sviluppo locale / debug).
// Uso: ALLOW_FETCH=1 npm run reviews:fetch

import "dotenv/config";
import {
  fetchAllBrandsReviews,
  GooglePlacesAdapter,
  MockGooglePlacesAdapter,
} from "../src/modules/m08-reviews/server";
import { getAdminClient } from "../src/lib/db/admin";

async function main() {
  if (!process.env["ALLOW_FETCH"]) {
    console.error("Esegui con ALLOW_FETCH=1 per confermare la chiamata.");
    process.exit(1);
  }
  const apiKey = process.env["GOOGLE_PLACES_API_KEY"];
  const adapter = apiKey ? new GooglePlacesAdapter(apiKey) : new MockGooglePlacesAdapter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: orgs } = await admin.from("organizations").select("id");
  for (const org of (orgs ?? []) as { id: string }[]) {
    const summary = await fetchAllBrandsReviews(org.id, adapter);
    console.log(`org=${org.id}`, summary);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
