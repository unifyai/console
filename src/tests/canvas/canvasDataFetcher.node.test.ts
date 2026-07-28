/**
 * Client-side binding fetcher.
 *
 * Two properties, and they pull in opposite directions: concurrent requests for
 * the same alias must share one call, and a settled one must not be reused. Get
 * the first wrong and a mount issues duplicate queries; get the second wrong and
 * a live tracker silently becomes a snapshot for the lifetime of the tab.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { canvasDataResolver, fetchCanvasRows } from '@/lib/client/canvasData';

const TOKEN = 'canvas_tok01';

function ok(rows: unknown[], truncated = false) {
  return new Response(JSON.stringify({ rows, truncated }), { status: 200 });
}

/**
 * Stub fetch with a factory rather than a fixed value.
 *
 * A `Response` body can only be read once, so `mockResolvedValue(ok(...))` hands
 * every call the same already-consumed body — a test artifact that looks exactly
 * like a bug in the fetcher.
 */
function stub(make: () => Response) {
  return vi.spyOn(global, 'fetch').mockImplementation(async () => make());
}

describe('fetchCanvasRows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the rows and the truncation flag', async () => {
    stub(() => ok([{ a: 1 }], true));

    await expect(fetchCanvasRows(TOKEN, 'tasks')).resolves.toEqual({
      rows: [{ a: 1 }],
      truncated: true,
    });
  });

  it('sends only the alias', async () => {
    const fetchSpy = stub(() => ok([]));

    await fetchCanvasRows(TOKEN, 'tasks');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(`/api/canvas/${TOKEN}/query`);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ alias: 'tasks' });
  });

  it('shares one request between concurrent callers', async () => {
    // The host asks for every declared alias on mount, and React can mount a
    // frame twice in development.
    const fetchSpy = stub(() => ok([{ a: 1 }]));

    const [first, second] = await Promise.all([
      fetchCanvasRows(TOKEN, 'tasks'),
      fetchCanvasRows(TOKEN, 'tasks'),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('does not reuse a settled request', async () => {
    // Bindings re-run on every view; that is what makes a canvas live.
    const fetchSpy = stub(() => ok([{ a: 1 }]));

    await fetchCanvasRows(TOKEN, 'tasks');
    await fetchCanvasRows(TOKEN, 'tasks');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps different aliases and different canvases apart', async () => {
    const fetchSpy = stub(() => ok([]));

    await Promise.all([
      fetchCanvasRows(TOKEN, 'tasks'),
      fetchCanvasRows(TOKEN, 'people'),
      fetchCanvasRows('other_tok01', 'tasks'),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('rejects with the message the server gave', async () => {
    // The frame renders this inside the canvas, so it has to be the real reason.
    stub(
      () =>
        new Response(JSON.stringify({ error: "Canvas declares no binding named 'ghost'" }), {
          status: 404,
        })
    );

    await expect(fetchCanvasRows(TOKEN, 'ghost')).rejects.toThrow(
      "Canvas declares no binding named 'ghost'"
    );
  });

  it('still rejects when the error body is not JSON', async () => {
    stub(() => new Response('gateway timeout', { status: 504 }));

    await expect(fetchCanvasRows(TOKEN, 'tasks')).rejects.toThrow("Failed to load 'tasks'");
  });

  it('a failed request does not poison the next one', async () => {
    let call = 0;
    const fetchSpy = stub(() =>
      call++ === 0 ? new Response('nope', { status: 500 }) : ok([{ a: 1 }])
    );

    await expect(fetchCanvasRows(TOKEN, 'tasks')).rejects.toThrow();
    await expect(fetchCanvasRows(TOKEN, 'tasks')).resolves.toEqual({
      rows: [{ a: 1 }],
      truncated: false,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('canvasDataResolver', () => {
  it('binds a token so the frame passes only an alias', async () => {
    const fetchSpy = stub(() => ok([{ a: 1 }]));

    const resolve = canvasDataResolver(TOKEN);
    await resolve('tasks');

    expect(String(fetchSpy.mock.calls[0][0])).toContain(TOKEN);
  });
});
