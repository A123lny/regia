import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Moduli nativi / Node.js-only: turbopack non li bundle. Risolti a runtime da Node.
  // @resvg/resvg-js: m04-media renderer (satori → PNG).
  // twilio + https-proxy-agent: m05-publishing adapter Twilio (Node.js SDK).
  serverExternalPackages: ["@resvg/resvg-js", "twilio", "https-proxy-agent"],

  // Vercel tracer non trova i .wasm che satori/harfbuzzjs caricano a runtime
  // via fs.readFileSync (non import statico). Senza questa lista il template
  // renderer esplode in produzione con "ENOENT ... harfbuzzjs/hb.wasm".
  outputFileTracingIncludes: {
    "**": [
      "./node_modules/harfbuzzjs/hb.wasm",
      "./node_modules/harfbuzzjs/hbjs.js",
      "./node_modules/satori/yoga.wasm",
    ],
  },

  experimental: {
    // Server actions con upload immagini media library fino a 20MB (M04).
    // Default Next.js e' 1MB; sopra, FormData con File fallisce silenziosamente
    // (il browser mostra React error #441 perche' lo stream si interrompe mid-request).
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },

  // Redirect permanenti (308) dalle vecchie route del refactor UI.
  // I QR gia' stampati e i link esterni (es. mail, segnaposti) continuano
  // a funzionare. Le pagine pubbliche /iscriviti/* /privacy /login / NON
  // sono toccate. Vedi docs/inventario-funzioni.md §5.
  async redirects() {
    return [
      // Dashboard -> Oggi
      { source: "/dashboard", destination: "/oggi", permanent: true },

      // Clienti (aggiunti nei commit successivi delle Fasi 1.3+)
      // {
      //   source: "/anti-abbandono",
      //   destination: "/clienti?scheda=da-recuperare",
      //   permanent: true,
      // },
      // Le rimanenti (fornitori, catalogo, ...) le aggiungeremo quando
      // gli hub /clienti, /rete, /contenuti, /impostazioni saranno pronti.
    ];
  },
};

export default nextConfig;
