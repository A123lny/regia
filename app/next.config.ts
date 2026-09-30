import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Moduli nativi / Node.js-only: turbopack non li bundle. Risolti a runtime da Node.
  // @resvg/resvg-js: m04-media renderer (satori → PNG).
  // twilio + https-proxy-agent: m05-publishing adapter Twilio (Node.js SDK).
  serverExternalPackages: ["@resvg/resvg-js", "twilio", "https-proxy-agent"],
};

export default nextConfig;
