/**
 * Typed Orchestra API client using OpenAPI code generation.
 *
 * This client provides:
 * - Full TypeScript type safety from Orchestra's OpenAPI spec
 * - Automatic casing transformation (snake_case ↔ camelCase)
 * - Centralized auth handling
 * - Consistent error handling
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
