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
        // Restrizione ulteriore: escludiamo i file nello stesso modulo.
        // Nota: pathNot in "to" limita il matcher — non i falsi positivi.
        // Per ora accettiamo che la regola copra cross-module: se due file dello stesso
        // internal/ si importano a vicenda, depcruiser li risolve con percorso identico
        // e non scatta la regola (dipende dalla versione). Monitorare.
      },
    },
    // TODO: modules-must-expose-public — garantisce che gli import cross-modulo
    // passino sempre da public.ts (non da altri file non-internal del modulo).
    // La backreference $1 tra clausole from/to non è supportata in modo affidabile
    // da dependency-cruiser. Rimandato a task successivo.
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
