/**
 * Logged fetch wrapper for third-party API calls.
 *
 * This wrapper logs all fetch requests to the same log file as the Orchestra
 * client middleware, making it easy to trace API calls across all services.
 *
 * Usage:
 *   import { loggedFetch } from '@/lib/logging/fetch';
 *
 *   // Basic usage (auto-detects service name from URL)
 *   const response = await loggedFetch('https://api.example.com/endpoint');
 *
 *   // With custom service name
 *   const response = await loggedFetch('https://api.example.com/endpoint', {
 *     method: 'POST',
 *     body: JSON.stringify({ data: 'value' }),
 *   }, 'MY_SERVICE');
 *
 * Environment variables:
 *   LOG_API_CALLS=true        Enable logging
 *   LOG_API_CALLS=verbose     Enable logging with caller stack traces
 *   LOG_API_CALLS_FILE        Custom log file path (default: api-calls.log)
 */

import fs from 'fs';
import path from 'path';

/**
 * Check if API logging is enabled via environment variable.
 * Logging is disabled in production by default for performance and disk space.
 * To enable in production, set LOG_API_CALLS_PRODUCTION=true in addition to LOG_API_CALLS.
 */
const isLoggingEnabled = () => {
  const enabled = process.env.LOG_API_CALLS === 'true' || process.env.LOG_API_CALLS === 'verbose';
  const isProduction = process.env.NODE_ENV === 'production';
  const productionOverride = process.env.LOG_API_CALLS_PRODUCTION === 'true';

  // In production, require explicit opt-in
  return enabled && (!isProduction || productionOverride);
};
const isVerboseLogging = () => process.env.LOG_API_CALLS === 'verbose';

/**
 * Log file path for API call logging.
 */
const getLogFilePath = () => {
  const customPath = process.env.LOG_API_CALLS_FILE;
  if (customPath) return customPath;
  return path.join(process.cwd(), 'api-calls.log');
};

/**
 * Write a log entry to the log file.
 */
function writeLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  try {
    const timestamp = new Date().toISOString();
    const prefix = level === 'info' ? '' : `[${level.toUpperCase()}] `;
    const logLine = `[${timestamp}] ${prefix}${message}\n`;
    fs.appendFileSync(getLogFilePath(), logLine);
  } catch (err) {
    // Fallback to console if file write fails
    console.error('[FETCH] Failed to write to log file:', err);
    console.log(message);
  }
}

/**
 * Format data for logging, truncating large payloads.
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
 */
function getCallerLocation(): string {
  const stack = new Error().stack;
  if (!stack) return '';

  const lines = stack.split('\n');

  // Skip frames from this file and node internals
  const ignoredPatterns = ['/lib/logging/fetch.ts', 'node:internal', 'processTicksAndRejections'];

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
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
