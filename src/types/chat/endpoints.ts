export interface Metrics {
  quality?: number;
  ttft?: number;
  cost?: number;
  itl?: number;
  breakdown?: {
    [key: string]: number;
  };
}

export interface Endpoint extends Metrics {
  [key: string]: any;
  code: string;
  provider: string;
  modelImage?: string;
  providerImage?: string;
  index?: string;
  router?: Boolean;
  trainedRouter?: Boolean;
}
