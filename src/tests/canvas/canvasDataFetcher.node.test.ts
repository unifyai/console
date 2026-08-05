/**
 * Client-side binding fetcher.
 *
 * Three properties, and they pull in different directions: aliases requested in
 * the same window must travel as one batch, concurrent requests for the same
 * alias must share one call, and a settled one must not be reused. Get the
 * first wrong and every panel pays its own round trip; get the second wrong and
 * a mount issues duplicate queries; get the third wrong and a live tracker
 * silently becomes a snapshot for the lifetime of the tab.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { canvasDataResolver, fetchCanvasRows } from '@/lib/client/canvasData';

const TOKEN = 'canvas_tok01';

type AliasResult = { rows?: unknown[]; truncated?: boolean; error?: string };

function batchOk(results: Record<string, AliasResult>) {
  return new Response(JSON.stringify({ results }), { status: 200 });
}

/**
 * Stub fetch with a factory rather than a fixed value.
 *
 * A `Response` body can only be read once, so `mockResolvedValue(ok(...))` hands
 * every call the same already-consumed body — a test artifact that looks exactly
 * like a bug in the fetcher.
 */
function stub(make: (body: string) => Response) {
  return vi
    .spyOn(global, 'fetch')
    .mockImplementation(async (_url, init) => make(String((init as RequestInit).body)));
}

/** Every alias the request asked for, answered with the same rows. */
function echo(rows: unknown[], truncated = false) {
  return (body: string) => {
    const { aliases } = JSON.parse(body) as { aliases: string[] };
    return batchOk(Object.fromEntries(aliases.map((alias) => [alias, { rows, truncated }])));
  };
}

describe('fetchCanvasRows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the rows and the truncation flag', async () => {
    stub(echo([{ a: 1 }], true));

    await expect(fetchCanvasRows(TOKEN, 'tasks')).resolves.toEqual({
      rows: [{ a: 1 }],
      truncated: true,
    });
  });

  it('sends only aliases', async () => {
    const fetchSpy = stub(echo([]));

    await fetchCanvasRows(TOKEN, 'tasks');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(`/api/canvas/${TOKEN}/query`);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ aliases: ['tasks'] });
  });

  it('batches aliases requested in the same window into one call', async () => {
    // The host asks for every declared alias on mount, each arriving as its own
    // message event. One canvas view should cost one request pair, not one per
    // panel.
    const fetchSpy = stub(echo([{ a: 1 }]));

    const [tasks, people] = await Promise.all([
      fetchCanvasRows(TOKEN, 'tasks'),
      fetchCanvasRows(TOKEN, 'people'),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body)).aliases).toEqual([
      'tasks',
      'people',
    ]);
    expect(tasks).toEqual(people);
  });

  it('shares one request between concurrent callers', async () => {
    // React can mount a frame twice in development.
    const fetchSpy = stub(echo([{ a: 1 }]));

    const [first, second] = await Promise.all([
      fetchCanvasRows(TOKEN, 'tasks'),
      fetchCanvasRows(TOKEN, 'tasks'),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('does not reuse a settled request', async () => {
    // Bindings re-run on every view; that is what makes a canvas live.
    const fetchSpy = stub(echo([{ a: 1 }]));

    await fetchCanvasRows(TOKEN, 'tasks');
    await fetchCanvasRows(TOKEN, 'tasks');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps different canvases in different batches', async () => {
    const fetchSpy = stub(echo([]));

    await Promise.all([fetchCanvasRows(TOKEN, 'tasks'), fetchCanvasRows('other_tok01', 'tasks')]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects one alias with its own error without touching the others', async () => {
    // The frame renders this inside the panel that asked, so it has to be the
    // real reason — and the healthy panel next to it must still get its rows.
    stub((body) => {
      const { aliases } = JSON.parse(body) as { aliases: string[] };
      expect(aliases).toEqual(['tasks', 'ghost']);
      return batchOk({
        tasks: { rows: [{ a: 1 }] },
        ghost: { error: "Canvas declares no binding named 'ghost'" },
      });
    });

    const [tasks, ghost] = await Promise.allSettled([
      fetchCanvasRows(TOKEN, 'tasks'),
      fetchCanvasRows(TOKEN, 'ghost'),
    ]);

    expect(tasks).toEqual({
      status: 'fulfilled',
      value: { rows: [{ a: 1 }], truncated: false },
    });
    expect(ghost.status).toBe('rejected');
    expect((ghost as PromiseRejectedResult).reason.message).toBe(
      "Canvas declares no binding named 'ghost'"
    );
  });

  it('rejects with the message the server gave on a whole-request failure', async () => {
    stub(
      () =>
        new Response(JSON.stringify({ error: 'Canvas is not published' }), {
          status: 403,
        })
    );

    await expect(fetchCanvasRows(TOKEN, 'tasks')).rejects.toThrow('Canvas is not published');
  });

  it('still rejects when the error body is not JSON', async () => {
    stub(() => new Response('gateway timeout', { status: 504 }));

    await expect(fetchCanvasRows(TOKEN, 'tasks')).rejects.toThrow('Failed to load canvas data');
  });

  it('rejects an alias the response left unanswered', async () => {
    stub(() => batchOk({}));

    await expect(fetchCanvasRows(TOKEN, 'tasks')).rejects.toThrow("Failed to load 'tasks'");
  });

  it('a failed request does not poison the next one', async () => {
    let call = 0;
    const fetchSpy = stub((body) =>
      call++ === 0 ? new Response('nope', { status: 500 }) : echo([{ a: 1 }])(body)
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
    const fetchSpy = stub(echo([{ a: 1 }]));

    const resolve = canvasDataResolver(TOKEN);
    await resolve('tasks');

    expect(String(fetchSpy.mock.calls[0][0])).toContain(TOKEN);
  });
});
