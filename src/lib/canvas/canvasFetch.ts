/**
 * The single outbound seam for canvas server-side reads.
 *
 * Canvas talks to Orchestra through two surfaces that the generated client does not
 * cover: the admin token plane, which it calls as the platform rather than as the
 * viewer, and the logs API, which it calls with the canvas owner's key. Both are
 * plain `fetch`, so neither passes through the Orchestra client's simulation seam.
 *
 * Routing them here keeps interception at the data boundary — the principle the
 * simulation module is built on — so no canvas route or component has to know
 * whether it is running on fixtures.
 *
 * Server-only.
 */

import { mockSimulationEnabled } from '@/lib/simulation/config';

/** Requests that outlive a hung backend rather than holding a route open. */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Fetch from Orchestra, or from the simulation dispatcher when mock mode is on.
 *
 * The dispatcher is imported lazily so it stays out of the module graph entirely
 * in real builds.
 */
export async function canvasFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (mockSimulationEnabled()) {
    const { simulationFetch } = await import('@/lib/simulation/dispatch');
    return simulationFetch(url, init);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
}
