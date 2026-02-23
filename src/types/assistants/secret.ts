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
  get: (assistantId: string) => Promise<Secret[] | ResponseProps>;
  create: (assistantId: string, payload: SecretPayload) => Promise<ResponseProps>;
  delete: (logId: number) => Promise<ResponseProps>;
}
