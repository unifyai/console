import { CustomResponseProps, ResponseProps } from "../common";
import { LogItemProps, LogsResponseProps } from "../evals/logs";

export type TaskStatus = "Queued" | "Recurring" | "In Progress" | "Completed" | "Review" | string;

export interface Task {
  taskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedAssistantIds: string[];
}

export interface TaskActions {
  get: (filterExpression: string | null, limit: number | null, offset: number | null) => Promise<LogsResponseProps>;
  update: (ids: number[], entries: LogItemProps) => Promise<ResponseProps | CustomResponseProps>;
}