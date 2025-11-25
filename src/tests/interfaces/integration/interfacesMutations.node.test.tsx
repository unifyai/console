import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateInterfaceQuery,
  useUpdateInterfaceQuery,
  useUpdateInterfaceByIdQuery,
  useUpdateInterfaceUnifiedQuery,
} from '@/hooks/Interfaces/Query/useInterfacesQuery';
import type { GranularInterfaceActions, InterfaceData } from '@/types/interfaces/grid';

const createTestClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const createWrapper = () => {
  const client = createTestClient();
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

describe('Interfaces mutation hooks (integration-style)', () => {
  it('useCreateInterfaceQuery calls actions.create and invalidates interfaces list', async () => {
    const invalidateQueries = vi.fn();

    const client = new QueryClient();
    client.invalidateQueries = invalidateQueries as any;
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const create = vi.fn(async (projectId: string, name: string) => ({
      id: 'interface-1',
      name,
      project_id: projectId,
    } as InterfaceData));

    const actions = { create } as unknown as GranularInterfaceActions;

    const { result } = renderHook(() => useCreateInterfaceQuery(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      projectId: 'project-1',
      name: 'New Interface',
      actions,
    } as any);

    expect(create).toHaveBeenCalledWith('project-1', 'New Interface', undefined);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['interfaces', 'project-1'],
    });
  });

  it('useUpdateInterfaceQuery calls updateByName and invalidates interface + list + with-tabs', async () => {
    const client = createTestClient();
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries');
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const updateByName = vi.fn(async () => ({
      id: 'interface-1',
      name: 'Main Interface',
      project_id: 'project-1',
    } as InterfaceData));

    const actions = { updateByName } as unknown as GranularInterfaceActions;

    const { result } = renderHook(() => useUpdateInterfaceQuery(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      projectId: 'project-1',
      interfaceName: 'Main Interface',
      data: { color: '#fff' } as any,
      actions,
    });

    expect(updateByName).toHaveBeenCalledWith('project-1', 'Main Interface', {
      color: '#fff',
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['interface', 'project-1', 'Main Interface'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['interfaces', 'project-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['interface-with-tabs', 'project-1', 'Main Interface'],
    });
  });

  it('useUpdateInterfaceByIdQuery calls updateById and invalidates by-id and list', async () => {
    const client = createTestClient();
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries');
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const updateById = vi.fn(async (id: string, data: Partial<InterfaceData>) => ({
      id,
      project_id: 'project-1',
      name: 'Main Interface',
      ...data,
    } as InterfaceData));

    const actions = { updateById } as unknown as GranularInterfaceActions;

    const { result } = renderHook(() => useUpdateInterfaceByIdQuery(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      interfaceId: 'interface-1',
      data: { color: '#000' } as any,
      actions,
    });

    expect(updateById).toHaveBeenCalledWith('interface-1', { color: '#000' });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['interface-by-id', 'interface-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['interfaces', 'project-1'],
    });
  });

  it('useUpdateInterfaceUnifiedQuery dispatches to correct action and invalidates keys', async () => {
    const client = createTestClient();
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries');
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const updateById = vi.fn(async (id: string, data: Partial<InterfaceData>) => ({
      id,
      project_id: 'project-1',
      name: 'Main Interface',
      ...data,
    } as InterfaceData));

    const updateByName = vi.fn(
      async (projectId: string, name: string, data: Partial<InterfaceData>) => ({
        id: 'interface-1',
        project_id: projectId,
        name,
        ...data,
      } as InterfaceData),
    );

    const actions = { updateById, updateByName } as unknown as GranularInterfaceActions;

    const { result: byIdResult } = renderHook(() => useUpdateInterfaceUnifiedQuery(), {
      wrapper: Wrapper,
    });

    await byIdResult.current.mutateAsync({
      interfaceId: 'interface-1',
      data: { color: '#123456' } as any,
      actions,
    });

    expect(updateById).toHaveBeenCalledWith('interface-1', { color: '#123456' }, undefined);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['interface-by-id', 'interface-1'],
    });

    const { result: byNameResult } = renderHook(() => useUpdateInterfaceUnifiedQuery(), {
      wrapper: Wrapper,
    });

    await byNameResult.current.mutateAsync({
      projectId: 'project-1',
      name: 'Main Interface',
      data: { color: '#abcdef' } as any,
      actions,
    });

    expect(updateByName).toHaveBeenCalledWith('project-1', 'Main Interface', {
      color: '#abcdef',
    }, undefined);

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




