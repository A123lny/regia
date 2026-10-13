// M12 — Uso quotidiano. Interfaccia pubblica (RS-1).
// Tutto ciò che non è esportato qui è privato: non importarlo da fuori.

export { getDashboardStats } from "./internal/dashboard-stats";
export type { DashboardStats, Environment } from "./internal/dashboard-stats";

// RF-12.1 Task list dashboard
export { buildDashboardTasks } from "./internal/task-aggregator";
export type { DashboardTaskList, TaskListItem, TaskPriority } from "./internal/task-aggregator";
