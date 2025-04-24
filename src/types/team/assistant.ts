import { Task } from "./task";

export interface Assistant {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  tasks: Task[];
}