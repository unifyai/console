/**
 * API Route Caching Utilities
 * 
 * Provides helpers for adding Cache-Control headers to API responses.
 * 
 * Cache strategies:
 * - SHORT (30s): Frequently changing data (logs)
 * - MEDIUM (60s): Semi-stable data (interfaces, tabs, tiles)
 * - LONG (5min): Stable metadata (fields, projects, contexts)
 * 
 * All caches use:
 * - `private`: User-specific data, not CDN cacheable
 * - `stale-while-revalidate`: Serve stale while fetching fresh
 */

export const CACHE_DURATIONS = {
  /** 30 seconds - for frequently changing data like logs */
  SHORT: {
    maxAge: 30,
    staleWhileRevalidate: 60,
  },
  /** 60 seconds - for semi-stable data like interface config */
  MEDIUM: {
    maxAge: 60,
    staleWhileRevalidate: 120,
  },
  /** 5 minutes - for stable metadata like fields, projects */
  LONG: {
    maxAge: 300,
    staleWhileRevalidate: 600,
  },
  /** No caching - for dynamic/real-time data */
  NONE: null,
} as const;

type CacheDuration = keyof typeof CACHE_DURATIONS;

/**
 * Builds Cache-Control header value
 */
export function buildCacheControl(duration: CacheDuration): string | null {
  const config = CACHE_DURATIONS[duration];
  if (!config) return null;
  
  return `private, max-age=${config.maxAge}, stale-while-revalidate=${config.staleWhileRevalidate}`;
}

/**
 * Wraps a fetch response with caching headers
 * 
 * @param upstreamResponse - The response from the upstream API
 * @param duration - Cache duration preset
 * @returns New Response with caching headers
 */
export async function withCacheHeaders(
  upstreamResponse: Response,
  duration: CacheDuration = 'MEDIUM'
): Promise<Response> {
  // Don't cache error responses
  if (!upstreamResponse.ok) {
    return upstreamResponse;
  }
  
  const cacheControl = buildCacheControl(duration);
  
  // Clone the response and add headers
  const body = await upstreamResponse.text();
  const headers = new Headers(upstreamResponse.headers);
  
  // Set caching headers
  if (cacheControl) {
    headers.set('Cache-Control', cacheControl);
    headers.append('Vary', 'Cookie');
    headers.append('Vary', 'apiKey');
  }
  
  // Ensure content type is set
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  return new Response(body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}

/**
 * Creates a cached GET handler for simple proxy routes
 * 
 * @param baseUrl - Base URL for the upstream API
 * @param path - Path to append to base URL
 * @param duration - Cache duration preset
 */
export function createCachedGetHandler(
  getBaseUrl: () => string,
  path: string,
  duration: CacheDuration = 'MEDIUM'
) {
  return async function GET(request: Request) {
    const url = new URL(request.url);
    const baseUrl = getBaseUrl();
    
    const upstreamResponse = await fetch(
      `${baseUrl}${path}${url.search}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${request.headers.get('apiKey')}`,
          'accept': 'application/json',
        },
      }
    );
    
    return withCacheHeaders(upstreamResponse, duration);
  };
}

