/**
 * Playwright global setup: warm the dev server's route compilation before any
 * spec runs.
 *
 * `next dev` compiles each route lazily on its first request, and the seed-user
 * lookup behind DevQuickLogin is slow on a cold process. Without warming, the
 * first spec of a run routinely eats the compilation cost and times out on
 * navigation or auth (a flake whose failure point moves run-to-run). Hitting the
 * shell routes once up front pays that cost a single time, before the timers in
 * any test start.
 *
 * Best-effort: warmup failures never fail the suite — a genuinely unreachable
 * server surfaces as a normal test failure with a clearer message.
 */
const WARMUP_ROUTES = ['/login', '/assistants', '/'];

async function warmRoute(baseURL: string, route: string): Promise<void> {
  const url = `${baseURL}${route}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    await fetch(url, { redirect: 'follow', signal: controller.signal });
  } catch {
    /* best effort — the route may redirect or briefly 5xx while compiling */
  } finally {
    clearTimeout(timeout);
  }
}

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  // Sequential, not parallel: a cold dev server compiling several routes at once
  // spikes memory on constrained machines, which is exactly what we're avoiding.
  for (const route of WARMUP_ROUTES) {
    await warmRoute(baseURL, route);
  }
}
