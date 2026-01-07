/**
 * Casing transformation utilities for converting between snake_case and camelCase.
 * Used at API boundaries to transform Orchestra API responses (snake_case) to
 * internal TypeScript conventions (camelCase) and vice versa.
 */

/**
 * Convert a snake_case string to camelCase.
 * @example snakeToCamel('user_id') // 'userId'
 * @example snakeToCamel('created_at') // 'createdAt'
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a camelCase string to snake_case.
 * @example camelToSnake('userId') // 'user_id'
 * @example camelToSnake('createdAt') // 'created_at'
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Check if a value is a plain object (not null, array, Date, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp) &&
    !(value instanceof Map) &&
    !(value instanceof Set)
  );
}

/**
 * Recursively transform all keys in an object using the provided transformer function.
 * Handles nested objects and arrays.
 */
export function transformKeys<T>(
  obj: unknown,
  transformer: (key: string) => string
): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeys(item, transformer)) as T;
  }

  if (isPlainObject(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = transformer(key);
      result[newKey] = transformKeys(value, transformer);
    }
    return result as T;
  }

  // Primitives, null, undefined, Date, etc. - return as-is
  return obj as T;
}

/**
 * Transform an API response object from snake_case keys to camelCase keys.
 * Use this when receiving data from Orchestra API.
 * 
 * @example
 * const apiResponse = { user_id: '123', created_at: '2024-01-01' };
 * const internal = snakeToCamelObject<User>(apiResponse);
 * // { userId: '123', createdAt: '2024-01-01' }
 */
export function snakeToCamelObject<T>(obj: unknown): T {
  return transformKeys<T>(obj, snakeToCamel);
}

/**
 * Transform an internal object from camelCase keys to snake_case keys.
 * Use this when sending data to Orchestra API.
 * 
 * @example
 * const internal = { userId: '123', createdAt: '2024-01-01' };
 * const apiPayload = camelToSnakeObject(internal);
 * // { user_id: '123', created_at: '2024-01-01' }
 */
export function camelToSnakeObject<T>(obj: unknown): T {
  return transformKeys<T>(obj, camelToSnake);
}

/**
 * Transform specific keys in an object, leaving others unchanged.
 * Useful for partial transformations or when some keys should remain as-is.
 * 
 * @param obj The object to transform
 * @param keysToTransform Array of keys to transform (in their current casing)
 * @param transformer The transformation function to apply
 */
export function transformSpecificKeys<T>(
  obj: Record<string, unknown>,
  keysToTransform: string[],
  transformer: (key: string) => string
): T {
  const result: Record<string, unknown> = {};
  const keysSet = new Set(keysToTransform);

  for (const [key, value] of Object.entries(obj)) {
    const newKey = keysSet.has(key) ? transformer(key) : key;
    result[newKey] = value;
  }

  return result as T;
}

/**
 * Fetch wrapper for Orchestra API calls that handles casing transformation.
 * - Transforms request body from camelCase to snake_case
 * - Transforms response from snake_case to camelCase
 * 
 * Use this instead of raw fetch() when calling Orchestra endpoints.
 * 
 * @example
 * const user = await fetchOrchestra<User>('/v0/users/me', {
 *   headers: { Authorization: `Bearer ${apiKey}` }
 * });
 */
export async function fetchOrchestra<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const orchestraUrl = process.env.ORCHESTRA_URL || '';
  const fullUrl = url.startsWith('http') ? url : `${orchestraUrl}${url}`;

  // Transform request body to snake_case if present
  let transformedOptions = { ...options };
  if (options.body && typeof options.body === 'string') {
    try {
      const parsed = JSON.parse(options.body);
      transformedOptions.body = JSON.stringify(camelToSnakeObject(parsed));
    } catch {
      // Not JSON, leave as-is
    }
  }

  const response = await fetch(fullUrl, transformedOptions);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Orchestra API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  // Transform response to camelCase
  return snakeToCamelObject<T>(data);
}

/**
 * Same as fetchOrchestra but returns the raw Response object.
 * Useful for streaming responses or when you need response headers.
 * Only transforms the request body, not the response.
 */
export async function fetchOrchestraRaw(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const orchestraUrl = process.env.ORCHESTRA_URL || '';
  const fullUrl = url.startsWith('http') ? url : `${orchestraUrl}${url}`;

  // Transform request body to snake_case if present
  let transformedOptions = { ...options };
  if (options.body && typeof options.body === 'string') {
    try {
      const parsed = JSON.parse(options.body);
      transformedOptions.body = JSON.stringify(camelToSnakeObject(parsed));
    } catch {
      // Not JSON, leave as-is
    }
  }

  return fetch(fullUrl, transformedOptions);
}

