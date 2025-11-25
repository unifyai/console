import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useListProjectsQuery } from '@/hooks/Interfaces/Query/useProjectsQuery';
import { useListInterfacesQuery, useGetInterfaceUnifiedQuery } from '@/hooks/Interfaces/Query/useInterfacesQuery';
import { ProjectsActions, GranularInterfaceActions } from '@/types/interfaces/grid';
import { createQueryWrapper } from '@/tests/interfaces/utils/render-with-providers';

describe('Simple Query Hooks', () => {
  describe('useListProjectsQuery', () => {
    it('fetches projects successfully', async () => {
      const mockProjects = [{ id: 'p1', name: 'Project 1' }];
      const actions = {
        get: vi.fn().mockResolvedValue(mockProjects),
      } as unknown as ProjectsActions;

      const { result } = renderHook(() => useListProjectsQuery(actions), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockProjects);
      expect(actions.get).toHaveBeenCalled();
    });
  });

  describe('useListInterfacesQuery', () => {
    it('fetches interfaces successfully', async () => {
      const mockInterfaces = [{ id: 'i1', name: 'Interface 1', project_id: 'p1' }];
      const actions = {
        list: vi.fn().mockResolvedValue(mockInterfaces),
      } as unknown as GranularInterfaceActions;

      const { result } = renderHook(
        () => useListInterfacesQuery('p1', actions), 
        { wrapper: createQueryWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockInterfaces);
      expect(actions.list).toHaveBeenCalledWith('p1');
    });

    it('does not fetch if projectId is null', async () => {
      const actions = {
        list: vi.fn(),
      } as unknown as GranularInterfaceActions;

      const { result } = renderHook(
        () => useListInterfacesQuery(null, actions), 
        { wrapper: createQueryWrapper() }
      );

      expect(result.current.isPending).toBe(true); // Queries disabled by 'enabled: false' start in pending state in v5
      expect(result.current.fetchStatus).toBe('idle');
      expect(actions.list).not.toHaveBeenCalled();
    });
  });

  describe('useGetInterfaceUnifiedQuery', () => {
    it('fetches by ID', async () => {
      const mockInterface = { id: 'i1', name: 'Interface 1' };
      const actions = {
        getById: vi.fn().mockResolvedValue(mockInterface),
      } as unknown as GranularInterfaceActions;

      const { result } = renderHook(
        () => useGetInterfaceUnifiedQuery({ interfaceId: 'i1' }, actions),
        { wrapper: createQueryWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockInterface);
      expect(actions.getById).toHaveBeenCalledWith('i1', undefined);
    });

    it('fetches by Name', async () => {
      const mockInterface = { id: 'i1', name: 'Interface 1' };
      const actions = {
        getByName: vi.fn().mockResolvedValue(mockInterface),
      } as unknown as GranularInterfaceActions;

      const { result } = renderHook(
        () => useGetInterfaceUnifiedQuery({ projectId: 'p1', name: 'Interface 1' }, actions),
        { wrapper: createQueryWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockInterface);
      expect(actions.getByName).toHaveBeenCalledWith('p1', 'Interface 1', undefined);
    });
  });
});

