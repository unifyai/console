import axios, { AxiosInstance, AxiosError } from 'axios';
import { snakeToCamelObject, camelToSnakeObject, camelToSnake } from '@/utils/casing';
import { addAxiosLoggingInterceptors } from '@/lib/logging/fetch';

const TIMEOUT_MS = 30_000;

/**
 * Transform URL query params object keys from camelCase to snake_case.
 */
function transformParamsToSnakeCase(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    result[camelToSnake(key)] = value;
  }
  return result;
}

/**
 * Add interceptors to transform request/response casing.
 * - Requests: camelCase → snake_case (for Communication API)
 * - Responses: snake_case → camelCase (for frontend)
 */
function addCasingInterceptors(client: AxiosInstance): AxiosInstance {
  // Transform request data and params from camelCase to snake_case
  client.interceptors.request.use((config) => {
    if (config.data && typeof config.data === 'object') {
      config.data = camelToSnakeObject(config.data);
    }
    if (config.params && typeof config.params === 'object') {
      config.params = transformParamsToSnakeCase(config.params);
    }
    return config;
  });

  // Transform response data from snake_case to camelCase
  client.interceptors.response.use((response) => {
    if (response.data && typeof response.data === 'object') {
      response.data = snakeToCamelObject(response.data);
    }
    return response;
  });

  return client;
}

/**
 * Add all interceptors (logging + casing) to a client.
 */
function addAllInterceptors(client: AxiosInstance): AxiosInstance {
  addAxiosLoggingInterceptors(client, 'COMMUNICATION');
  addCasingInterceptors(client);
  return client;
}

/**
 * Create a Communication Service client.
 * Automatically handles camelCase ↔ snake_case conversion.
 *
 * @param apiKey - Optional API key for authenticated endpoints
 *
 * @example
 * // Unauthenticated request
 * const client = createCommunicationClient();
 * const { data } = await client.post('/social/verify', { platform, accountIdentifier });
 *
 * // Authenticated request
 * const client = createCommunicationClient(userApiKey);
 * const { data } = await client.post('/social/verify', { platform, accountIdentifier });
 *
 * // Request bodies are sent as snake_case; responses are automatically
 * // converted back to camelCase.
 */
export function createCommunicationClient(apiKey?: string): AxiosInstance {
  const baseUrl =
    process.env.COMMUNICATION_URL ||
    process.env.UNIFY_COMMS_URL ||
    process.env.LOCAL_ADAPTERS_URL ||
    process.env.UNIFY_ADAPTERS_URL;
  if (!baseUrl) {
    throw new Error(
      'COMMUNICATION_URL, UNIFY_COMMS_URL, LOCAL_ADAPTERS_URL, or UNIFY_ADAPTERS_URL environment variable is not set'
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return addAllInterceptors(
    axios.create({
      baseURL: baseUrl,
      headers,
      timeout: TIMEOUT_MS,
    })
  );
}

/**
 * Type helper for Communication API errors
 */
export interface CommunicationError {
  detail?: string;
  message?: string;
}

/**
 * Extract error detail from axios error
 */
export function getCommunicationErrorDetail(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as CommunicationError | undefined;
    return data?.detail || data?.message || error.message || 'Communication service error';
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Get HTTP status code from error, defaulting to 503 for connection issues
 */
export function getCommunicationErrorStatus(error: unknown): number {
  if (error instanceof AxiosError) {
    return error.response?.status || 503;
  }
  return 503;
}
