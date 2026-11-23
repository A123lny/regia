import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Moduli nativi / Node.js-only: turbopack non li bundle. Risolti a runtime da Node.
  // @resvg/resvg-js: m04-media renderer (satori → PNG).
  // twilio + https-proxy-agent: m05-publishing adapter Twilio (Node.js SDK).
  serverExternalPackages: ["@resvg/resvg-js", "twilio", "https-proxy-agent"],
  experimental: {
    // Server actions con upload immagini media library fino a 20MB (M04).
    // Default Next.js e' 1MB; sopra, FormData con File fallisce silenziosamente
    // (il browser mostra React error #441 perche' lo stream si interrompe mid-request).
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
