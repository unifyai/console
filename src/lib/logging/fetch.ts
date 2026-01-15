/**
 * Centralized API call logging for all services.
 *
 * This module provides:
 * - Shared logging utilities (writeLog, formatForLog, etc.)
 * - Factory functions for openapi-fetch middleware and Axios interceptors
 * - Generic fetch wrapper for third-party API calls
 * - Incoming request logging for API routes
 *
 * Usage:
 *   // For openapi-fetch clients
 *   import { createOpenapiLoggingMiddleware } from '@/lib/logging/fetch';
 *   client.use(createOpenapiLoggingMiddleware('ORCHESTRA'));
 *
 *   // For Axios clients
 *   import { addAxiosLoggingInterceptors } from '@/lib/logging/fetch';
 *   addAxiosLoggingInterceptors(axiosClient, 'ORCHESTRA');
 *
 *   // For direct fetch calls
 *   import { loggedFetch } from '@/lib/logging/fetch';
 *   const response = await loggedFetch('https://api.example.com/endpoint');
 *
 * Environment variables:
 *   LOG_API_CALLS=true        Enable logging
 *   LOG_API_CALLS=verbose     Enable logging with caller stack traces
 *   LOG_API_CALLS_FILE        Custom log file path (default: api-calls.log)
 *   LOG_API_CALLS_PRODUCTION  Enable logging in production (default: false)
 */

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Middleware } from 'openapi-fetch';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// =============================================================================
// Shared Logging Utilities
// =============================================================================

/**
 * Check if API logging is enabled via environment variable.
 * Logging is disabled in production by default for performance and disk space.
 * To enable in production, set LOG_API_CALLS_PRODUCTION=true in addition to LOG_API_CALLS.
 */
export const isLoggingEnabled = () => {
  const enabled = process.env.LOG_API_CALLS === 'true' || process.env.LOG_API_CALLS === 'verbose';
  const isProduction = process.env.NODE_ENV === 'production';
  const productionOverride = process.env.LOG_API_CALLS_PRODUCTION === 'true';

  // In production, require explicit opt-in
  return enabled && (!isProduction || productionOverride);
};

/**
 * Check if verbose logging (with stack traces) is enabled.
 */
export const isVerboseLogging = () => process.env.LOG_API_CALLS === 'verbose';

/**
 * Get the log file path.
 * Defaults to 'api-calls.log' in the project root.
 * Can be customized via LOG_API_CALLS_FILE environment variable.
 */
export const getLogFilePath = () => {
  const customPath = process.env.LOG_API_CALLS_FILE;
  if (customPath) return customPath;
  return path.join(process.cwd(), 'api-calls.log');
};

/**
 * Write a log entry to the log file.
 * Includes timestamp for each entry.
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
 * Extract a meaningful caller location from the stack trace.
 * Filters out internal middleware/library frames to show the actual origin.
 *
 * @param extraIgnoredPatterns - Additional patterns to ignore (e.g., client-specific paths)
 */
export function getCallerLocation(extraIgnoredPatterns: string[] = []): string {
  const stack = new Error().stack;
  if (!stack) return '';

  const lines = stack.split('\n');

  // Default patterns to ignore
  const defaultIgnored = ['/lib/logging/fetch.ts', 'node:internal', 'processTicksAndRejections'];
  const ignoredPatterns = [...defaultIgnored, ...extraIgnoredPatterns];

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

      return fnName ? `${simplePath}:${lineNum} (${fnName})` : `${simplePath}:${lineNum}`;
    }
  }

  return '';
}

// =============================================================================
// openapi-fetch Middleware Factory
// =============================================================================

/**
 * Create logging middleware for openapi-fetch clients.
 *
 * @param serviceName - The service name to use in log entries (e.g., 'ORCHESTRA')
 * @returns Middleware that can be added to an openapi-fetch client
 *
 * @example
 * import { createOpenapiLoggingMiddleware } from '@/lib/logging/fetch';
 *
 * const client = createClient<paths>({ baseUrl: '...' });
 * client.use(createOpenapiLoggingMiddleware('ORCHESTRA'));
 */
export function createOpenapiLoggingMiddleware(serviceName = 'ORCHESTRA'): Middleware {
  const ignoredPatterns = ['/orchestra/client.ts', '/node_modules/openapi-fetch/'];

  return {
    async onRequest({ request }) {
      if (!isLoggingEnabled()) return request;

      const url = new URL(request.url);
      const method = request.method;
      // Show full URL for verbose mode, path only for basic mode
      const displayUrl = isVerboseLogging() ? request.url : url.pathname + url.search;

      // Capture caller location before any async operations
      const callerLocation = isVerboseLogging() ? getCallerLocation(ignoredPatterns) : '';

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

      writeLog(`[${serviceName}] ${method} ${displayUrl}${bodyLog}`);
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
        `[${serviceName}] ← ${response.status} ${statusText} (${duration}) ${displayUrl}${bodyLog}`,
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
 *
 * @param client - The Axios instance to add interceptors to
 * @param serviceName - The service name to use in log entries (e.g., 'ORCHESTRA')
 * @returns The same Axios instance (for chaining)
 *
 * @example
 * import { addAxiosLoggingInterceptors } from '@/lib/logging/fetch';
 *
 * const client = axios.create({ baseURL: '...' });
 * addAxiosLoggingInterceptors(client, 'ORCHESTRA');
 */
export function addAxiosLoggingInterceptors(
  client: AxiosInstance,
  serviceName = 'ORCHESTRA'
): AxiosInstance {
  const ignoredPatterns = ['/orchestra/orchestra-client.ts', '/node_modules/axios/'];

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
    const callerLocation = isVerboseLogging() ? getCallerLocation(ignoredPatterns) : '';

    let bodyLog = '';
    if (config.data) {
      bodyLog = `\n  body: ${formatForLog(config.data)}`;
    }

    // Store start time and caller for duration calculation
    (config as any).__logStartTime = Date.now();
    (config as any).__logCaller = callerLocation;
    (config as any).__logDisplayUrl = displayUrl;

    writeLog(`[${serviceName}] ${method} ${displayUrl}${bodyLog}`);
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

      writeLog(`[${serviceName}] ← ${response.status} OK (${duration}) ${displayUrl}${bodyLog}`);
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
          `[${serviceName}] ← ${status} ${statusText} (${duration}) ${displayUrl}${bodyLog}`,
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

    // Common service name mappings
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

    // Default: use first part of hostname
    return hostname.split('.')[0].toUpperCase();
  } catch {
    return 'EXTERNAL';
  }
}

/**
 * Logged fetch wrapper for third-party API calls.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param serviceName - Optional custom service name for logging (auto-detected if not provided)
 * @returns The fetch Response
 *
 * @example
 * import { loggedFetch } from '@/lib/logging/fetch';
 *
 * // Basic usage (auto-detects service name from URL)
 * const response = await loggedFetch('https://api.example.com/endpoint');
 *
 * // With custom service name
 * const response = await loggedFetch('https://api.example.com/endpoint', {
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' }),
 * }, 'MY_SERVICE');
 */
export async function loggedFetch(
  url: string | URL,
  options: RequestInit = {},
  serviceName?: string
): Promise<Response> {
  const urlString = url.toString();
  const service = serviceName || getServiceName(urlString);
  const method = options.method?.toUpperCase() || 'GET';

  if (!isLoggingEnabled()) {
    return fetch(url, options);
  }

  const startTime = Date.now();
  const callerLocation = isVerboseLogging() ? getCallerLocation() : '';

  // Log request
  let bodyLog = '';
  if (options.body) {
    try {
      const bodyData = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      bodyLog = `\n  body: ${formatForLog(bodyData)}`;
    } catch {
      bodyLog = `\n  body: ${options.body.toString().slice(0, 200)}...`;
    }
  }

  writeLog(`[${service}] ${method} ${urlString}${bodyLog}`);
  if (callerLocation) {
    writeLog(`  └─ from: ${callerLocation}`);
  }

  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    // Log response
    const statusText = response.statusText || (response.ok ? 'OK' : 'Error');
    const logLevel = response.ok ? 'info' : 'warn';

    // Try to clone and read response body for logging
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

    writeLog(
      `[${service}] ← ${response.status} ${statusText} (${duration}ms) ${urlString}${responseLog}`,
      logLevel
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    writeLog(
      `[${service}] ← ERROR (${duration}ms) ${urlString}\n  error: ${errorMessage}`,
      'error'
    );

    throw error;
  }
}

/**
 * Create a logged fetch function with a fixed service name.
 * Useful for creating service-specific fetch wrappers.
 *
 * @param serviceName - The service name to use in logs
 * @returns A fetch function that logs with the given service name
 *
 * @example
 * const stripeFetch = createLoggedFetch('STRIPE');
 * const response = await stripeFetch('https://api.stripe.com/v1/charges', { method: 'POST' });
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
 * Wrap an existing request function (like Google Auth client's request) with logging.
 *
 * @param serviceName - The service name to use in logs
 * @returns A wrapper function that adds logging to any request function
 *
 * @example
 * const loggedRequest = wrapRequestWithLogging('PUBSUB');
 * const response = await loggedRequest(authClient.request.bind(authClient), {
 *   url: 'https://pubsub.googleapis.com/...',
 *   method: 'POST',
 *   data: { ... }
 * });
 */
export function wrapRequestWithLogging(serviceName: string) {
  return async <T>(
    requestFn: (config: {
      url: string;
      method: string;
      data?: unknown;
    }) => Promise<{ status: number; data: T }>,
    config: { url: string; method: string; data?: unknown }
  ): Promise<{ status: number; data: T }> => {
    if (!isLoggingEnabled()) {
      return requestFn(config);
    }

    const startTime = Date.now();
    const callerLocation = isVerboseLogging() ? getCallerLocation() : '';
    const method = config.method.toUpperCase();

    // Log request
    let bodyLog = '';
    if (config.data) {
      bodyLog = `\n  body: ${formatForLog(config.data)}`;
    }

    writeLog(`[${serviceName}] ${method} ${config.url}${bodyLog}`);
    if (callerLocation) {
      writeLog(`  └─ from: ${callerLocation}`);
    }

    try {
      const response = await requestFn(config);
      const duration = Date.now() - startTime;

      const logLevel = response.status >= 200 && response.status < 300 ? 'info' : 'warn';
      let responseLog = '';
      if (response.data) {
        responseLog = `\n  response: ${formatForLog(response.data)}`;
      }

      writeLog(
        `[${serviceName}] ← ${response.status} (${duration}ms) ${config.url}${responseLog}`,
        logLevel
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      writeLog(
        `[${serviceName}] ← ERROR (${duration}ms) ${config.url}\n  error: ${errorMessage}`,
        'error'
      );

      throw error;
    }
  };
}

// =============================================================================
// Incoming Request Logging for API Routes
// =============================================================================

/**
 * Log an incoming API request for debugging.
 * Use this to trace what's being sent to your API routes.
 *
 * @param request - The NextRequest object
 * @param method - HTTP method
 * @param route - The route path (e.g., '/api/assistant/message')
 * @param status - Response status code (null if just logging the request)
 * @param error - Error message if returning an error
 * @param body - Request body (for logging incoming data)
 * @returns NextResponse if status is provided, void otherwise
 *
 * @example
 * // Log an error response
 * return logIncomingRequest(request, 'POST', '/api/example', 400, 'Missing field');
 *
 * // Just log the incoming request body
 * await logIncomingRequest(request, 'POST', '/api/example', null, null, requestBody);
 */
export async function logIncomingRequest(
  request: NextRequest,
  method: string,
  route: string,
  status: number | null,
  error: string | null,
  body?: unknown
): Promise<NextResponse | void> {
  if (!isLoggingEnabled()) {
    if (status !== null) {
      return NextResponse.json({ detail: error || 'Error' }, { status });
    }
    return;
  }

  const callerLocation = isVerboseLogging() ? getCallerLocation() : '';

  if (body !== undefined) {
    // Log the incoming request with body
    writeLog(`[INCOMING] ${method} ${route}\n  body: ${formatForLog(body)}`);
    if (callerLocation) {
      writeLog(`  └─ from: ${callerLocation}`);
    }
  }

  if (status !== null) {
    // Log the error response
    const logLevel = status >= 400 ? 'warn' : 'info';
    writeLog(`[INCOMING] ${method} ${route} ← ${status} ${error || ''}`, logLevel);
    return NextResponse.json({ detail: error || 'Error' }, { status });
  }
}
