import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useListInterfacesQuery,
  useGetInterfaceQuery,
  useGetInterfaceByIdQuery,
  useGetInterfaceWithTabsQuery,
  useGetInterfaceUnifiedQuery,
} from '@/hooks/Interfaces/Query/useInterfacesQuery';
import type { GranularInterfaceActions, InterfaceData } from '@/types/interfaces/grid';

// Mock fetch - useListInterfacesQuery now uses dedupedJson which calls fetch directly
const mockFetch = vi.fn();

// Helper to create mock fetch response with proper headers
const createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => (name === 'etag' ? 'mock-etag' : null) },
  json: async () => data,
});

const mockInterface: InterfaceData = {
  id: 'interface-1',
  name: 'Main Interface',
  projectId: 'project-1',
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const createWrapper = (qc: QueryClient): React.FC<{ children: React.ReactNode }> => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('Interfaces query hooks (integration-style)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('useListInterfacesQuery calls API route when projectId is set and is disabled when projectId is null', async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    // Mock fetch to return interfaces
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/interface')) {
        return createMockResponse([{ ...mockInterface, projectId: 'project-1' }]);
      }
      return createMockResponse({}, 404);
    });

    const actions = {
      list: vi.fn(), // Not used - hook uses direct fetch
    } as unknown as GranularInterfaceActions;

    const { result, rerender } = renderHook(
      ({ projectId }) => useListInterfacesQuery(projectId, actions),
      { initialProps: { projectId: 'project-1' as string | null }, wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].name).toBe('Main Interface');
    });

    // Verify fetch was called instead of actions.list
    expect(mockFetch).toHaveBeenCalled();
    expect(
      mockFetch.mock.calls.some((call: unknown[]) =>
        (call[0] as string).includes('/api/interface?projectName=project-1')
      )
    ).toBe(true);

    // When projectId becomes null, the query should be disabled and not refetch;
    // data stays undefined rather than becoming an empty array.
    rerender({ projectId: null });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  it('useGetInterfaceQuery calls getByName only when both projectId and name are provided', async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const getByName = vi.fn(async (projectId: string, name: string) => ({
      ...mockInterface,
      projectId: projectId,
      name,
    }));

    const actions = {
      getByName,
    } as unknown as GranularInterfaceActions;

    const { result, rerender } = renderHook(
      ({ projectId, name }) => useGetInterfaceQuery(projectId, name, actions),
      {
        initialProps: {
          projectId: 'project-1' as string | null,
          name: 'Main Interface' as string | null,
        },
        wrapper,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.name).toBe('Main Interface');
    });
    expect(getByName).toHaveBeenCalledTimes(1);
    expect(getByName).toHaveBeenCalledWith('project-1', 'Main Interface');

    // Disable by omitting name; data should remain undefined.
    rerender({ projectId: 'project-1', name: null });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  it('useGetInterfaceByIdQuery calls getById only when id is provided', async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const getById = vi.fn(async (id: string) => ({
      ...mockInterface,
      id,
    }));

    const actions = {
      getById,
    } as unknown as GranularInterfaceActions;

    const { result, rerender } = renderHook(({ id }) => useGetInterfaceByIdQuery(id, actions), {
      initialProps: { id: 'interface-1' as string | null },
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.id).toBe('interface-1');
    });

    expect(getById).toHaveBeenCalledTimes(1);
    expect(getById).toHaveBeenCalledWith('interface-1');

    // Disable by passing null id; data should remain undefined.
    rerender({ id: null });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  it('useGetInterfaceWithTabsQuery calls getInterfaceWithTabs only when hook is enabled', async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const getInterfaceWithTabs = vi.fn(async (projectId: string, name: string) => ({
      interface: { ...mockInterface, projectId: projectId, name },
      tabs: [{ id: 'tab-1', name: 'Tab 1' }],
    }));

    const actions = {
      getInterfaceWithTabs,
    } as unknown as GranularInterfaceActions & {
      getInterfaceWithTabs: (projectId: string, interfaceName: string) => Promise<any>;
    };

    const { result, rerender } = renderHook(
      ({ projectId, name }) => useGetInterfaceWithTabsQuery(projectId, name, actions),
      { initialProps: { projectId: 'project-1', name: 'Main Interface' }, wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.interface.name).toBe('Main Interface');
      expect(result.current.data?.tabs).toHaveLength(1);
    });
    expect(getInterfaceWithTabs).toHaveBeenCalledTimes(1);
  });

  it('useGetInterfaceUnifiedQuery routes to getById or getByName based on parameters', async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const getById = vi.fn(async (id: string) => ({ ...mockInterface, id }));
    const getByName = vi.fn(async (projectId: string, name: string, checkpoint?: boolean) => ({
      ...mockInterface,
      projectId: projectId,
      name,
      isCheckpoint: !!checkpoint,
    }));

    const actions = {
      getById,
      getByName,
    } as unknown as GranularInterfaceActions;

    // Using interfaceId path
    const { result: byIdResult } = renderHook(
      () =>
        useGetInterfaceUnifiedQuery(
          { interfaceId: 'interface-1', projectId: undefined, name: undefined, checkpoint: false },
          actions
        ),
      { wrapper }
    );

    await waitFor(() => {
      expect(byIdResult.current.isSuccess).toBe(true);
      expect(byIdResult.current.data?.id).toBe('interface-1');
    });
    expect(getById).toHaveBeenCalledTimes(1);
    expect(getByName).not.toHaveBeenCalled();

    // Using projectId + name path
    const { result: byNameResult } = renderHook(
      () =>
        useGetInterfaceUnifiedQuery(
          {
            interfaceId: undefined,
            projectId: 'project-1',
            name: 'Main Interface',
            checkpoint: true,
          },
          actions
        ),
      { wrapper }
    );

    await waitFor(() => {
      expect(byNameResult.current.isSuccess).toBe(true);
      expect(byNameResult.current.data?.name).toBe('Main Interface');
      expect(byNameResult.current.data?.isCheckpoint).toBe(true);
    });
    expect(getByName).toHaveBeenCalledTimes(1);
  });
});
