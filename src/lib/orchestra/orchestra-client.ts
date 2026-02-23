import axios, { AxiosInstance } from 'axios';
import { snakeToCamelObject, camelToSnakeObject, camelToSnake } from '@/utils/casing';
import { addAxiosLoggingInterceptors } from '@/lib/logging/fetch';

// Admin client timeout in milliseconds.
// Using a higher value here avoids spurious auth failures when Orchestra is slow.
const ADMIN_TIMEOUT_MS = 60_000;

/**
 * Transform URL query params object keys from camelCase to snake_case.
 * Only transforms top-level keys, values are left as-is (they may be JSON strings).
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
 * - Requests: camelCase → snake_case (for Orchestra API)
 *   - Transforms request body (config.data)
 *   - Transforms query params (config.params)
 * - Responses: snake_case → camelCase (for frontend)
 */
function addCasingInterceptors(client: AxiosInstance): AxiosInstance {
  // Transform request data and params from camelCase to snake_case
  client.interceptors.request.use((config) => {
    // Transform request body
    if (config.data && typeof config.data === 'object') {
      config.data = camelToSnakeObject(config.data);
    }
    // Transform query params keys
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
 * Logging runs first (before casing transformation) to show raw API data.
 */
function addAllInterceptors(client: AxiosInstance): AxiosInstance {
  addAxiosLoggingInterceptors(client, 'ORCHESTRA:AXIOS');
  addCasingInterceptors(client);
  return client;
}

export const OrchestraAdminClient = addAllInterceptors(
  axios.create({
    baseURL: process.env.ORCHESTRA_URL + '/v0/admin',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ORCHESTRA_ADMIN_KEY}`,
    },
    // Prevent long hangs that block SSR; fail fast and allow graceful fallbacks
    timeout: ADMIN_TIMEOUT_MS,
  })
);

export async function getOrchestraUserClient(userAPIKey: string) {
  return addAllInterceptors(
    axios.create({
      baseURL: process.env.ORCHESTRA_URL + '/v0',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAPIKey}`,
      },
    })
  );
}
