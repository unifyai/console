import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { GranularInterfaceActions, InterfaceData } from '@/types/interfaces/grid';
import {
  useGetInterfaceUnifiedQuery,
  useUpdateInterfaceUnifiedQuery,
} from '@/hooks/Interfaces/Query/useInterfacesQuery';

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const createWrapper = () => {
  const client = createClient();
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
};

describe('Interfaces checkpoint-style flows (unified hooks)', () => {
  it('useGetInterfaceUnifiedQuery supports checkpoint flag', async () => {
    const getByName = vi.fn(
      async (_projectId: string, _name: string, checkpoint?: boolean) =>
        ({
          id: 'interface-1',
          name: 'Main Interface',
          projectId: 'project-1',
          isCheckpoint: !!checkpoint,
        } as InterfaceData & { isCheckpoint: boolean }),
    );

    const actions = {
      getByName,
    } as unknown as GranularInterfaceActions;

    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useGetInterfaceUnifiedQuery(
          {
            interfaceId: undefined,
            projectId: 'project-1',
            name: 'Main Interface',
            checkpoint: true,
          },
          actions,
        ),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.isCheckpoint).toBe(true);
    });

    expect(getByName).toHaveBeenCalledWith(
      'project-1',
      'Main Interface',
      true,
    );
  });

  it('useUpdateInterfaceUnifiedQuery forwards checkpoint flag to actions', async () => {
    const { Wrapper, client } = createWrapper();
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries');

    const updateByName = vi.fn(
      async (
        projectId: string,
        name: string,
        data: Partial<InterfaceData>,
        checkpoint?: boolean,
      ) =>
        ({
          id: 'interface-1',
          name,
          projectId: projectId,
          ...data,
          isCheckpoint: !!checkpoint,
        } as InterfaceData & { isCheckpoint: boolean }),
    );

    const actions = {
      updateByName,
    } as unknown as GranularInterfaceActions;

    const { result } = renderHook(() => useUpdateInterfaceUnifiedQuery(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      projectId: 'project-1',
      name: 'Main Interface',
      data: { color: '#ffaa00' } as any,
      checkpoint: true,
      actions,
    });

    expect(updateByName).toHaveBeenCalledWith(
      'project-1',
      'Main Interface',
      { color: '#ffaa00' },
      true,
    );

    // Checkpoint updates should still invalidate standard interface keys
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['interfaces', 'project-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['interface', 'project-1', 'Main Interface'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['interface-with-tabs', 'project-1', 'Main Interface'],
    });
  });
});

