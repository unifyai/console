/**
 * Centralized API call logging for all services.
 *
 * This module provides filter-based logging that is silent by default.
 * Add patterns to `.log-filter` file to enable logging for matching requests.
 *
 * Usage:
 *   # Create filter file to start logging (no restart needed)
 *   echo "/v0/logs" > .log-filter
 *
 *   # Multiple patterns (one per line)
 *   echo -e "/v0/logs\nDELETE\n/assistant" > .log-filter
 *
 *   # Log everything
 *   echo "*" > .log-filter
 *
 *   # Stop logging
 *   rm .log-filter
 *
 * Filter patterns match against: METHOD URL (e.g., "GET /v0/logs?project=test")
 * Special patterns:
 *   *        - Match everything
 *   :error   - Match only failed requests (4xx, 5xx)
 *
 * When a request matches, full context is logged:
 *   - Request method, URL, body
 *   - Response status, body
 *   - Duration
 *   - Full stack trace showing call origin
 *
 * Environment variables (optional, for production use):
 *   LOG_API_CALLS_FILE        Custom log file path (default: api-calls.log)
 *   LOG_API_FILTER            Fallback filter if no .log-filter file exists
 */

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Middleware } from 'openapi-fetch';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// =============================================================================
// Filter-Based Logging
// =============================================================================

/**
 * Get the path to the filter file.
 */
function getFilterFilePath(): string {
  return path.join(process.cwd(), '.log-filter');
}

/**
 * Read log filters from the .log-filter file.
 * Returns null if file doesn't exist or is empty (logging disabled).
 * Returns array of filter patterns if file has content.
 *
 * This is read on every call so changes take effect immediately.
 */
export function getLogFilters(): string[] | null {
  try {
    const filterPath = getFilterFilePath();
    if (!fs.existsSync(filterPath)) {
      // Fall back to environment variable
      const envFilter = process.env.LOG_API_FILTER;
      if (envFilter) {
        return envFilter
          .split(',')
          .map((f) => f.trim().toLowerCase())
          .filter(Boolean);
      }
      return null;
    }

    const content = fs.readFileSync(filterPath, 'utf-8').trim();
    if (!content) return null;

    // Parse filters (one per line, or comma-separated)
    const filters = content
      .split(/[\n,]/)
      .map((f) => f.trim().toLowerCase())
      .filter(Boolean);

    return filters.length > 0 ? filters : null;
  } catch {
    return null;
  }
}

/**
 * Check if a request matches the current log filters.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param url - Request URL
 * @param status - Response status code (for :error filter)
 * @returns true if request should be logged
 */
export function matchesFilter(method: string, url: string, status?: number): boolean {
  const filters = getLogFilters();
  if (!filters) return false; // No filters = no logging

  const searchText = `${method} ${url}`.toLowerCase();

  for (const filter of filters) {
    // Match everything
    if (filter === '*') return true;

    // Match errors only
    if (filter === ':error') {
      if (status !== undefined && status >= 400) return true;
      continue;
    }

    // Match against method + URL
    if (searchText.includes(filter)) return true;
  }

  return false;
}

/**
 * Get the log file path.
 * Defaults to 'api-calls.log' in the project root.
 */
export const getLogFilePath = () => {
  const customPath = process.env.LOG_API_CALLS_FILE;
  if (customPath) return customPath;
  return path.join(process.cwd(), 'api-calls.log');
};

/**
 * Write a log entry to the log file.
 */
export function writeLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  try {
    const timestamp = new Date().toISOString();
    const prefix = level === 'info' ? '' : `[${level.toUpperCase()}] `;
    const logLine = `[${timestamp}] ${prefix}${message}\n`;
    fs.appendFileSync(getLogFilePath(), logLine);
  } catch (err) {
    // Fallback to console if file write fails
    console.error('[LOG] Failed to write to log file:', err);
    console.log(message);
  }
}

/**
 * Format data for logging, truncating large payloads.
 */
export function formatForLog(data: unknown, maxLength = 10000): string {
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
 * Get full stack trace for logging.
 * Shows the complete call chain from the request origin.
 */
export function getFullStackTrace(extraIgnoredPatterns: string[] = []): string {
  const stack = new Error().stack;
  if (!stack) return '';

  const lines = stack.split('\n');

  // Patterns to ignore (internal implementation details)
  const ignoredPatterns = [
    '/lib/logging/fetch.ts',
    'node:internal',
    'processTicksAndRejections',
    'node_modules',
    ...extraIgnoredPatterns,
  ];

  const relevantLines: string[] = [];

  for (const line of lines.slice(1)) {
    if (ignoredPatterns.some((pattern) => line.includes(pattern))) {
      continue;
    }

    const match = line.match(/at\s+(?:(.+?)\s+)?\(?(.*?):(\d+):(\d+)\)?/);
    if (match) {
      const [, fnName, filePath, lineNum] = match;
      const simplePath = filePath.includes('/src/')
        ? filePath.substring(filePath.indexOf('/src/') + 1)
        : filePath.split('/').slice(-2).join('/');

      const location = fnName ? `${simplePath}:${lineNum} (${fnName})` : `${simplePath}:${lineNum}`;
      relevantLines.push(location);
    }
  }

  return relevantLines.join('\n    → ');
}

// =============================================================================
// openapi-fetch Middleware Factory
// =============================================================================

/**
 * Create logging middleware for openapi-fetch clients.
 * Only logs requests that match filters in .log-filter file.
 *
 * @param serviceName - The service name to use in log entries (e.g., 'ORCHESTRA')
 */
export function createOpenapiLoggingMiddleware(serviceName = 'ORCHESTRA'): Middleware {
  const ignoredPatterns = ['/orchestra/client.ts', '/node_modules/openapi-fetch/'];

  return {
    async onRequest({ request }) {
      const url = new URL(request.url);
      const method = request.method;
      const displayUrl = request.url;

      // Always capture metadata for response logging
      const stackTrace = getFullStackTrace(ignoredPatterns);

      // Clone and read body if present
      let requestBody: unknown = undefined;
      let bodyLog = '';
      if (request.body) {
        try {
          const cloned = request.clone();
          const bodyText = await cloned.text();
          if (bodyText) {
            requestBody = JSON.parse(bodyText);
            bodyLog = `\n  body: ${formatForLog(requestBody)}`;
          }
        } catch {
          bodyLog = '\n  body: [present but unreadable]';
        }
      }

      // Store metadata for response handler
      (request as any).__logStartTime = Date.now();
      (request as any).__logDisplayUrl = displayUrl;
      (request as any).__logMethod = method;
      (request as any).__logStackTrace = stackTrace;
      (request as any).__logBodyLog = bodyLog;

      // Check filter - we check here but also in response (for :error filter)
      if (matchesFilter(method, displayUrl)) {
        writeLog(`[${serviceName}] ${method} ${url.pathname}${url.search}${bodyLog}`);
        writeLog(`  ┌─ trace: ${stackTrace}`);
      }

      return request;
    },

    async onResponse({ request, response }) {
      const startTime = (request as any).__logStartTime;
      const duration = startTime ? Date.now() - startTime : 0;
      const displayUrl = (request as any).__logDisplayUrl || request.url;
      const method = (request as any).__logMethod || request.method;
      const stackTrace = (request as any).__logStackTrace || '';
      const requestBodyLog = (request as any).__logBodyLog || '';

      const url = new URL(displayUrl);
      const pathWithQuery = url.pathname + url.search;

      // Check filter with status (for :error pattern)
      const shouldLog = matchesFilter(method, displayUrl, response.status);
      if (!shouldLog) return response;

      // Clone to read body without consuming it
      let responseBodyLog = '';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const cloned = response.clone();
          const data = await cloned.json();
          responseBodyLog = `\n  response: ${formatForLog(data)}`;
        }
      } catch {
        // Ignore parse errors
      }

      const statusText = response.statusText || (response.ok ? 'OK' : 'Error');
      const logLevel = response.ok ? 'info' : 'warn';

      // If we didn't log the request earlier (e.g., :error filter), log full context now
      const wasLoggedOnRequest = matchesFilter(method, displayUrl);
      if (!wasLoggedOnRequest) {
        writeLog(`[${serviceName}] ${method} ${pathWithQuery}${requestBodyLog}`);
        writeLog(`  ┌─ trace: ${stackTrace}`);
      }

      writeLog(
        `[${serviceName}] ← ${response.status} ${statusText} (${duration}ms)${responseBodyLog}`,
        logLevel
      );

      return response;
    },
  };
}

// =============================================================================
// Axios Interceptors Factory
// =============================================================================

/**
 * Add logging interceptors to an Axios client.
 * Only logs requests that match filters in .log-filter file.
 *
 * @param client - The Axios instance to add interceptors to
 * @param serviceName - The service name to use in log entries (e.g., 'ORCHESTRA')
 */
export function addAxiosLoggingInterceptors(
  client: AxiosInstance,
  serviceName = 'ORCHESTRA'
): AxiosInstance {
  const ignoredPatterns = ['/orchestra/orchestra-client.ts', '/node_modules/axios/'];

  // Request interceptor
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const method = config.method?.toUpperCase() || 'UNKNOWN';
    const url = config.url || '';
    const baseURL = config.baseURL || '';
    const fullPath = url.startsWith('http') ? url : `${baseURL}${url}`;

    const queryString = config.params ? '?' + new URLSearchParams(config.params).toString() : '';
    const displayUrl = fullPath + queryString;

    const stackTrace = getFullStackTrace(ignoredPatterns);
    const bodyLog = config.data ? `\n  body: ${formatForLog(config.data)}` : '';

    // Store metadata
    (config as any).__logStartTime = Date.now();
    (config as any).__logDisplayUrl = displayUrl;
    (config as any).__logStackTrace = stackTrace;
    (config as any).__logBodyLog = bodyLog;

    // Check filter
    if (matchesFilter(method, displayUrl)) {
      const pathWithQuery = displayUrl.replace(/https?:\/\/[^/]+/, '');
      writeLog(`[${serviceName}] ${method} ${pathWithQuery}${bodyLog}`);
      writeLog(`  ┌─ trace: ${stackTrace}`);
    }

    return config;
  });

  // Response interceptor
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      const config = response.config;
      const method = config.method?.toUpperCase() || 'UNKNOWN';
      const displayUrl = (config as any).__logDisplayUrl || config.url || '';
      const startTime = (config as any).__logStartTime;
      const duration = startTime ? Date.now() - startTime : 0;
      const stackTrace = (config as any).__logStackTrace || '';
      const requestBodyLog = (config as any).__logBodyLog || '';

      const shouldLog = matchesFilter(method, displayUrl, response.status);
      if (!shouldLog) return response;

      const responseBodyLog = response.data ? `\n  response: ${formatForLog(response.data)}` : '';
      const pathWithQuery = displayUrl.replace(/https?:\/\/[^/]+/, '');

      const wasLoggedOnRequest = matchesFilter(method, displayUrl);
      if (!wasLoggedOnRequest) {
        writeLog(`[${serviceName}] ${method} ${pathWithQuery}${requestBodyLog}`);
        writeLog(`  ┌─ trace: ${stackTrace}`);
      }

      writeLog(`[${serviceName}] ← ${response.status} OK (${duration}ms)${responseBodyLog}`);
      return response;
    },
    (error) => {
      if (error.config) {
        const config = error.config;
        const method = config.method?.toUpperCase() || 'UNKNOWN';
        const displayUrl = (config as any).__logDisplayUrl || config.url || '';
        const startTime = (config as any).__logStartTime;
        const duration = startTime ? Date.now() - startTime : 0;
        const stackTrace = (config as any).__logStackTrace || '';
        const requestBodyLog = (config as any).__logBodyLog || '';

        const status = error.response?.status || 500;
        const shouldLog = matchesFilter(method, displayUrl, status);
        if (!shouldLog) return Promise.reject(error);

        const statusText = error.response?.statusText || error.message || 'Error';
        const errorBodyLog = error.response?.data
          ? `\n  error: ${formatForLog(error.response.data)}`
          : '';
        const pathWithQuery = displayUrl.replace(/https?:\/\/[^/]+/, '');

        const wasLoggedOnRequest = matchesFilter(method, displayUrl);
        if (!wasLoggedOnRequest) {
          writeLog(`[${serviceName}] ${method} ${pathWithQuery}${requestBodyLog}`);
          writeLog(`  ┌─ trace: ${stackTrace}`);
        }

        writeLog(
          `[${serviceName}] ← ${status} ${statusText} (${duration}ms)${errorBodyLog}`,
          'warn'
        );
      }
      return Promise.reject(error);
    }
  );

  return client;
}

// =============================================================================
// Generic Fetch Wrapper
// =============================================================================

/**
 * Extract a service name from a URL.
 */
function getServiceName(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    if (hostname.includes('pubsub.googleapis.com')) return 'PUBSUB';
    if (hostname.includes('googleapis.com')) return 'GOOGLE';
    if (hostname.includes('openai.com')) return 'OPENAI';
    if (hostname.includes('anthropic.com')) return 'ANTHROPIC';
    if (hostname.includes('stripe.com')) return 'STRIPE';
    if (hostname.includes('twilio.com')) return 'TWILIO';
    if (hostname.includes('sendgrid')) return 'SENDGRID';
    if (hostname.includes('unify.ai')) return 'ORCHESTRA';
    if (hostname.includes('run.app')) return 'CLOUD_RUN';
    if (hostname.includes('livekit')) return 'LIVEKIT';
    if (hostname.includes('replicate')) return 'REPLICATE';
    if (hostname.includes('elevenlabs')) return 'ELEVENLABS';
    if (hostname.includes('cartesia')) return 'CARTESIA';

    return hostname.split('.')[0].toUpperCase();
  } catch {
    return 'EXTERNAL';
  }
}

/**
 * Logged fetch wrapper for third-party API calls.
 * Only logs requests that match filters in .log-filter file.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param serviceName - Optional custom service name for logging
 */
export async function loggedFetch(
  url: string | URL,
  options: RequestInit = {},
  serviceName?: string
): Promise<Response> {
  const urlString = url.toString();
  const service = serviceName || getServiceName(urlString);
  const method = options.method?.toUpperCase() || 'GET';

  const startTime = Date.now();
  const stackTrace = getFullStackTrace();

  // Parse body for logging
  let requestBody: unknown = undefined;
  let bodyLog = '';
  if (options.body) {
    try {
      requestBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      bodyLog = `\n  body: ${formatForLog(requestBody)}`;
    } catch {
      bodyLog = `\n  body: ${options.body.toString().slice(0, 200)}...`;
    }
  }

  // Extract path for cleaner logs
  let pathWithQuery = urlString;
  try {
    const parsed = new URL(urlString);
    pathWithQuery = parsed.pathname + parsed.search;
  } catch {
    // Use full URL if parsing fails
  }

  // Check filter on request
  const matchedOnRequest = matchesFilter(method, urlString);
  if (matchedOnRequest) {
    writeLog(`[${service}] ${method} ${pathWithQuery}${bodyLog}`);
    writeLog(`  ┌─ trace: ${stackTrace}`);
  }

  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    // Check filter with status
    const shouldLog = matchesFilter(method, urlString, response.status);
    if (!shouldLog) return response;

    // Read response body for logging
    let responseLog = '';
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const cloned = response.clone();
        const data = await cloned.json();
        responseLog = `\n  response: ${formatForLog(data)}`;
      }
    } catch {
      // Ignore parse errors
    }

    const statusText = response.statusText || (response.ok ? 'OK' : 'Error');
    const logLevel = response.ok ? 'info' : 'warn';

    // If we didn't log request earlier, log full context now
    if (!matchedOnRequest) {
      writeLog(`[${service}] ${method} ${pathWithQuery}${bodyLog}`);
      writeLog(`  ┌─ trace: ${stackTrace}`);
    }

    writeLog(
      `[${service}] ← ${response.status} ${statusText} (${duration}ms)${responseLog}`,
      logLevel
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Always log errors if :error filter is set
    const shouldLog = matchesFilter(method, urlString, 500);
    if (shouldLog) {
      if (!matchedOnRequest) {
        writeLog(`[${service}] ${method} ${pathWithQuery}${bodyLog}`);
        writeLog(`  ┌─ trace: ${stackTrace}`);
      }
      writeLog(`[${service}] ← ERROR (${duration}ms)\n  error: ${errorMessage}`, 'error');
    }

    throw error;
  }
}

/**
 * Create a logged fetch function with a fixed service name.
 */
export function createLoggedFetch(serviceName: string) {
  return (url: string | URL, options: RequestInit = {}): Promise<Response> => {
    return loggedFetch(url, options, serviceName);
  };
}

// =============================================================================
// Request Wrapper for Non-Fetch Clients (e.g., Google Auth)
// =============================================================================

/**
 * Wrap an existing request function with logging.
 * Only logs requests that match filters in .log-filter file.
 */
type HttpMethod =
  | 'GET'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'CONNECT'
  | 'TRACE';

export function wrapRequestWithLogging(serviceName: string) {
  return async <T>(
    requestFn: (config: {
      url: string;
      method: HttpMethod;
      data?: unknown;
    }) => Promise<{ status: number; data: T }>,
    config: { url: string; method: HttpMethod; data?: unknown }
  ): Promise<{ status: number; data: T }> => {
    const startTime = Date.now();
    const stackTrace = getFullStackTrace();
    const method = config.method.toUpperCase();
    const bodyLog = config.data ? `\n  body: ${formatForLog(config.data)}` : '';

    let pathWithQuery = config.url;
    try {
      const parsed = new URL(config.url);
      pathWithQuery = parsed.pathname + parsed.search;
    } catch {
      // Use full URL
    }

    const matchedOnRequest = matchesFilter(method, config.url);
    if (matchedOnRequest) {
      writeLog(`[${serviceName}] ${method} ${pathWithQuery}${bodyLog}`);
      writeLog(`  ┌─ trace: ${stackTrace}`);
    }

    try {
      const response = await requestFn(config);
      const duration = Date.now() - startTime;

      const shouldLog = matchesFilter(method, config.url, response.status);
      if (!shouldLog) return response;

      const responseLog = response.data ? `\n  response: ${formatForLog(response.data)}` : '';
      const logLevel = response.status >= 200 && response.status < 300 ? 'info' : 'warn';

      if (!matchedOnRequest) {
        writeLog(`[${serviceName}] ${method} ${pathWithQuery}${bodyLog}`);
        writeLog(`  ┌─ trace: ${stackTrace}`);
      }

      writeLog(`[${serviceName}] ← ${response.status} (${duration}ms)${responseLog}`, logLevel);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const shouldLog = matchesFilter(method, config.url, 500);
      if (shouldLog) {
        if (!matchedOnRequest) {
          writeLog(`[${serviceName}] ${method} ${pathWithQuery}${bodyLog}`);
          writeLog(`  ┌─ trace: ${stackTrace}`);
        }
        writeLog(`[${serviceName}] ← ERROR (${duration}ms)\n  error: ${errorMessage}`, 'error');
      }

      throw error;
    }
  };
}

// =============================================================================
// Incoming Request Logging for API Routes
// =============================================================================

/**
 * Log an incoming API request for debugging.
 * Only logs if the route matches filters in .log-filter file.
 */
export async function logIncomingRequest(
  request: NextRequest,
  method: string,
  route: string,
  status: number | null,
  error: string | null,
  body?: unknown
): Promise<NextResponse | void> {
  const shouldLog = matchesFilter(method, route, status ?? undefined);

  if (!shouldLog) {
    if (status !== null) {
      return NextResponse.json({ detail: error || 'Error' }, { status });
    }
    return;
  }

  const stackTrace = getFullStackTrace();

  if (body !== undefined) {
    writeLog(`[INCOMING] ${method} ${route}\n  body: ${formatForLog(body)}`);
    writeLog(`  ┌─ trace: ${stackTrace}`);
  }

  if (status !== null) {
    const logLevel = status >= 400 ? 'warn' : 'info';
    writeLog(`[INCOMING] ${method} ${route} ← ${status} ${error || ''}`, logLevel);
    return NextResponse.json({ detail: error || 'Error' }, { status });
  }
}

// =============================================================================
// Backwards Compatibility
// =============================================================================

/**
 * @deprecated Use filter-based logging instead. These are kept for compatibility.
 */
export const isLoggingEnabled = () => getLogFilters() !== null;
export const isVerboseLogging = () => getLogFilters() !== null;
export const getCallerLocation = getFullStackTrace;
