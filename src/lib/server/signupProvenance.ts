import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

/**
 * Where a signup came from, as observed on the browser's request.
 *
 * Orchestra cannot work this out for itself. Every signup reaches it
 * through this server on an admin-key endpoint, so the request it sees
 * describes Console: one constant HTTP client user agent on every
 * signup, and this service's egress IP. Recording that does not weaken
 * the abuse signal so much as invert it, collecting every account into
 * a single shared origin. So the browser's values travel explicitly in
 * the request body, and this is the only place they are read.
 *
 * The IP is advisory. The left-most forwarded hop is supplied by the
 * caller, so a determined signer can choose what is recorded against
 * them; it separates ordinary users from each other, not a motivated
 * farmer from anyone.
 */
export type SignupProvenance = {
  signupIp: string | null;
  signupUserAgent: string | null;
};

const LOOPBACK = new Set(['127.0.0.1', '::1']);

function pickIp(get: (name: string) => string | null | undefined): string | null {
  const candidates = [
    get('cf-connecting-ip'),
    get('x-real-ip'),
    get('x-forwarded-for')?.split(',')[0]?.trim(),
  ];
  for (const ip of candidates) {
    if (ip && !LOOPBACK.has(ip)) return ip;
  }
  return null;
}

/** Provenance from a route handler that already holds the request. */
export function signupProvenanceFrom(request: NextRequest): SignupProvenance {
  return {
    signupIp: pickIp((name) => request.headers.get(name)),
    signupUserAgent: request.headers.get('user-agent'),
  };
}

/**
 * Provenance for callers with no request in hand — next-auth's adapter,
 * which is invoked inside the handler but is passed only the user.
 *
 * `headers()` throws outside a request scope, which is how it behaves
 * under tests and any non-request caller. Nulls are the honest answer
 * there: Orchestra records nothing rather than something misleading.
 */
export async function signupProvenanceFromContext(): Promise<SignupProvenance> {
  try {
    const store = await headers();
    return {
      signupIp: pickIp((name) => store.get(name)),
      signupUserAgent: store.get('user-agent'),
    };
  } catch {
    return { signupIp: null, signupUserAgent: null };
  }
}
