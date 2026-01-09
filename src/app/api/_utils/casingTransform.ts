/**
 * API Route Casing Transformation Utilities
 *
 * Transforms between frontend camelCase and Orchestra snake_case conventions.
 * Use these at API route boundaries when proxying to Orchestra.
 */

import { camelToSnake, camelToSnakeObject } from '@/utils/casing';

/**
 * Transform URL query parameters from camelCase to snake_case
 *
 * @example
 * transformQueryParams(new URL("?projectName=test&interfaceId=123"))
 * // Returns "?project_name=test&interface_id=123"
 */
export function transformQueryParams(url: URL): string {
  const params = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    params.set(camelToSnake(key), value);
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Transform a request body from camelCase keys to snake_case keys
 *
 * @example
 * transformBody({ projectName: "test", interfaceId: "123" })
 * // Returns { project_name: "test", interface_id: "123" }
 */
export function transformBody<T>(body: unknown): T {
  return camelToSnakeObject<T>(body);
}

/**
 * Transform both query params and body for a request to Orchestra
 * Returns the snake_case query string and transformed body
 */
export function transformRequest(
  url: URL,
  body?: unknown
): {
  queryString: string;
  body?: string;
} {
  const queryString = transformQueryParams(url);
  const transformedBody = body ? JSON.stringify(camelToSnakeObject(body)) : undefined;
  return { queryString, body: transformedBody };
}
