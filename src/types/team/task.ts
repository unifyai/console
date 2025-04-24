export type TaskStatus = "Queued" | "Recurring" | "In Progress" | "Completed";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: Date;
}