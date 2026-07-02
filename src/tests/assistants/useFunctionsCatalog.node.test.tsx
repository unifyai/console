import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFunctionsCatalog } from '@/hooks/Assistants/useFunctionsCatalog';
import {
  functionSubContextsForKind,
  listFunctionsPage,
  resolveFunctionsCatalogTotal,
} from '@/lib/client/functions';
import type { FunctionKindFilter } from '@/utils/assistants/functions';
import type { Assistant } from '@/types/assistants/assistant';

function functionLog(name: string, overrides: Record<string, unknown> = {}) {
  return {
    function_id: name,
    name,
    language: 'python',
    argspec: '() -> None',
    docstring: `Doc for ${name}`,
    is_primitive: name.startsWith('primitives.'),
    ...overrides,
  };
}

function functionsLogsResponse(
  subContext: string,
  items: Array<Record<string, unknown>>,
  count = items.length
) {
  return new Response(
    JSON.stringify({
      logs: items.map((entries) => ({ entries })),
      count,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

const assistant = {
  agentId: 2103,
  userId: '0951a71f-0c5a-4858-a980-e173b13c64c4',
  organizationId: null,
} as unknown as Assistant;

describe('functionSubContextsForKind', () => {
  it('maps kind filters to FunctionManager sub-contexts', () => {
    expect(functionSubContextsForKind('Learned')).toEqual(['Compositional']);
    expect(functionSubContextsForKind('Primitives')).toEqual(['Primitives']);
    expect(functionSubContextsForKind('All')).toEqual(['Compositional', 'Primitives']);
  });
});

describe('listFunctionsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requests public fields only and parses inline count', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValue(functionsLogsResponse('Compositional', [functionLog('learned_fn')], 93));

    const page = await listFunctionsPage({
      assistant,
      subContext: 'Compositional',
      limit: 50,
      offset: 0,
    });

    expect(page.rows).toHaveLength(1);
    expect(page.count).toBe(93);
    expect(page.hasMore).toBe(false);
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('/api/logs?');
    expect(url).toContain('Functions%2FCompositional');
    expect(url).toContain('fromFields=');
    expect(url).toContain('function_id');
    expect(url).not.toContain('embedding');
  });

  it('treats a full page as having more rows even when inline count matches page size', async () => {
    const items = Array.from({ length: 50 }, (_, index) => functionLog(`learned_${index}`));
    vi.spyOn(window, 'fetch').mockResolvedValue(functionsLogsResponse('Compositional', items, 50));

    const page = await listFunctionsPage({
      assistant,
      subContext: 'Compositional',
      limit: 50,
      offset: 0,
    });

    expect(page.rows).toHaveLength(50);
    expect(page.count).toBe(50);
    expect(page.hasMore).toBe(true);
  });

  it('stops when the final page is short', async () => {
    const items = Array.from({ length: 43 }, (_, index) => functionLog(`learned_${index}`));
    vi.spyOn(window, 'fetch').mockResolvedValue(functionsLogsResponse('Compositional', items, 93));

    const page = await listFunctionsPage({
      assistant,
      subContext: 'Compositional',
      limit: 50,
      offset: 50,
    });

    expect(page.hasMore).toBe(false);
  });
});

describe('resolveFunctionsCatalogTotal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sums count metrics across sub-contexts for All', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs/count')) {
        if (url.includes('Functions%2FCompositional')) {
          return new Response(JSON.stringify({ name: 93 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('Functions%2FPrimitives')) {
          return new Response(JSON.stringify({ name: 201 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response('{}', { status: 404 });
    });

    const total = await resolveFunctionsCatalogTotal({ assistant, kind: 'All' });
    expect(total).toBe(294);
    expect(
      fetchSpy.mock.calls.filter(([input]) => String(input).startsWith('/api/logs/count'))
    ).toHaveLength(2);
  });

  it('uses inline list counts when searching (no metric call)', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return functionsLogsResponse('Compositional', [functionLog('search_hit')], 1);
      }
      return new Response('{}', { status: 404 });
    });

    const total = await resolveFunctionsCatalogTotal({
      assistant,
      kind: 'Learned',
      filterExpr: 'name.lower().contains("search")',
    });
    expect(total).toBe(1);
    expect(fetchSpy.mock.calls.some(([input]) => String(input).startsWith('/api/logs/count'))).toBe(
      false
    );
  });
});

describe('useFunctionsCatalog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads Learned functions with metric-backed total', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs/count')) {
        return new Response(JSON.stringify({ name: 93 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/logs?') && url.includes('Functions%2FCompositional')) {
        return functionsLogsResponse(
          'Compositional',
          Array.from({ length: 50 }, (_, index) => functionLog(`learned_${index}`)),
          93
        );
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useFunctionsCatalog({ assistant, kind: 'Learned' }));

    await waitFor(() => expect(result.current.skills).toHaveLength(50));
    expect(result.current.total).toBe(93);
    expect(result.current.hasMore).toBe(true);
    expect(
      fetchSpy.mock.calls.some(
        ([input]) =>
          String(input).startsWith('/api/logs?') &&
          String(input).includes('Functions%2FCompositional')
      )
    ).toBe(true);
    expect(
      fetchSpy.mock.calls.some(
        ([input]) =>
          String(input).startsWith('/api/logs?') && String(input).includes('Functions%2FPrimitives')
      )
    ).toBe(false);
  });

  it('loads additional pages with limit and offset', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs/count')) {
        return new Response(JSON.stringify({ name: 51 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/logs?') && url.includes('Functions%2FPrimitives')) {
        const params = new URL(url, window.location.origin).searchParams;
        const offset = Number(params.get('offset') ?? 0);
        const items =
          offset === 0
            ? Array.from({ length: 50 }, (_, index) =>
                functionLog(`primitive_${index}`, { is_primitive: true })
              )
            : [functionLog('primitive_50', { is_primitive: true })];
        return functionsLogsResponse('Primitives', items, 51);
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useFunctionsCatalog({ assistant, kind: 'Primitives' }));

    await waitFor(() => expect(result.current.skills).toHaveLength(50));
    expect(result.current.total).toBe(51);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => expect(result.current.skills).toHaveLength(51));
    expect(result.current.hasMore).toBe(false);
    expect(
      fetchSpy.mock.calls.some(
        ([input]) =>
          String(input).startsWith('/api/logs?') &&
          String(input).includes('Functions%2FPrimitives') &&
          String(input).includes('offset=50')
      )
    ).toBe(true);
  });

  it('refetches when kind changes and sums totals for All', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs/count')) {
        if (url.includes('Functions%2FCompositional')) {
          return new Response(JSON.stringify({ name: 2 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('Functions%2FPrimitives')) {
          return new Response(JSON.stringify({ name: 3 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      if (url.startsWith('/api/logs?')) {
        if (url.includes('Functions%2FCompositional')) {
          return functionsLogsResponse(
            'Compositional',
            [functionLog('learned_a'), functionLog('learned_b')],
            2
          );
        }
        if (url.includes('Functions%2FPrimitives')) {
          return functionsLogsResponse(
            'Primitives',
            [
              functionLog('primitives.a', { is_primitive: true }),
              functionLog('primitives.b', { is_primitive: true }),
              functionLog('primitives.c', { is_primitive: true }),
            ],
            3
          );
        }
      }
      return new Response('{}', { status: 404 });
    });

    const { result, rerender } = renderHook(
      ({ kind }: { kind: FunctionKindFilter }) => useFunctionsCatalog({ assistant, kind }),
      { initialProps: { kind: 'Learned' as FunctionKindFilter } }
    );

    await waitFor(() => expect(result.current.skills).toHaveLength(2));
    expect(result.current.total).toBe(2);

    rerender({ kind: 'All' });

    await waitFor(() => expect(result.current.skills).toHaveLength(5));
    expect(result.current.total).toBe(5);
    expect(
      fetchSpy.mock.calls.filter(
        ([input]) =>
          String(input).startsWith('/api/logs?') && String(input).includes('Functions%2FPrimitives')
      ).length
    ).toBeGreaterThan(0);
  });

  it('does not fetch when disabled', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch');

    const { result } = renderHook(() =>
      useFunctionsCatalog({ assistant, kind: 'All', enabled: false })
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(false));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps search totals in sync when inline count understates paginated results', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?') && url.includes('Functions%2FPrimitives')) {
        const params = new URL(url, window.location.origin).searchParams;
        const offset = Number(params.get('offset') ?? 0);
        const items =
          offset === 0
            ? Array.from({ length: 50 }, (_, index) =>
                functionLog(`primitives.integrations.gmail.${index}`, { is_primitive: true })
              )
            : Array.from({ length: 13 }, (_, index) =>
                functionLog(`primitives.integrations.gmail.${50 + index}`, { is_primitive: true })
              );
        return functionsLogsResponse('Primitives', items, 50);
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() =>
      useFunctionsCatalog({
        assistant,
        kind: 'Primitives',
        query: 'primitives.integrations.gmail',
      })
    );

    await waitFor(() => expect(result.current.skills).toHaveLength(50));
    expect(result.current.total).toBe(50);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => expect(result.current.skills).toHaveLength(63));
    expect(result.current.total).toBe(63);
    expect(result.current.hasMore).toBe(false);
  });
});
