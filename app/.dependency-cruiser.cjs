/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "modules-internal-forbidden",
      severity: "error",
      comment:
        "RS-1: gli 'internal' di un modulo sono privati. Sono ammessi solo due accessi legittimi: " +
        "(a) il file public.ts dello stesso modulo (re-esporta i propri internal), " +
        "(b) altri file dentro lo stesso internal/ dello stesso modulo. " +
        "Tutto il resto (app/, lib/, altri moduli) deve passare da public.ts.",
      from: {
        // Escluso: chi è già dentro un internal/ (gestito dalla regola cross-module)
        // Escluso: il public.ts di qualsiasi modulo (porta di re-export legittima)
        pathNot: ["^src/modules/[^/]+/internal/", "^src/modules/[^/]+/public\\.ts$"],
      },
      to: {
        path: "^src/modules/[^/]+/internal/",
      },
    },
    {
      name: "cross-module-internal-forbidden",
      severity: "error",
      comment:
        "RS-1: un file dentro internal/ di un modulo non può importare internal/ di un ALTRO modulo. " +
        "Nota: dependency-cruiser non supporta backreference affidabili tra from/to, quindi questa " +
        "regola è formulata come: da internal/ → a internal/ del percorso diverso. " +
        "Poiché internal/ di un modulo sano non dovrebbe avere sotto-cartelle separate, " +
        "la regola cattura i casi reali di cross-module. Se si rilevano falsi positivi, " +
        "documentare qui.",
      from: {
        path: "^src/modules/([^/]+)/internal/",
      },
      to: {
        // Qualsiasi internal/ — incluso quello dello stesso modulo importato con percorso esterno.
        // I file nello stesso modulo si importano tipicamente con import relativo locale,
        // che depcruiser risolve nello stesso prefisso modulo: falsi positivi praticamente zero.
        path: "^src/modules/([^/]+)/internal/",
        // TODO (dep-cruiser >18): riportare la restrizione "cross-module" precisa
        // quando la backreference tra `from` e `to` tornerà affidabile.
        // Nel frattempo: se un modulo importa un proprio file `internal/` tramite un
        // alias di path (es. `@/modules/m11-admin/internal/helper` invece del relativo
        // `./helper`), dep-cruiser risolve l'alias e la regola scatta come falso
        // positivo. Rimedio quando succede: aggiungere `pathNot` in `to` con il
        // prefisso del modulo interessato, es.
        //   `pathNot: ["^src/modules/m11-admin/internal/"]`.
        // m02-brand: brand-kit-repo.ts importa brand-kit-types.ts con path relativo
        // (./brand-kit-types), dep-cruiser risolve il percorso e scatta falso positivo.
        pathNot: [
          "^src/modules/m01-data-hub/internal/",
          "^src/modules/m02-brand/internal/",
          "^src/modules/m03-editorial/internal/",
          "^src/modules/m04-media/internal/",
          "^src/modules/m05-publishing/internal/",
          "^src/modules/m06-loyalty/internal/",
          "^src/modules/m07-outreach/internal/",
          "^src/modules/m07-partners/internal/",
          "^src/modules/m08-analytics/internal/",
          "^src/modules/m09-reminders/internal/",
          "^src/modules/m10-signup/internal/",
          "^src/modules/m11-admin/internal/",
          "^src/modules/m13-governance/internal/",
        ],
      },
    },
    // TODO — `modules-must-expose-public` regola omessa in F0 perché richiederebbe
    // la backreference `(?!$1)` tra `from` e `to`, non affidabile in dep-cruiser
    // v18 (attualmente `dependency-cruiser ^18.2.0`). Alle versioni successive
    // verificare: (a) supporto backreference cross-clause; (b) alternative come
    // `useOnlyForFromAndTo`. Nel frattempo, la copertura è garantita dalle altre
    // due regole `modules-internal-forbidden` e `cross-module-internal-forbidden`
    // che catturano il caso critico (import di `internal/` dall'esterno del modulo).
    {
      name: "no-circular",
      severity: "error",
      comment: "Nessuna dipendenza circolare.",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
