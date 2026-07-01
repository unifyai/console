/**
 * Real API action implementations for Orchestra API tests.
 *
 * These actions make actual HTTP calls to the Orchestra API through
 * the Next.js API routes. Used with { meta: { mock: false } } tests.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/** Default timeout for API requests (staging backend can be slow) */
export const API_TIMEOUT_MS = 90000;

/** Default timeout for individual tests */
export const TEST_TIMEOUT_MS = 30000;

/** Extended timeout for slower operations like import/export */
export const TEST_TIMEOUT_EXTENDED_MS = 45000;

/** Common test options for real API tests */
export const realTestOptions = {
  meta: { mock: false },
  timeout: TEST_TIMEOUT_MS,
} as const;

/** Extended test options for slower operations */
export const realTestOptionsExtended = {
  meta: { mock: false },
  timeout: TEST_TIMEOUT_EXTENDED_MS,
} as const;

/**
 * Get the test API key from environment
 */
export function getTestApiKey(): string {
  const apiKey = process.env.VITE_TEST_API_KEY;
  if (!apiKey) {
    throw new Error(
      process.env.CI === 'true'
        ? 'VITE_TEST_API_KEY is not set — ci-test-setup.sh must provision a local Orchestra key'
        : 'VITE_TEST_API_KEY is not set in .env.test'
    );
  }
  return apiKey;
}

/**
 * Check if the dev server is reachable.
 * Used by @real tests to skip gracefully if server isn't running.
 */
export async function isServerReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(BASE_URL, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok || response.status === 307; // 307 is redirect to login
  } catch {
    return false;
  }
}

/**
 * Skip test if server is not reachable.
 * Call this in beforeAll() of @real tests.
 */
export async function skipIfServerNotReachable(): Promise<void> {
  const reachable = await isServerReachable();
  if (!reachable) {
    throw new Error(
      `Server at ${BASE_URL} is not reachable. ` +
        'Start the dev server with `npm run dev` before running @real tests.'
    );
  }
}

/**
 * API error with status code and response body
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
    message?: string
  ) {
    super(message || `API error ${status}: ${JSON.stringify(body)}`);
    this.name = 'ApiError';
  }

  /** Check if this is a "not found" error */
  isNotFound(): boolean {
    return this.status === 404;
  }

  /** Check if this is a "conflict/duplicate" error */
  isConflict(): boolean {
    return this.status === 409 || this.status === 400;
  }
}

/**
 * Timeout error for when requests take too long
 */
export class TimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Helper to make authenticated fetch requests
 */
async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = getTestApiKey();
  const url = `${BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apiKey: apiKey,
        ...options.headers,
      },
    });
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new TimeoutError(url, API_TIMEOUT_MS);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Safely parse JSON, returning a descriptive error if parsing fails
 */
function safeJsonParse(text: string, url: string): Record<string, unknown> {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Invalid JSON response from ${url}. ` + `Response started with: ${text.slice(0, 100)}...`
    );
  }
}

/**
 * Parse response with proper error handling
 */
async function parseResponse<T>(res: Response, url: string = 'unknown'): Promise<T> {
  const text = await res.text();
  const body = safeJsonParse(text, url);

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

/**
 * Parse response that may be empty (for DELETE operations)
 */
async function parseOptionalResponse(
  res: Response,
  url: string = 'unknown'
): Promise<{ success: boolean } & Record<string, unknown>> {
  const text = await res.text();
  if (!text) return { success: true };

  const body = safeJsonParse(text, url);
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return { success: true, ...body };
}

// ============================================
// Response Types
// ============================================

export interface ProjectsListResponse {
  projects: string[];
}

export interface CreateResponse {
  info?: string;
  detail?: string;
}

export interface InterfaceData {
  id: string;
  name: string;
  projectId?: string;
  color?: string;
}

export interface InterfaceListResponse {
  interfaces: InterfaceData[];
}

export interface TabData {
  id: string;
  name: string;
  interfaceId?: string;
  order?: number;
  color?: string;
}

export interface TilePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TileData {
  id: string;
  name: string;
  tabId?: string;
  type?: string;
  position?: TilePosition;
  visible?: boolean;
}

export interface LogsResponse {
  logs?: Array<Record<string, unknown>>;
  total_count?: number;
}

export interface LogsCreateResponse {
  info?: string;
  ids?: number[];
  [key: string]: unknown;
}

export interface ContextData {
  name: string;
  description?: string;
}

export interface TemplateExportResponse {
  template: Record<string, unknown>;
}

export interface TemplateImportResponse {
  interfaceId?: string;
  tabId?: string;
  tileId?: string;
}

export interface CheckpointResponse {
  checkpoint_id?: string;
  description?: string;
}

export interface DeleteResponse {
  success: boolean;
}

// ============================================
// Projects API Actions
// ============================================

export const projectsApi = {
  async list(): Promise<string[]> {
    const endpoint = '/api/projects';
    const res = await apiFetch(endpoint);
    // Orchestra returns array directly, not { projects: [...] }
    return parseResponse<string[]>(res, endpoint);
  },

  async create(name: string): Promise<CreateResponse> {
    const endpoint = `/api/projects/${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint, { method: 'POST' });
    return parseResponse<CreateResponse>(res, endpoint);
  },

  async update(name: string, data: { icon?: string; name?: string }): Promise<{ info?: string }> {
    // Use /api/projects/[name] route which accepts apiKey header
    const endpoint = `/api/projects/${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return parseResponse(res, endpoint);
  },

  async delete(name: string): Promise<DeleteResponse> {
    const endpoint = `/api/projects/${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' });
    return parseOptionalResponse(res, endpoint);
  },

  async exportTemplate(name: string): Promise<TemplateExportResponse> {
    const endpoint = `/api/projects/${encodeURIComponent(name)}?export_template=true`;
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ projectName: name }),
    });
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Interfaces API Actions
// ============================================

export const interfacesApi = {
  async list(project: string): Promise<InterfaceData[]> {
    const endpoint = `/api/interface?projectName=${encodeURIComponent(project)}`;
    const res = await apiFetch(endpoint);
    // Orchestra returns array directly
    return parseResponse(res, endpoint);
  },

  async getById(interfaceId: string): Promise<InterfaceData> {
    const endpoint = `/api/interface?interfaceId=${encodeURIComponent(interfaceId)}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async getByName(project: string, name: string): Promise<InterfaceData> {
    const endpoint = `/api/interface?projectName=${encodeURIComponent(project)}&name=${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async create(project: string, name: string, color?: string): Promise<InterfaceData> {
    const endpoint = '/api/interface';
    const res = await apiFetch(endpoint, {
      method: 'POST',
      // Orchestra expects 'projectName' not 'projectId'
      body: JSON.stringify({ projectName: project, name, color }),
    });
    return parseResponse(res, endpoint);
  },

  async updateById(interfaceId: string, data: Partial<InterfaceData>): Promise<InterfaceData> {
    const endpoint = `/api/interface?interfaceId=${encodeURIComponent(interfaceId)}`;
    const res = await apiFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return parseResponse(res, endpoint);
  },

  async updateByName(
    project: string,
    name: string,
    data: Partial<InterfaceData>
  ): Promise<InterfaceData> {
    const endpoint = `/api/interface?projectName=${encodeURIComponent(project)}&name=${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return parseResponse(res, endpoint);
  },

  async deleteById(interfaceId: string): Promise<DeleteResponse> {
    const endpoint = `/api/interface?interfaceId=${encodeURIComponent(interfaceId)}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' });
    return parseOptionalResponse(res, endpoint);
  },

  async deleteByName(project: string, name: string): Promise<DeleteResponse> {
    const endpoint = `/api/interface?projectName=${encodeURIComponent(project)}&name=${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' });
    return parseOptionalResponse(res, endpoint);
  },

  async createCheckpoint(interfaceId: string, description: string): Promise<CheckpointResponse> {
    const endpoint = `/api/interface/checkpoint?interfaceId=${encodeURIComponent(interfaceId)}`;
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
    return parseResponse(res, endpoint);
  },

  async getCheckpoint(interfaceId: string): Promise<CheckpointResponse> {
    const endpoint = `/api/interface/checkpoint?interfaceId=${encodeURIComponent(interfaceId)}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async exportTemplate(interfaceId: string): Promise<TemplateExportResponse> {
    const endpoint = '/api/interface?export_template=true';
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ interfaceId: interfaceId }),
    });
    return parseResponse(res, endpoint);
  },

  async importTemplate(
    project: string,
    template: Record<string, unknown>,
    newName: string
  ): Promise<TemplateImportResponse> {
    const endpoint = '/api/interface?import_template=true';
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ projectName: project, template, newInterfaceName: newName }),
    });
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Tabs API Actions
// ============================================

export const tabsApi = {
  async list(interfaceId: string): Promise<TabData[]> {
    const endpoint = `/api/tab?interfaceId=${encodeURIComponent(interfaceId)}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async getById(tabId: string): Promise<TabData> {
    const endpoint = `/api/tab?tabId=${encodeURIComponent(tabId)}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async getByName(interfaceId: string, name: string): Promise<TabData> {
    const endpoint = `/api/tab?interfaceId=${encodeURIComponent(interfaceId)}&name=${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async create(interfaceId: string, name: string, data: Partial<TabData> = {}): Promise<TabData> {
    const endpoint = '/api/tab';
    const res = await apiFetch(endpoint, {
      method: 'POST',
      // Orchestra expects 'interfaceId' for tab creation
      body: JSON.stringify({ interfaceId: interfaceId, name, ...data }),
    });
    return parseResponse(res, endpoint);
  },

  async updateById(tabId: string, data: Partial<TabData>): Promise<TabData> {
    const endpoint = `/api/tab?tabId=${encodeURIComponent(tabId)}`;
    const res = await apiFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return parseResponse(res, endpoint);
  },

  async updateByName(interfaceId: string, name: string, data: Partial<TabData>): Promise<TabData> {
    const endpoint = `/api/tab?interfaceId=${encodeURIComponent(interfaceId)}&name=${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return parseResponse(res, endpoint);
  },

  async patchById(tabId: string, data: Partial<TabData>): Promise<TabData> {
    const endpoint = `/api/tab?tabId=${encodeURIComponent(tabId)}`;
    const res = await apiFetch(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return parseResponse(res, endpoint);
  },

  async deleteById(tabId: string): Promise<DeleteResponse> {
    const endpoint = `/api/tab?tabId=${encodeURIComponent(tabId)}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' });
    return parseOptionalResponse(res, endpoint);
  },

  async deleteByName(interfaceId: string, name: string): Promise<DeleteResponse> {
    const endpoint = `/api/tab?interfaceId=${encodeURIComponent(interfaceId)}&name=${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' });
    return parseOptionalResponse(res, endpoint);
  },

  async exportTemplate(tabId: string): Promise<TemplateExportResponse> {
    const endpoint = '/api/tab?export_template=true';
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ tabId: tabId }),
    });
    return parseResponse(res, endpoint);
  },

  async importTemplate(
    project: string,
    interfaceId: string,
    template: Record<string, unknown>,
    newName: string
  ): Promise<TemplateImportResponse> {
    const endpoint = '/api/tab?import_template=true';
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        projectName: project,
        interfaceId: interfaceId,
        template,
        newTabName: newName,
      }),
    });
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Tiles API Actions
// ============================================

export const tilesApi = {
  async list(tabId: string, type?: string): Promise<TileData[]> {
    let endpoint = `/api/tile?tabId=${encodeURIComponent(tabId)}`;
    if (type) {
      endpoint += `&type=${encodeURIComponent(type)}`;
    }
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async getById(tileId: string): Promise<TileData> {
    const endpoint = `/api/tile?tileId=${encodeURIComponent(tileId)}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async getByName(tabId: string, name: string): Promise<TileData> {
    const endpoint = `/api/tile?tabId=${encodeURIComponent(tabId)}&name=${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async create(
    tabId: string,
    name: string,
    position: TilePosition,
    data: Partial<TileData> = {}
  ): Promise<TileData> {
    const endpoint = '/api/tile';
    const res = await apiFetch(endpoint, {
      method: 'POST',
      // Orchestra expects 'tabId' for tile creation
      body: JSON.stringify({ tabId: tabId, name, position, ...data }),
    });
    return parseResponse(res, endpoint);
  },

  async updateById(tileId: string, data: Partial<TileData>): Promise<TileData> {
    const endpoint = `/api/tile?tileId=${encodeURIComponent(tileId)}`;
    const res = await apiFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return parseResponse(res, endpoint);
  },

  async updateByName(tabId: string, name: string, data: Partial<TileData>): Promise<TileData> {
    const endpoint = `/api/tile?tabId=${encodeURIComponent(tabId)}&name=${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return parseResponse(res, endpoint);
  },

  async patchById(tileId: string, data: Partial<TileData>): Promise<TileData> {
    const endpoint = `/api/tile?tileId=${encodeURIComponent(tileId)}`;
    const res = await apiFetch(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return parseResponse(res, endpoint);
  },

  async patchSpecialized(
    tileId: string,
    tileType: string,
    data: Record<string, unknown>
  ): Promise<TileData> {
    const endpoint = `/api/tile?tileId=${encodeURIComponent(tileId)}&tile_type=${encodeURIComponent(tileType)}`;
    const res = await apiFetch(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return parseResponse(res, endpoint);
  },

  async deleteById(tileId: string): Promise<DeleteResponse> {
    const endpoint = `/api/tile?tileId=${encodeURIComponent(tileId)}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' });
    return parseOptionalResponse(res, endpoint);
  },

  async deleteByName(tabId: string, name: string): Promise<DeleteResponse> {
    const endpoint = `/api/tile?tabId=${encodeURIComponent(tabId)}&name=${encodeURIComponent(name)}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' });
    return parseOptionalResponse(res, endpoint);
  },

  async exportTemplate(tileId: string): Promise<TemplateExportResponse> {
    const endpoint = '/api/tile?export_template=true';
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ tileId: tileId }),
    });
    return parseResponse(res, endpoint);
  },

  async importTemplate(
    project: string,
    tabId: string,
    template: Record<string, unknown>,
    newName: string
  ): Promise<TemplateImportResponse> {
    const endpoint = '/api/tile?import_template=true';
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        projectName: project,
        tabId: tabId,
        template,
        newTileName: newName,
      }),
    });
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Logs API Actions
// ============================================

export const logsApi = {
  async get(
    project: string,
    options: {
      context?: string;
      filter?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<LogsResponse> {
    const params = new URLSearchParams({ projectName: project });
    if (options.context) params.set('context', options.context);
    if (options.filter) params.set('filter_expression', options.filter);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));

    const endpoint = `/api/logs?${params.toString()}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async getLatestTimestamp(project: string, context?: string): Promise<{ timestamp?: string }> {
    const params = new URLSearchParams({ projectName: project });
    if (context) params.set('context', context);

    const endpoint = `/api/logs/latest_timestamp?${params.toString()}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async getMetrics(
    project: string,
    metricName: string,
    keyName: string,
    options: {
      context?: string;
      filter?: string;
    } = {}
  ): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({ projectName: project, key: keyName });
    if (options.context) params.set('context', options.context);
    if (options.filter) params.set('filter_expression', options.filter);

    // Route is /api/logs/[metricName] which proxies to /logs/metric/[metricName]
    const endpoint = `/api/logs/${encodeURIComponent(metricName)}?${params.toString()}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async create(
    project: string,
    params: Record<string, unknown>[],
    entries: Record<string, unknown>[]
  ): Promise<LogsCreateResponse> {
    const endpoint = '/api/logs';
    const res = await apiFetch(endpoint, {
      method: 'POST',
      // Match the format expected by Orchestra
      body: JSON.stringify({ projectName: project, params, entries }),
    });
    return parseResponse(res, endpoint);
  },

  async update(
    project: string,
    context: string | null,
    logs: number[],
    entries: Record<string, unknown>,
    params: Record<string, unknown>,
    overwrite: boolean = true
  ): Promise<{ updated?: number }> {
    const endpoint = '/api/logs';
    const res = await apiFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ projectName: project, context, logs, entries, params, overwrite }),
    });
    return parseResponse(res, endpoint);
  },

  async delete(project: string, context: string | null, ids: number[]): Promise<DeleteResponse> {
    const endpoint = '/api/logs';
    const res = await apiFetch(endpoint, {
      method: 'DELETE',
      // Orchestra expects idsAndFields as a list of [id, field] tuples or just ids
      body: JSON.stringify({
        projectName: project,
        context,
        idsAndFields: ids.map((id) => [id, null]),
      }),
    });
    return parseResponse(res, endpoint);
  },

  async getFields(
    project: string,
    context?: string
  ): Promise<Record<string, { dataType: string; fieldType: string; [key: string]: unknown }>> {
    const params = new URLSearchParams({ projectName: project });
    if (context) params.set('context', context);

    const endpoint = `/api/logs/fields?${params.toString()}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Contexts API Actions
// ============================================

export const contextsApi = {
  async list(project: string): Promise<ContextData[]> {
    const endpoint = `/api/context/${encodeURIComponent(project)}`;
    const res = await apiFetch(endpoint);
    return parseResponse(res, endpoint);
  },

  async create(project: string, name: string, description?: string): Promise<{ info?: string }> {
    const endpoint = `/api/context/${encodeURIComponent(project)}`;
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
    return parseResponse(res, endpoint);
  },

  async delete(project: string, context: string): Promise<DeleteResponse> {
    const endpoint = `/api/context/${encodeURIComponent(project)}`;
    const res = await apiFetch(endpoint, {
      method: 'DELETE',
      body: JSON.stringify({ context }),
    });
    return parseOptionalResponse(res, endpoint);
  },
};

// ============================================
// Endpoints API Actions (calls Orchestra directly)
// ============================================

const ORCHESTRA_URL =
  process.env.ORCHESTRA_URL ||
  (process.env.CI === 'true' ? 'http://127.0.0.1:8000' : 'https://api.unify.ai');

/**
 * Helper to make authenticated fetch requests directly to Orchestra
 */
async function orchestraFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = getTestApiKey();
  const url = `${ORCHESTRA_URL}/v0${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...options.headers,
      },
    });
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new TimeoutError(url, API_TIMEOUT_MS);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// Test Helpers
// ============================================

/**
 * Generate a unique name for test resources
 */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Cleanup helper - attempts to delete a resource, logging failures
 */
export async function safeDelete(
  deleteFn: () => Promise<unknown>,
  resourceDescription?: string
): Promise<void> {
  try {
    await deleteFn();
  } catch (e) {
    // Log cleanup failures for debugging but don't fail the test
    if (process.env.DEBUG_CLEANUP) {
      console.warn(
        `Cleanup failed${resourceDescription ? ` for ${resourceDescription}` : ''}:`,
        e instanceof Error ? e.message : e
      );
    }
  }
}
