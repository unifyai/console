import { ResponseProps } from "../common";

export interface ActivitySummary {
  summary: string;
}

export interface ActivityLogActions {
  get: (assistant_id: string) => Promise<ActivitySummary | ResponseProps>;
}