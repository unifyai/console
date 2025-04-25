// src/types/team/task.ts
export type TaskStatus = "Queued" | "Recurring" | "In Progress" | "Completed" | "Review"; // Added Review

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedAssistantIds: string[];
  dueDate: Date | null;
}