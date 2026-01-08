type DedupKey = string;

const inflight = new Map<
  DedupKey,
  Promise<{ status: number; ok: boolean; headers: Record<string, string>; json: any }>
>();

function makeKey(url: string, method: string | undefined) {
  return `${(method || 'GET').toUpperCase()}:${url}`;
}

export async function dedupedJson(
  url: string,
  init?: RequestInit
): Promise<{ status: number; ok: boolean; headers: Record<string, string>; json: any }> {
  const key = makeKey(url, init?.method);
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const res = await fetch(url, init);
    const headers: Record<string, string> = {};
    try {
      // Capture a few useful headers
      const e = res.headers.get('ETag');
      if (e) headers['etag'] = e;
      const lm = res.headers.get('Last-Modified');
      if (lm) headers['last-modified'] = lm;
    } catch {}
    let json: any = null;
    if (res.status !== 304) {
      try {
        json = await res.json();
      } catch {
        json = null;
      }
    }
    return { status: res.status, ok: res.ok, headers, json };
  })();

  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}
