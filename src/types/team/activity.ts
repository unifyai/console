import { ResponseProps } from "../common";

export interface ActivitySummary {
  summary: string;
}

export interface ActivityLogActions {
  get: () => Promise<ActivitySummary | ResponseProps>;
}