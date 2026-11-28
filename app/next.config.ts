import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Moduli nativi / Node.js-only / wasm: Turbopack NON li bundle, Node li
  // risolve a runtime da node_modules.
  //   @resvg/resvg-js   - m04-media renderer (satori -> PNG), nativo napi
  //   satori            - carica yoga.wasm e harfbuzz a runtime via fs
  //   harfbuzzjs        - hb.wasm caricato via WebAssembly.compileStreaming
  //                       (Vercel tracer non lo vede come dipendenza statica)
  //   twilio            - Node.js SDK m05-publishing
  //   https-proxy-agent - transitivo twilio
  //
  // Prima tentata la strada outputFileTracingIncludes: non basta perche'
  // harfbuzzjs usa __dirname + '/hb.wasm' a runtime, quindi serve che TUTTA
  // la cartella node_modules/harfbuzzjs/ sia sul disco al fianco del codice.
  // serverExternalPackages ottiene esattamente questo: external = non bundlato
  // = cartella intera presente nella deploy.
  serverExternalPackages: [
    "@resvg/resvg-js",
    "satori",
    "harfbuzzjs",
    "twilio",
    "https-proxy-agent",
  ],

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
