import { ResponseProps } from "../common";
import { LogItemProps, LogsResponseProps } from "../evals/logs";

export interface Task {
  id: string;
  title: string;
  description: string | undefined;
  status: string | undefined;
  assignedAssistantIds: string[];
}

export interface TaskActions {
  get: (filterExpression: string | null, limit: number | null, offset: number | null) => Promise<LogsResponseProps | ResponseProps>;
  update: (ids: number[], entries: LogItemProps) => Promise<ResponseProps>;
}