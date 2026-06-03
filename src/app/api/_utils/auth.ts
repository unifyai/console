/**
 * Authentication utilities for API routes.
 *
 * Provides helpers for extracting API keys from requests using
 * session-based auth or header-based auth (for testing/backwards compatibility).
 *
 * Performance: getApiKeyFromRequest uses an in-memory cache to avoid calling
 * getCurrentUser() (which makes 1-3 Orchestra roundtrips) on every API route
 * invocation. The cache is populated by getCurrentUser() and has a short TTL.
 * On cache miss, falls back to the full getCurrentUser() call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getCurrentUser } from '@/lib/user/user';
import { resolveApiKeyFromCache, resolvePersonalApiKeyFromCache } from './api-key-cache';

/**
 * Get API key from request.
 *
 * Resolution order:
 *   1. JWT decode + in-memory cache (fast path — no Orchestra call)
 *   2. Full getCurrentUser() lookup (slow path — 1-3 Orchestra calls)
 *   3. Authorization: Bearer header
 *   4. Custom apiKey header (tests / backwards compatibility)
 *
 * @param request - The incoming NextRequest
 * @returns API key string or null if not authenticated
 */
export async function getApiKeyFromRequest(request: NextRequest): Promise<string | null> {
  // Block access when MFA verification is still pending.
  // The middleware matcher excludes /api/* routes, so this is the enforcement
  // point for API-level MFA gating. MFA-specific routes are exempt because
  // the user needs them to complete verification or org-enforced setup.
  const pathname = request.nextUrl.pathname;
  const isMfaRoute = pathname.startsWith('/api/auth/mfa');
  const jwtToken = await getToken({ req: request, secret: process.env.JWT_SECRET });
  if (!isMfaRoute && jwtToken?.mfaPending) {
    return null;
  }

  // Fast path: resolve from in-memory cache using the JWT email.
  // The cache is populated by getCurrentUser() during page SSR and by
  // previous slow-path calls. This avoids the Orchestra roundtrip that
  // getCurrentUser() → getUserByEmail() would otherwise require.
  if (jwtToken?.email && typeof jwtToken.email === 'string') {
    const workspaceId = request.cookies.get('unify_workspace_id')?.value;
    const headerApiKey = request.headers.get('apiKey');
    const cached = resolveApiKeyFromCache(jwtToken.email, workspaceId, headerApiKey);
    if (cached) {
      return cached;
    }
  }

  // Slow path: full user lookup via session + Orchestra.
  // This also populates the cache for subsequent requests.
  const user = await getCurrentUser();
  if (user?.apiKey) {
    return user.apiKey;
  }

  // Try standard Authorization: Bearer header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to custom apiKey header (for tests and backwards compatibility)
  const headerApiKey = request.headers.get('apiKey');
  if (headerApiKey) {
    return headerApiKey;
  }

  return null;
}

/**
 * Resolve the authenticated user's personal workspace API key.
 *
 * This bypasses org workspace locking and is used when server routes need to
 * operate on the user's single personal Coordinator identity regardless of the
 * currently selected workspace.
 */
export async function getPersonalApiKeyFromRequest(request: NextRequest): Promise<string | null> {
  const pathname = request.nextUrl.pathname;
  const isMfaRoute = pathname.startsWith('/api/auth/mfa');
  const jwtToken = await getToken({ req: request, secret: process.env.JWT_SECRET });
  if (!isMfaRoute && jwtToken?.mfaPending) {
    return null;
  }

  if (jwtToken?.email && typeof jwtToken.email === 'string') {
    const cached = resolvePersonalApiKeyFromCache(jwtToken.email);
    if (cached) {
      return cached;
    }
  }

  const user = await getCurrentUser();
  if (jwtToken?.email && typeof jwtToken.email === 'string') {
    const cached = resolvePersonalApiKeyFromCache(jwtToken.email);
    if (cached) {
      return cached;
    }
  }
  if (user?.apiKey) {
    return user.apiKey;
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const headerApiKey = request.headers.get('apiKey');
  if (headerApiKey) {
    return headerApiKey;
  }

  return null;
}

/**
 * Create an unauthorized response.
 *
 * @param message - Optional custom message
 * @returns NextResponse with 401 status
 */
export function unauthorized(message = 'Unauthorized - no API key'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Create a not found response.
 *
 * @param message - Optional custom message
 * @returns NextResponse with 404 status
 */
export function notFound(message = 'Not found'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Create a bad request response.
 *
 * @param message - Error message
 * @returns NextResponse with 400 status
 */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Create an internal server error response.
 *
 * @param message - Optional custom message
 * @returns NextResponse with 500 status
 */
export function internalError(message = 'Internal server error'): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}
