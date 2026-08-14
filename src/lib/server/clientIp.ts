import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

/**
 * The caller's address as the load balancer observed it.
 *
 * Orchestra cannot work this out for itself. Every auth call reaches it
 * through this server on an admin-key endpoint, so the request it sees
 * carries this service's egress address — the same one for every person
 * signing up. A rate limit keyed on that is not a limit on a caller but
 * a limit on the platform.
 *
 * The external load balancer in front of this service appends two hops
 * to whatever `x-forwarded-for` the caller supplied: the address it
 * accepted the connection from, then its own. The trustworthy value is
 * therefore second from the right, and everything to its left is text
 * the caller wrote.
 *
 * `signupProvenanceFrom` reads the left-most hop instead, which is the
 * right trade for a record only ever read by a human weighing a match.
 * It is the wrong one here: this value is a limit key, and a caller who
 * can choose their own key has no limit. Hence null rather than a
 * fallback to a supplied hop — declining to key is better than keying on
 * something forgeable, and Orchestra logs the absence.
 */

const LOOPBACK = new Set(['127.0.0.1', '::1']);

function appendedHop(forwardedFor: string | null | undefined): string | null {
  const hops = (forwardedFor ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);
  if (hops.length < 2) return null;
  const ip = hops[hops.length - 2];
  return LOOPBACK.has(ip) ? null : ip;
}

/** The caller's address from a route handler that holds the request. */
export function trustedClientIp(request: NextRequest): string | null {
  return appendedHop(request.headers.get('x-forwarded-for'));
}

/**
 * The caller's address for callers with no request in hand — next-auth's
 * authorize callback, which is invoked inside the handler but is passed
 * only the credentials.
 *
 * `headers()` throws outside a request scope, which is how it behaves
 * under tests and any non-request caller. Null is the honest answer
 * there, and Orchestra logs the absence rather than keying on a
 * placeholder.
 */
export async function trustedClientIpFromContext(): Promise<string | null> {
  try {
    const store = await headers();
    return appendedHop(store.get('x-forwarded-for'));
  } catch {
    return null;
  }
}
