import { ResponseProps } from '../common';

export interface Secret {
  logId: number;
  name: string;
  description?: string;
}

export interface SecretPayload {
  name: string;
  value: string;
  description?: string;
}

export interface SecretUpdatePayload {
  name?: string;
  value?: string;
  description?: string;
}

export interface SecretActions {
  get: (assistantId: string, ownerId: string) => Promise<Secret[] | ResponseProps>;
  create: (assistantId: string, ownerId: string, payload: SecretPayload) => Promise<ResponseProps>;
  update: (logId: number, ownerId: string, payload: SecretUpdatePayload) => Promise<ResponseProps>;
  delete: (logId: number, ownerId: string, assistantId: string) => Promise<ResponseProps>;
}
