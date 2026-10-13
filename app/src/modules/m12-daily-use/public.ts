// M12 — Uso quotidiano. Interfaccia pubblica (RS-1).
// Tutto cio che non e esportato qui e privato: non importarlo da fuori.
//
// Split barrel: le funzioni server-only (getDashboardStats con node:fs,
// buildDashboardTasks, listTasks, listOrgUsers con admin.auth) sono in
// ./server.ts, in modo che i client component che importano le server
// action da qui non trascinino node:fs/promises nel bundle browser.

// Types dashboard
export type { DashboardStats, Environment } from "./internal/dashboard-stats";

// RF-12.1 Task list dashboard types
export type { DashboardTaskList, TaskListItem, TaskPriority } from "./internal/task-aggregator";

// RF-12.1 Operational tasks types + server actions (client-safe: le action sono
// "use server" quindi bundlate come RPC stubs, non trascinano import server).
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
