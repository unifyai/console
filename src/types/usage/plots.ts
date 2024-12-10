export interface TokensDataProps {
    ts: string;
    total_completion_tokens: number;
    total_prompt_tokens: number;
  }
  
  export interface CallsDataProps {
    ts: string;
    request_count: number;
  }
  
  export interface LatencyDataProps {
    ts: string;
    generation_time_p50: number;
    generation_time_p95: number;
  }
  
  export interface ThroughputDataProps {
    ts: string;
    tokens_per_sec_p50: number;
    tokens_per_sec_p95: number;
  }