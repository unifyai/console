/**
 * Authentication utilities for API routes.
 *
 * Provides helpers for extracting API keys from requests using
 * session-based auth or header-based auth (for testing/backwards compatibility).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getCurrentUser } from '@/lib/user/user';

/**
 * Get API key from request.
 * Tries session first, falls back to apiKey header for backwards compatibility.
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
  if (!isMfaRoute) {
    const jwtToken = await getToken({ req: request, secret: process.env.JWT_SECRET });
    if (jwtToken?.mfaPending) {
      return null;
    }
  }

  // Try session-based auth first
  const user = await getCurrentUser();
  if (user?.apiKey) {
    return user.apiKey;
  }

  // Try standard Authorization: Bearer header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7); // Remove 'Bearer ' prefix
  }

  // Fall back to custom apiKey header (for tests and backwards compatibility)
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

