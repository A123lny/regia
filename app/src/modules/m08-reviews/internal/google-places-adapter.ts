// RS-2 Adapter Google Places read-only. Un unico concreto in F0.

export type ExternalReview = {
  externalId: string;
  authorName: string | null;
  rating: number;
  text: string | null;
  postedAt: string; // ISO
};

export interface GoogleReviewsFetcher {
  fetchReviews(placeId: string): Promise<ExternalReview[]>;
}

type GooglePlaceDetailsResponse = {
  status: string;
  error_message?: string;
  result?: {
    reviews?: Array<{
      time: number;
      rating: number;
      text?: string;
      author_name?: string;
      author_url?: string;
    }>;
  };
};

export class GooglePlacesAdapter implements GoogleReviewsFetcher {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async fetchReviews(placeId: string): Promise<ExternalReview[]> {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "reviews");
    url.searchParams.set("reviews_sort", "newest");
    url.searchParams.set("language", "it");
    url.searchParams.set("key", this.apiKey);

    const res = await this.fetchFn(url.toString(), { method: "GET" });
    if (!res.ok) {
      throw new Error(`GooglePlacesAdapter HTTP ${res.status}`);
    }
    const body = (await res.json()) as GooglePlaceDetailsResponse;
    if (body.status !== "OK") {
      throw new Error(`GooglePlacesAdapter status=${body.status} ${body.error_message ?? ""}`);
    }
    const reviews = body.result?.reviews ?? [];
    return reviews.map((r) => ({
      externalId: `${placeId}:${r.time}:${r.author_name ?? "anon"}`.slice(0, 128),
      authorName: r.author_name ?? null,
      rating: r.rating,
      text: r.text ?? null,
      postedAt: new Date(r.time * 1000).toISOString(),
    }));
  }
}

export class MockGooglePlacesAdapter implements GoogleReviewsFetcher {
  constructor(private readonly fixtures: Record<string, ExternalReview[]> = {}) {}
  async fetchReviews(placeId: string): Promise<ExternalReview[]> {
    return this.fixtures[placeId] ?? [];
  }
}
