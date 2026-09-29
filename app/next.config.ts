import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Modulo nativo (N-API): turbopack non lo bundle. Va risolto a runtime da Node.
  // Usato da m04-media/internal/templates/renderer.ts (satori + resvg → PNG).
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
