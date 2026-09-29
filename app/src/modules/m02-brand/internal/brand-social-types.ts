// M02 Brand — Types e schema per social account config (predisposizione M14 publisher).

export type SocialPlatform =
  "facebook" | "instagram" | "google_business" | "linkedin" | "tiktok" | "x";

export type SocialFieldSchema = {
  key: string;
  label: string;
  help?: string;
  type: "text" | "password";
  required: boolean;
};

export type SocialPlatformSchema = {
  platform: SocialPlatform;
  displayName: string;
  brandColor: string;
  fields: SocialFieldSchema[];
  docsUrl?: string;
};

/**
 * Schema campi per piattaforma. Ogni campo va salvato in credentials jsonb con la sua key.
 * I "type: password" mascherano l'input in UI, ma i valori sono comunque memorizzati come stringa.
 * Non e cifratura vera: la sicurezza at-rest e delegata a Supabase (F0-b), cifratura applicativa TODO.
 */
export const SOCIAL_PLATFORMS: SocialPlatformSchema[] = [
  {
    platform: "facebook",
    displayName: "Facebook Pages",
    brandColor: "#1877F2",
    docsUrl: "https://developers.facebook.com/docs/pages/access-tokens",
    fields: [
      {
        key: "page_id",
        label: "Page ID",
        help: "ID numerico della Facebook Page (Impostazioni Pagina → Informazioni).",
        type: "text",
        required: true,
      },
      {
        key: "page_access_token",
        label: "Page Access Token",
        help: "Token long-lived (60gg). Ottenuto via Meta Graph API Explorer o Business Suite.",
        type: "password",
        required: true,
      },
      {
        key: "app_id",
        label: "Meta App ID",
        help: "ID dell'App Meta (per refresh del token). Opzionale in F1.",
        type: "text",
        required: false,
      },
    ],
  },
  {
    platform: "instagram",
    displayName: "Instagram Business",
    brandColor: "#E1306C",
    docsUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
    fields: [
      {
        key: "ig_business_account_id",
        label: "Instagram Business Account ID",
        help: "ID dell'account IG Business (collegato a una Facebook Page).",
        type: "text",
        required: true,
      },
      {
        key: "page_access_token",
        label: "Page Access Token",
        help: "Stesso token della Facebook Page collegata. Se hai gia configurato FB, copialo da li.",
        type: "password",
        required: true,
      },
    ],
  },
  {
    platform: "google_business",
    displayName: "Google Business Profile",
    brandColor: "#4285F4",
    docsUrl: "https://developers.google.com/my-business/reference/rest",
    fields: [
      {
        key: "location_id",
        label: "Location ID",
        help: "ID della location Google Business (formato: locations/1234567890).",
        type: "text",
        required: true,
      },
      {
        key: "oauth_access_token",
        label: "OAuth Access Token",
        help: "Token OAuth 2.0 con scope business.manage.",
        type: "password",
        required: true,
      },
      {
        key: "oauth_refresh_token",
        label: "OAuth Refresh Token",
        help: "Refresh token per rinnovare l'access token scaduto.",
        type: "password",
        required: true,
      },
    ],
  },
  {
    platform: "linkedin",
    displayName: "LinkedIn Company Page",
    brandColor: "#0A66C2",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
    fields: [
      {
        key: "organization_id",
        label: "Organization URN",
        help: "URN della Company Page (formato: urn:li:organization:12345).",
        type: "text",
        required: true,
      },
      {
        key: "access_token",
        label: "Access Token",
        help: "Token OAuth 2.0 (60gg validita). Scope: w_organization_social.",
        type: "password",
        required: true,
      },
      {
        key: "refresh_token",
        label: "Refresh Token",
        help: "Per rinnovare l'access token.",
        type: "password",
        required: false,
      },
    ],
  },
  {
    platform: "tiktok",
    displayName: "TikTok Business",
    brandColor: "#000000",
    docsUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started",
    fields: [
      {
        key: "open_id",
        label: "Open ID",
        help: "ID univoco dell'account TikTok Business.",
        type: "text",
        required: true,
      },
      {
        key: "access_token",
        label: "Access Token",
        help: "Token OAuth 2.0 con scope video.publish.",
        type: "password",
        required: true,
      },
      {
        key: "refresh_token",
        label: "Refresh Token",
        help: "Per rinnovare l'access token.",
        type: "password",
        required: true,
      },
    ],
  },
  {
    platform: "x",
    displayName: "X (Twitter)",
    brandColor: "#000000",
    docsUrl: "https://developer.x.com/en/docs/x-api",
    fields: [
      {
        key: "api_key",
        label: "API Key (Consumer Key)",
        help: "Consumer Key dell'App X (development portal).",
        type: "text",
        required: true,
      },
      {
        key: "api_secret",
        label: "API Secret (Consumer Secret)",
        help: "Consumer Secret dell'App X.",
        type: "password",
        required: true,
      },
      {
        key: "access_token",
        label: "Access Token",
        help: "OAuth 1.0a Access Token.",
        type: "password",
        required: true,
      },
      {
        key: "access_secret",
        label: "Access Token Secret",
        help: "OAuth 1.0a Access Token Secret.",
        type: "password",
        required: true,
      },
      {
        key: "bearer_token",
        label: "Bearer Token",
        help: "Solo per API v2 read. Opzionale se usi OAuth 1.0a per scrittura.",
        type: "password",
        required: false,
      },
    ],
  },
];

export function getSchema(platform: SocialPlatform): SocialPlatformSchema | undefined {
  return SOCIAL_PLATFORMS.find((s) => s.platform === platform);
}

export type BrandSocialAccount = {
  id: string;
  organizationId: string;
  brandId: string;
  platform: SocialPlatform;
  credentials: Record<string, string>;
  isConnected: boolean;
  updatedAt: string;
  updatedBy: string | null;
};
