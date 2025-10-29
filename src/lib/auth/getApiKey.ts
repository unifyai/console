import { NextRequest } from "next/server";
import { readConsoleCookie } from "@/lib/auth/consoleCookie";
import { getUserByEmail } from "@/lib/user/user";

/**
 * Resolve Orchestra apiKey for internal API routes.
 * Order:
 * 1) Header 'apiKey' if provided (internal calls)
 * 2) HttpOnly console_auth cookie -> resolve via server session/DB
 * Returns empty string when unavailable.
 */
export async function getApiKeyFromRequest(req: NextRequest): Promise<string> {
  const headerKey = req.headers.get("apiKey");
  if (headerKey) return headerKey;
  const claims = readConsoleCookie();
  if (claims?.apiKey) return claims.apiKey;
  if (claims?.email) {
    try {
      const user = await getUserByEmail(claims.email);
      return user?.apiKey ?? "";
    } catch {
      return "";
    }
  }
  return "";
}


