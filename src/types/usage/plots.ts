export interface TokensDataProps {
  ts: string;
  totalCompletionTokens: number;
  totalPromptTokens: number;
}

export interface CallsDataProps {
  ts: string;
  requestCount: number;
}

export interface LatencyDataProps {
  ts: string;
  generationTimeP50: number;
  generationTimeP95: number;
}

export interface ThroughputDataProps {
  ts: string;
  tokensPerSecP50: number;
  tokensPerSecP95: number;
}
