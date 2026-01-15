/**
 * Typed Orchestra API client using OpenAPI code generation.
 *
 * This client provides:
 * - Full TypeScript type safety from Orchestra's OpenAPI spec
 * - Automatic casing transformation (snake_case ↔ camelCase)
 * - Centralized auth handling
 * - Consistent error handling
 * - Optional API call logging (enable with LOG_API_CALLS=true)
 *
 * Usage:
 *   import { createOrchestraClient } from '@/lib/orchestra/client';
 *
 *   const client = createOrchestraClient(apiKey);
 *   const { data, error } = await client.GET('/v0/projects');
 *   // data is fully typed based on Orchestra's OpenAPI schema
 */

import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';
import fs from 'fs';
import path from 'path';

/**
 * Check if API logging is enabled via environment variable.
 * Set LOG_API_CALLS=true to enable logging of all Orchestra API calls.
 * Set LOG_API_CALLS=verbose to also include stack traces showing call origin.
 * Logging is disabled in production by default. Set LOG_API_CALLS_PRODUCTION=true to enable.
 */
const isLoggingEnabled = () => {
  const enabled = process.env.LOG_API_CALLS === 'true' || process.env.LOG_API_CALLS === 'verbose';
  const isProduction = process.env.NODE_ENV === 'production';
  const productionOverride = process.env.LOG_API_CALLS_PRODUCTION === 'true';

  return enabled && (!isProduction || productionOverride);
};
const isVerboseLogging = () => process.env.LOG_API_CALLS === 'verbose';

/**
 * Log file path for API call logging.
 * Defaults to 'api-calls.log' in the project root.
 * Can be customized via LOG_API_CALLS_FILE environment variable.
 */
const getLogFilePath = () => {
  const customPath = process.env.LOG_API_CALLS_FILE;
  if (customPath) return customPath;
  return path.join(process.cwd(), 'api-calls.log');
};

/**
 * Write a log entry to the log file.
 * Includes timestamp for each entry.
 */
function writeLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  try {
    const timestamp = new Date().toISOString();
    const prefix = level === 'info' ? '' : `[${level.toUpperCase()}] `;
    const logLine = `[${timestamp}] ${prefix}${message}\n`;
    fs.appendFileSync(getLogFilePath(), logLine);
  } catch (err) {
    // Fallback to console if file write fails
    console.error('[ORCHESTRA] Failed to write to log file:', err);
    console.log(message);
  }
}

/**
 * Format request/response data for logging.
 * Truncates large payloads to avoid log spam.
 */
function formatForLog(data: unknown, maxLength = 10000): string {
  try {
    const json = JSON.stringify(data, null, 2);
    if (json.length > maxLength) {
      return json.slice(0, maxLength) + '... [truncated]';
    }
    return json;
  } catch {
    return '[unable to serialize]';
  }
}

/**
 * Extract a meaningful caller location from the stack trace.
 * Filters out internal middleware/library frames to show the actual origin.
 */
function getCallerLocation(): string {
  const stack = new Error().stack;
  if (!stack) return '';

  const lines = stack.split('\n');

  // Skip frames from this file, openapi-fetch internals, and node internals
  const ignoredPatterns = [
    '/orchestra/client.ts',
    '/node_modules/openapi-fetch/',
    'node:internal',
    'processTicksAndRejections',
  ];

  for (const line of lines.slice(1)) {
    // Skip ignored patterns
    if (ignoredPatterns.some((pattern) => line.includes(pattern))) {
      continue;
    }

    // Extract file path and line number
    const match = line.match(/at\s+(?:(.+?)\s+)?\(?(.*?):(\d+):(\d+)\)?/);
    if (match) {
      const [, fnName, filePath, lineNum] = match;
      // Simplify path - keep only src/ onwards or the filename
      const simplePath = filePath.includes('/src/')
        ? filePath.substring(filePath.indexOf('/src/') + 1)
        : filePath.split('/').slice(-2).join('/');

      return fnName ? `${simplePath}:${lineNum} (${fnName})` : `${simplePath}:${lineNum}`;
    }
  }

  return '';
}

/**
 * Logging middleware for Orchestra API calls.
 * Logs request method, URL, body, and response status/data.
 *
 * Enable by setting LOG_API_CALLS=true environment variable.
 * Set LOG_API_CALLS=verbose to also include caller stack traces.
 *
 * Log format:
 *   [ORCHESTRA] GET /v0/projects
 *   [ORCHESTRA] POST /v0/project/my-project { body }
 *   [ORCHESTRA] ← 200 OK (123ms) { response }
 *   [ORCHESTRA] ← 404 Not Found (45ms) { error }
 *
 * Verbose format includes caller location:
 *   [ORCHESTRA] GET /v0/projects
 *     └─ from: src/app/api/bootstrap/route.ts:42 (GET)
 */
const loggingMiddleware: Middleware = {
  async onRequest({ request }) {
    if (!isLoggingEnabled()) return request;

    const url = new URL(request.url);
    const method = request.method;
    // Show full URL for verbose mode, path only for basic mode
    const displayUrl = isVerboseLogging() ? request.url : url.pathname + url.search;

    // Capture caller location before any async operations
    const callerLocation = isVerboseLogging() ? getCallerLocation() : '';

    // Clone and read body if present
    let bodyLog = '';
    if (request.body) {
      try {
        const cloned = request.clone();
        const bodyText = await cloned.text();
        if (bodyText) {
          bodyLog = `\n  body: ${formatForLog(JSON.parse(bodyText))}`;
        }
      } catch {
        bodyLog = '\n  body: [present but unreadable]';
      }
    }

    // Store start time for duration calculation
    (request as any).__logStartTime = Date.now();
    (request as any).__logPath = displayUrl;
    (request as any).__logMethod = method;
    (request as any).__logCaller = callerLocation;

    writeLog(`[ORCHESTRA] ${method} ${displayUrl}${bodyLog}`);
    if (callerLocation) {
      writeLog(`  └─ from: ${callerLocation}`);
    }
    return request;
  },

  async onResponse({ request, response }) {
    if (!isLoggingEnabled()) return response;

    const startTime = (request as any).__logStartTime;
    const duration = startTime ? `${Date.now() - startTime}ms` : '?ms';
    const displayUrl = (request as any).__logPath || request.url;

    // Clone to read body without consuming it
    const cloned = response.clone();
    let bodyLog = '';
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await cloned.json();
        bodyLog = `\n  response: ${formatForLog(data)}`;
      }
    } catch {
      // Ignore parse errors
    }

    const statusText = response.statusText || (response.ok ? 'OK' : 'Error');
    const logLevel = response.ok ? 'info' : 'warn';
    writeLog(
      `[ORCHESTRA] ← ${response.status} ${statusText} (${duration}) ${displayUrl}${bodyLog}`,
      logLevel
    );

    return response;
  },
};

/**
 * Custom body serializer that transforms camelCase to snake_case
 * before JSON serialization.
 */
function casingBodySerializer<T>(body: T): string {
  if (body && typeof body === 'object') {
    const transformed = camelToSnakeObject(body as Record<string, unknown>);
    return JSON.stringify(transformed);
  }
  return JSON.stringify(body);
}

/**
 * Middleware to transform response bodies from snake_case to camelCase.
 * Request body transformation is handled by the bodySerializer.
 */
const responseMiddleware: Middleware = {
  async onResponse({ response }) {
    // Only transform JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return response;
    }

    try {
      const data = await response.clone().json();
      if (data && typeof data === 'object') {
        const transformed = snakeToCamelObject(data as Record<string, unknown>);
        return new Response(JSON.stringify(transformed), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
    } catch {
      // If JSON parsing fails, return original response
    }
    return response;
  },
};

/**
 * IMPORTANT: DELETE requests with body
 *
 * openapi-fetch does not reliably send bodies for DELETE requests due to
 * limitations in the Fetch API spec. If you need to send a DELETE request
 * with a body, use direct `fetch` or `loggedFetch` instead of client.DELETE().
 *
 * Example (see /api/logs/route.ts):
 *   const response = await loggedFetch(`${orchestraUrl}/v0/logs`, {
 *     method: 'DELETE',
 *     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
 *     body: JSON.stringify({ project_name: '...' }),
 *   }, 'ORCHESTRA');
 */

/**
 * Create a typed Orchestra API client for user operations.
 *
 * @param apiKey - User's API key for authentication
 * @returns Fully typed client with autocomplete for all endpoints
 *
 * @example
 * const client = createOrchestraClient(apiKey);
 *
 * // GET request - TypeScript knows the response type
 * const { data, error } = await client.GET('/v0/projects');
 *
 * // POST request - TypeScript validates the body
 * const { data } = await client.POST('/v0/project/{project}', {
 *   params: { path: { project: 'my-project' } },
 * });
 */
export function createOrchestraClient(apiKey: string) {
  const client = createClient<paths>({
    baseUrl: process.env.ORCHESTRA_URL || 'https://api.unify.ai',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    bodySerializer: casingBodySerializer,
  });

  client.use(loggingMiddleware);
  client.use(responseMiddleware);

  return client;
}

/**
 * Create a typed Orchestra API client for admin operations.
 * Uses ORCHESTRA_ADMIN_KEY for authentication.
 *
 * @returns Fully typed admin client
 */
export function createOrchestraAdminClient() {
  const adminKey = process.env.ORCHESTRA_ADMIN_KEY;
  if (!adminKey) {
    throw new Error('ORCHESTRA_ADMIN_KEY environment variable is not set');
  }

  const client = createClient<paths>({
    baseUrl: process.env.ORCHESTRA_URL || 'https://api.unify.ai',
    headers: {
      Authorization: `Bearer ${adminKey}`,
      'Content-Type': 'application/json',
    },
    bodySerializer: casingBodySerializer,
  });

  client.use(loggingMiddleware);
  client.use(responseMiddleware);

  return client;
}

/**
 * Type helper to extract response data type from a path operation.
 *
 * @example
 * type ProjectsResponse = ResponseData<'/v0/projects', 'get'>;
 */
export type ResponseData<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { responses: { 200: { content: { 'application/json': infer R } } } }
  ? R
  : never;

/**
 * Type helper to extract request body type from a path operation.
 *
 * @example
 * type CreateProjectBody = RequestBody<'/v0/project/{project}', 'post'>;
 */
export type RequestBody<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { requestBody: { content: { 'application/json': infer R } } }
  ? R
  : never;
