// M12 — Uso quotidiano. Interfaccia pubblica (RS-1).
// Tutto ciò che non è esportato qui è privato: non importarlo da fuori.

export { getDashboardStats } from "./internal/dashboard-stats";
export type { DashboardStats, Environment } from "./internal/dashboard-stats";

// RF-12.1 Task list dashboard (segnali sistema auto-generati)
export { buildDashboardTasks } from "./internal/task-aggregator";
export type { DashboardTaskList, TaskListItem, TaskPriority } from "./internal/task-aggregator";

// RF-12.1 Operational tasks (manuali, assegnabili tra utenti)
export { listTasks, listOrgUsers } from "./internal/tasks-repo";
export type {
  OperationalTask,
  OperationalTaskPriority,
  OperationalTaskStatus,
  ListTasksInput,
} from "./internal/tasks-repo";
export {
  createTaskAction,
  completeTaskAction,
  reopenTaskAction,
  cancelTaskAction,
  updateTaskAction,
} from "./internal/tasks-actions";
export type { CreateTaskActionInput, UpdateTaskActionInput } from "./internal/tasks-actions";
