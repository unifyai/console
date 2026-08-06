import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFunctionsCatalog } from '@/hooks/Assistants/useFunctionsCatalog';
import { functionSubContextsForKind, listFunctionsFederatedPage } from '@/lib/client/functions';
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

interface FederatedItem {
  entries: Record<string, unknown>;
  source: string;
}

function federatedResponse(items: FederatedItem[], count = items.length) {
  return new Response(
    JSON.stringify({
      logs: items.map(({ entries, source }) => ({
        entries: {
          ...entries,
          _federatedSource: source,
          _federatedContext: source,
        },
      })),
      count,
      counts: {},
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function learnedItem(name: string): FederatedItem {
  return { entries: functionLog(name), source: 'personal:Compositional' };
}

function primitiveItem(name: string): FederatedItem {
  return {
    entries: functionLog(name, { is_primitive: true }),
    source: 'personal:Primitives',
  };
}

function requestBody(call: unknown[]): Record<string, unknown> {
  const init = call[1] as RequestInit;
  return JSON.parse(String(init.body));
}

let assistantSeq = 0;

/** Fresh identity per test so the module-level tab-data cache cannot leak. */
function makeAssistant(): Assistant {
  assistantSeq += 1;
  return {
    agentId: 2103,
    userId: `user-${assistantSeq}`,
    organizationId: null,
    teamIds: [7],
  } as unknown as Assistant;
}

const assistant = makeAssistant();

describe('functionSubContextsForKind', () => {
  it('maps kind filters to FunctionManager sub-contexts', () => {
    expect(functionSubContextsForKind('Learned')).toEqual(['Compositional']);
    expect(functionSubContextsForKind('Primitives')).toEqual(['Primitives']);
    expect(functionSubContextsForKind('All')).toEqual(['Compositional', 'Primitives']);
  });
});

describe('listFunctionsFederatedPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends one federated request spanning every root and sub-context', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValue(federatedResponse([learnedItem('learned_fn')], 93));

    const page = await listFunctionsFederatedPage({
      assistant,
      kind: 'All',
      roots: [{ kind: 'personal' }, { kind: 'team', teamId: 7 }],
      limit: 50,
      offset: 0,
    });

    expect(page.rows).toHaveLength(1);
    expect(page.count).toBe(93);
    expect(page.hasMore).toBe(true);
    expect((page.rows[0] as Record<string, unknown>)._table).toBe('Compositional');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe('/api/logs/federated');
    const body = requestBody(fetchSpy.mock.calls[0]);
    const contexts = body.contexts as Array<{ context: string; source: string }>;
    expect(contexts.map((spec) => spec.context)).toEqual([
      `${assistant.userId}/${assistant.agentId}/Functions/Compositional`,
      `${assistant.userId}/${assistant.agentId}/Functions/Primitives`,
      'Teams/7/Functions/Compositional',
      'Teams/7/Functions/Primitives',
    ]);
    expect(body.sorting).toEqual([{ field: 'name', direction: 'ascending' }]);
    const fromFields = contexts[0] as unknown as { fromFields: string[] };
    expect(fromFields.fromFields).toContain('function_id');
    expect(fromFields.fromFields.join(',')).not.toContain('embedding');
  });

  it('reports no more rows when the window covers the total', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      federatedResponse(
        Array.from({ length: 43 }, (_, index) => learnedItem(`learned_${index}`)),
        93
      )
    );

    const page = await listFunctionsFederatedPage({
      assistant,
      kind: 'Learned',
      roots: [{ kind: 'personal' }],
      limit: 50,
      offset: 50,
    });

    expect(page.hasMore).toBe(false);
  });
});

describe('useFunctionsCatalog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads Learned functions with the exact federated total', async () => {
    const a = makeAssistant();
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      federatedResponse(
        Array.from({ length: 50 }, (_, index) => learnedItem(`learned_${index}`)),
        93
      )
    );

    const { result } = renderHook(() =>
      useFunctionsCatalog({ assistant: a, kind: 'Learned', root: { kind: 'personal' } })
    );

    await waitFor(() => expect(result.current.functions).toHaveLength(50));
    expect(result.current.total).toBe(93);
    expect(result.current.hasMore).toBe(true);
    const body = requestBody(fetchSpy.mock.calls[0]);
    const contexts = body.contexts as Array<{ context: string }>;
    expect(contexts).toHaveLength(1);
    expect(contexts[0].context).toContain('Functions/Compositional');
  });

  it('loads additional pages through a single merged cursor', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String((init as RequestInit).body)) as { offset: number };
      const items =
        body.offset === 0
          ? Array.from({ length: 50 }, (_, index) => primitiveItem(`primitive_${index}`))
          : [primitiveItem('primitive_50')];
      return federatedResponse(items, 51);
    });

    const a = makeAssistant();
    const { result } = renderHook(() =>
      useFunctionsCatalog({ assistant: a, kind: 'Primitives', root: { kind: 'personal' } })
    );

    await waitFor(() => expect(result.current.functions).toHaveLength(50));
    expect(result.current.total).toBe(51);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => expect(result.current.functions).toHaveLength(51));
    expect(result.current.hasMore).toBe(false);
    const offsets = fetchSpy.mock.calls.map((call) => requestBody(call).offset);
    expect(offsets).toEqual([0, 50]);
  });

  it('spans personal and team roots when no root override is given', async () => {
    const a = makeAssistant();
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValue(
        federatedResponse([learnedItem('learned_a'), primitiveItem('primitives.a')], 2)
      );

    const { result } = renderHook(() => useFunctionsCatalog({ assistant: a, kind: 'All' }));

    await waitFor(() => expect(result.current.functions).toHaveLength(2));
    expect(result.current.total).toBe(2);
    const body = requestBody(fetchSpy.mock.calls[0]);
    const contexts = body.contexts as Array<{ context: string }>;
    expect(contexts.map((spec) => spec.context)).toEqual([
      `${a.userId}/${a.agentId}/Functions/Compositional`,
      `${a.userId}/${a.agentId}/Functions/Primitives`,
      'Teams/7/Functions/Compositional',
      'Teams/7/Functions/Primitives',
    ]);
  });

  it('refetches when kind changes', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String((init as RequestInit).body)) as {
        contexts: Array<{ context: string }>;
      };
      const hasPrimitives = body.contexts.some((spec) =>
        spec.context.includes('Functions/Primitives')
      );
      const hasCompositional = body.contexts.some((spec) =>
        spec.context.includes('Functions/Compositional')
      );
      const items: FederatedItem[] = [];
      if (hasCompositional) items.push(learnedItem('learned_a'), learnedItem('learned_b'));
      if (hasPrimitives) {
        items.push(
          primitiveItem('primitives.a'),
          primitiveItem('primitives.b'),
          primitiveItem('primitives.c')
        );
      }
      return federatedResponse(items);
    });

    const a = makeAssistant();
    const { result, rerender } = renderHook(
      ({ kind }: { kind: FunctionKindFilter }) =>
        useFunctionsCatalog({ assistant: a, kind, root: { kind: 'personal' } }),
      { initialProps: { kind: 'Learned' as FunctionKindFilter } }
    );

    await waitFor(() => expect(result.current.functions).toHaveLength(2));
    expect(result.current.total).toBe(2);

    rerender({ kind: 'All' });

    await waitFor(() => expect(result.current.functions).toHaveLength(5));
    expect(result.current.total).toBe(5);
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not fetch when disabled', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch');

    const a = makeAssistant();
    const { result } = renderHook(() =>
      useFunctionsCatalog({ assistant: a, kind: 'All', enabled: false })
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(false));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('tracks exact totals for filtered searches', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String((init as RequestInit).body)) as {
        offset: number;
        filter?: string;
      };
      expect(body.filter).toBeTruthy();
      const items =
        body.offset === 0
          ? Array.from({ length: 50 }, (_, index) =>
              primitiveItem(`primitives.integrations.gmail.${index}`)
            )
          : Array.from({ length: 13 }, (_, index) =>
              primitiveItem(`primitives.integrations.gmail.${50 + index}`)
            );
      return federatedResponse(items, 63);
    });

    const a = makeAssistant();
    const { result } = renderHook(() =>
      useFunctionsCatalog({
        assistant: a,
        kind: 'Primitives',
        root: { kind: 'personal' },
        query: 'primitives.integrations.gmail',
      })
    );

    await waitFor(() => expect(result.current.functions).toHaveLength(50));
    expect(result.current.total).toBe(63);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => expect(result.current.functions).toHaveLength(63));
    expect(result.current.total).toBe(63);
    expect(result.current.hasMore).toBe(false);
  });
});
