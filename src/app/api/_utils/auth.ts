/**
 * Authentication and workspace utilities for API routes.
 *
 * Provides helpers for extracting API keys from requests using
 * session-based auth or header-based auth (for testing/backwards compatibility).
 * Also provides workspace context resolution (personal vs org).
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/user/user';

/**
 * Get API key from request.
 * Tries session first, falls back to apiKey header for backwards compatibility.
 *
 * @param request - The incoming NextRequest
 * @returns API key string or null if not authenticated
 */
export async function getApiKeyFromRequest(request: NextRequest): Promise<string | null> {
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

/**
 * Handle Orchestra API errors and return appropriate NextResponse.
 *
 * @param error - The error object from Orchestra client
 * @param response - The response object from Orchestra client
 * @returns NextResponse with appropriate status and error details
 */
export function handleOrchestraError(error: unknown, response: Response): NextResponse {
  return NextResponse.json(error || { error: 'Unknown error' }, {
    status: response.status,
  });
}

// =============================================================================
// Workspace Context
// =============================================================================

/**
 * Describes the current billing context based on the active workspace.
 *
 * - `type === 'personal'`: the user's own billing account.
 * - `type === 'organization'`: an organization's billing account.
 */
export interface WorkspaceBillingContext {
  type: 'personal' | 'organization';
  userId: string;
  organizationId?: number;
}

/**
 * Resolves the billing-relevant workspace context from the session cookie.
 *
 * Reads `unify_workspace_id` to determine whether the user is operating
 * in a personal or organization workspace, and returns identifiers needed
 * for admin API calls that accept `user_id` or `organization_id`.
 *
 * @returns WorkspaceBillingContext or null if the user is not authenticated.
 */
export async function getWorkspaceBillingContext(): Promise<WorkspaceBillingContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get('unify_workspace_id')?.value;

  if (workspaceId && workspaceId !== 'personal') {
    // Validate the user is a member of this organization
    const org = user.organizations?.find((o: any) => o.id?.toString() === workspaceId);
    if (org) {
      return {
        type: 'organization',
        userId: user.id,
        organizationId: org.id,
      };
    }
  }

  return {
    type: 'personal',
    userId: user.id,
  };
}
