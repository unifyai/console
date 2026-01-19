const ENABLED = process.env.NEXT_PUBLIC_DEBUG_PERF_TELEMETRY === 'true';

export type PerfToken = { k: string; t: number } | null;

export function perfStart(key: string): PerfToken {
  if (!ENABLED || typeof performance === 'undefined') return null;
  return { k: key, t: performance.now() };
}

export function perfEnd(token: PerfToken, extra?: Record<string, any>) {
  if (!ENABLED || !token || typeof performance === 'undefined') return;
  const dt = performance.now() - token.t;
  const payload = { key: token.k, ms: Number(dt.toFixed(2)), ...extra } as any;
  try {
    // Prefer a single structured line for easy parsing
    console.log('[perf]', JSON.stringify(payload));
  } catch {
    console.log('[perf]', payload);
  }
}
