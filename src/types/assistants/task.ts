import { ResponseProps } from "../common";
import { LogItemProps, LogsResponseProps } from "../interfaces/logs";

// Corresponds to unity.task_list_manager.types.priority.Priority
export enum Priority {
    low = "low",
    normal = "normal",
    high = "high",
    urgent = "urgent",
}

// Corresponds to unity.task_list_manager.types.status.Status
export enum Status {
    scheduled = "scheduled",
    queued = "queued",
    paused = "paused",
    active = "active",
    completed = "completed",
    cancelled = "cancelled",
    failed = "failed",
}

// Corresponds to unity.task_list_manager.types.schedule.Schedule
export interface Schedule {
    next_task?: number;
    prev_task?: number;
    start_time?: string; // ISO-8601 format
}

// Corresponds to unity.task_list_manager.types.repetition.Frequency
export enum Frequency {
    DAILY = "daily",
    WEEKLY = "weekly",
    MONTHLY = "monthly",
    YEARLY = "yearly",
}

// Corresponds to unity.task_list_manager.types.repetition.Weekday
export enum Weekday {
    MO = "MO",
    TU = "TU",
    WE = "WE",
    TH = "TH",
    FR = "FR",
    SA = "SA",
    SU = "SU",
}

// Corresponds to unity.task_list_manager.types.repetition.RepeatPattern
export interface RepeatPattern {
    frequency: Frequency;
    interval: number;
    weekdays?: Weekday[];
    count?: number;
    until?: string; // ISO-8601 datetime string
}

// Corresponds to unity.task_list_manager.types.task.Task
export interface Task {
  log_id: number;
  task_id: number;
  name: string;
  description: string;
  status: Status;
  schedule: Schedule;
  deadline?: string; // ISO-8601 format
  repeat?: RepeatPattern;
  priority: Priority;
  assistant_id: string;
}

export interface TaskActions {
  get: (context: string, filterExpression: string | null, limit: number | null, offset: number | null) => Promise<LogsResponseProps | ResponseProps>;
  update: (context: string, logs: number[], entries: LogItemProps) => Promise<ResponseProps>;
}