import { NextRequest, NextResponse } from "next/server";
import { getApiKeyFromRequest } from "./getApiKey";

/**
 * Helper to extract and validate API key from request.
 * Returns the API key if valid, or a 401 error response if missing.
 * 
 * Usage:
 * ```ts
 * const apiKeyOrError = await requireApiKey(request);
 * if (apiKeyOrError instanceof NextResponse) return apiKeyOrError; // Auth failed
 * const apiKey = apiKeyOrError; // Auth succeeded
 * ```
 */
export async function requireApiKey(request: NextRequest): Promise<string | NextResponse> {
  const apiKey = await getApiKeyFromRequest(request);
  
  if (!apiKey) {
    console.error('[requireApiKey] ❌ Rejecting request - No authentication');
    return NextResponse.json({ 
      detail: "Authentication required. Your session has expired. Please log in again.",
      code: "AUTH_REQUIRED",
      action: "REDIRECT_TO_LOGIN"
    }, { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="Unify Console"'
      }
    });
  }
  
  return apiKey;
}

