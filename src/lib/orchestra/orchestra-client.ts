import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';
import fs from 'fs';
import path from 'path';

// Admin client timeout in milliseconds.
// Using a higher value here avoids spurious auth failures when Orchestra is slow.
const ADMIN_TIMEOUT_MS = 60_000;

/**
 * Check if API logging is enabled via environment variable.
 * Set LOG_API_CALLS=true to enable logging of all Orchestra API calls.
 * Set LOG_API_CALLS=verbose to also include stack traces showing call origin.
 */
const isLoggingEnabled = () =>
  process.env.LOG_API_CALLS === 'true' || process.env.LOG_API_CALLS === 'verbose';
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
    console.error('[ORCHESTRA:AXIOS] Failed to write to log file:', err);
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

  // Skip frames from this file, axios internals, and node internals
  const ignoredPatterns = [
    '/orchestra/orchestra-client.ts',
    '/node_modules/axios/',
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
 * Add logging interceptors to track API calls.
 * Enable by setting LOG_API_CALLS=true environment variable.
 * Set LOG_API_CALLS=verbose to also include caller stack traces.
 *
 * Log format:
 *   [ORCHESTRA:AXIOS] GET /v0/projects
 *   [ORCHESTRA:AXIOS] POST /v0/project/my-project { body }
 *   [ORCHESTRA:AXIOS] ← 200 OK (123ms) { response }
 *   [ORCHESTRA:AXIOS] ← 404 Not Found (45ms) { error }
 *
 * Verbose format includes caller location:
 *   [ORCHESTRA:AXIOS] GET /v0/projects
 *     └─ from: src/lib/orchestra/api/organization.ts:123 (getOrganization)
 */
function addLoggingInterceptors(client: AxiosInstance): AxiosInstance {
  // Request logging
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (!isLoggingEnabled()) return config;

    const method = config.method?.toUpperCase() || 'UNKNOWN';
    const url = config.url || '';
    const baseURL = config.baseURL || '';
    const fullPath = url.startsWith('http') ? url : `${baseURL}${url}`;

    // Include query params if present
    const queryString = config.params ? '?' + new URLSearchParams(config.params).toString() : '';
    const displayUrl = fullPath + queryString;

    // Capture caller location
    const callerLocation = isVerboseLogging() ? getCallerLocation() : '';

    let bodyLog = '';
    if (config.data) {
      bodyLog = `\n  body: ${formatForLog(config.data)}`;
    }

    // Store start time and caller for duration calculation
    (config as any).__logStartTime = Date.now();
    (config as any).__logCaller = callerLocation;
    (config as any).__logDisplayUrl = displayUrl;

    writeLog(`[ORCHESTRA:AXIOS] ${method} ${displayUrl}${bodyLog}`);
    if (callerLocation) {
      writeLog(`  └─ from: ${callerLocation}`);
    }
    return config;
  });

  // Response logging
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      if (!isLoggingEnabled()) return response;

      const config = response.config;
      const startTime = (config as any).__logStartTime;
      const duration = startTime ? `${Date.now() - startTime}ms` : '?ms';
      const displayUrl = (config as any).__logDisplayUrl || config.url || '';

      let bodyLog = '';
      if (response.data) {
        bodyLog = `\n  response: ${formatForLog(response.data)}`;
      }

      writeLog(`[ORCHESTRA:AXIOS] ← ${response.status} OK (${duration}) ${displayUrl}${bodyLog}`);
      return response;
    },
    (error) => {
      if (isLoggingEnabled() && error.config) {
        const config = error.config;
        const startTime = (config as any).__logStartTime;
        const duration = startTime ? `${Date.now() - startTime}ms` : '?ms';
        const displayUrl = (config as any).__logDisplayUrl || config.url || '';

        const status = error.response?.status || 'ERR';
        const statusText = error.response?.statusText || error.message || 'Error';

        let bodyLog = '';
        if (error.response?.data) {
          bodyLog = `\n  error: ${formatForLog(error.response.data)}`;
        }

        writeLog(
          `[ORCHESTRA:AXIOS] ← ${status} ${statusText} (${duration}) ${displayUrl}${bodyLog}`,
          'warn'
        );
      }
      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Add interceptors to transform request/response casing.
 * - Requests: camelCase → snake_case (for Orchestra API)
 * - Responses: snake_case → camelCase (for frontend)
 */
function addCasingInterceptors(client: AxiosInstance): AxiosInstance {
  // Transform request data from camelCase to snake_case
  client.interceptors.request.use((config) => {
    if (config.data && typeof config.data === 'object') {
      config.data = camelToSnakeObject(config.data);
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
  addLoggingInterceptors(client);
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
