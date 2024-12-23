export interface Span {
    id: string;
    parent_span_id?: string | null;
    span_name: string;
    offset?: number;       // seconds or ms from the start of its parent
    exec_time?: number;    // duration in seconds or ms
    inputs?: any;
    outputs?: any;
    errors?: string | null;
    child_spans: Span[];
  }

  