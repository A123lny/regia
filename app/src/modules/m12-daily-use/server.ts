// M12 Daily-Use — barrel SERVER-ONLY (RS-1 split per Turbopack bundling).
// getDashboardStats importa node:fs/promises (lettura ultimo backup su disco).
// listOrgUsers chiama admin.auth.admin.getUserById che non e' client-safe.
// Teniamo qui gli export che trascinano moduli Node-only.

export { getDashboardStats } from "./internal/dashboard-stats";
export { buildDashboardTasks } from "./internal/task-aggregator";
export { listTasks, listOrgUsers } from "./internal/tasks-repo";
