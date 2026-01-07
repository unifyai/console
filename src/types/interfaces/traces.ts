export interface Span {
  id: string;
  type?: string;                // e.g. "span", "model", "api", etc.
  parentSpanId?: string | null;
  spanName: string;
  timestamp?: string;           // ISO datetime
  offset?: number;              // time offset from parent's start (seconds or ms)
  execTime?: number;            // duration (seconds or ms)
  code?: string;                // function/code snippet
  inputs?: any;
  outputs?: any;
  errors?: string | null;
  childSpans: Span[];
  [key: string]: any;
}
