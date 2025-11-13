import { NextRequest } from "next/server";
import { readConsoleCookie, createConsoleCookie } from "@/lib/auth/consoleCookie";
import { getUserByEmail, getSession } from "@/lib/user/user";

/**
 * Resolve Orchestra apiKey for internal API routes.
 * Order:
 * 1) Header 'apiKey' if provided (internal calls)
 * 2) HttpOnly console_auth cookie -> resolve via server session/DB
 * 3) If cookie expired, try to refresh from NextAuth session
 * 
 * Returns null when authentication fails - callers MUST check for null
 * and return 401 Unauthorized with a clear error message.
 */
export async function getApiKeyFromRequest(req: NextRequest): Promise<string | null> {
  const headerKey = req.headers.get("apiKey");
  if (headerKey) {
    console.log('[getApiKeyFromRequest] Using header API key');
    return headerKey;
  }
  
  const claims = readConsoleCookie();
  if (claims?.apiKey) {
    console.log('[getApiKeyFromRequest] Using cookie API key');
    return claims.apiKey;
  }
  
  // Cookie expired or missing - try to refresh from NextAuth session
  console.log('[getApiKeyFromRequest] Cookie expired/missing - attempting session refresh');
  
  try {
    const session = await getSession();
    if (session?.user?.email) {
      console.log('[getApiKeyFromRequest] Valid NextAuth session found, fetching API key');
      const user = await getUserByEmail(session.user.email);
      
      if (user?.apiKey) {
        console.log('[getApiKeyFromRequest] ✅ Refreshing cookie with fresh API key');
        // Refresh the cookie for next request
        createConsoleCookie(session.user.email, user.apiKey);
        return user.apiKey;
      }
      
      console.warn(`[getApiKeyFromRequest] Session valid but no API key for user: ${session.user.email}`);
    } else {
      console.warn('[getApiKeyFromRequest] No valid NextAuth session');
    }
  } catch (e) {
    console.error('[getApiKeyFromRequest] Failed to refresh from session:', e);
  }
  
  console.error('[getApiKeyFromRequest] ❌ AUTH FAILED - No valid session or API key. User needs to log in.');
  return null;
}


