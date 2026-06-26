import axios, { AxiosAdapter, AxiosInstance, AxiosResponse } from 'axios';
import { snakeToCamelObject, camelToSnakeObject, camelToSnake } from '@/utils/casing';
import { addAxiosLoggingInterceptors } from '@/lib/logging/fetch';
import { mockSimulationEnabled } from '@/lib/simulation/config';
import { simulationFetch } from '@/lib/simulation/dispatch';

// Admin client timeout in milliseconds.
// Using a higher value here avoids spurious auth failures when Orchestra is slow.
const ADMIN_TIMEOUT_MS = 60_000;

/**
 * Axios adapter that routes every request through the mock simulation seam
 * instead of the network. Installed only when the flag is on; off (the default)
 * the clients use the real HTTP adapter and backend.
 */
const simulationAdapter: AxiosAdapter = async (config) => {
  const base = config.baseURL ?? '';
  const path = config.url ?? '';
  let url = `${base}${path}`;

  if (config.params && typeof config.params === 'object') {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params as Record<string, unknown>)) {
      if (value !== undefined && value !== null) qs.set(key, String(value));
    }
    const query = qs.toString();
    if (query) url += (url.includes('?') ? '&' : '?') + query;
  }

  const headers: Record<string, string> = {};
  const rawHeaders = config.headers as unknown as {
    Authorization?: unknown;
    get?: (name: string) => unknown;
  };
  const authHeader = rawHeaders?.Authorization ?? rawHeaders?.get?.('Authorization');
  if (authHeader) headers.Authorization = String(authHeader);

  const method = (config.method ?? 'get').toUpperCase();
  const init: RequestInit = { method, headers };
  if (config.data !== undefined && method !== 'GET') {
    init.body = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
  }

  const res = await simulationFetch(url, init);
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Leave as text for non-JSON bodies.
  }

  return {
    data,
    status: res.status,
    statusText: res.statusText,
    headers: {},
    config,
  } as AxiosResponse;
};

const simulationAdapterOption = mockSimulationEnabled() ? { adapter: simulationAdapter } : {};

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
    ...simulationAdapterOption,
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
      ...simulationAdapterOption,
    })
  );
}
