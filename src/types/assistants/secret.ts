import { ResponseProps } from '../common';

export interface Secret {
  logId: number;
  name: string;
  value: string;
  description?: string;
}

export interface SecretPayload {
  name: string;
  value: string;
  description?: string;
}

export interface SecretActions {
  get: (assistantContext: string, assistantId: string) => Promise<Secret[] | ResponseProps>;
  create: (
    assistantContext: string,
    assistantId: string,
    payload: SecretPayload
  ) => Promise<ResponseProps>;
  delete: (assistantContext: string, logId: number) => Promise<ResponseProps>;
}
