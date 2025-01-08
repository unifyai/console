export interface Span {
  id: string;
  type?: string;                // e.g. "span", "model", "api", etc.
  parent_span_id?: string | null;
  span_name: string;
  timestamp?: string;           // ISO datetime
  offset?: number;              // time offset from parent's start (seconds or ms)
  exec_time?: number;           // duration (seconds or ms)
  code?: string;                // function/code snippet
  inputs?: any;
  outputs?: any;
  errors?: string | null;
  child_spans: Span[];
}

  