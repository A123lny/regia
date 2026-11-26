// M04 Media — barrel SERVER-ONLY (RS-1 split).
// Qui vivono le funzioni che trascinano moduli nativi (resvg, harfbuzz) e
// non devono mai finire nel bundle client. Route handler e server actions
// importano da qui.

import "server-only";

export { renderTemplateToPng } from "./internal/templates/renderer";
export { getTemplateDefinition } from "./internal/templates/template-registry";
