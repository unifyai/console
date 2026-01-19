import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useListProjectsQuery } from '@/hooks/Interfaces/Query/useProjectsQuery';
import {
  useListInterfacesQuery,
  useGetInterfaceUnifiedQuery,
} from '@/hooks/Interfaces/Query/useInterfacesQuery';
import { ProjectsActions, GranularInterfaceActions } from '@/types/interfaces/grid';
import { createQueryWrapper } from '@/tests/interfaces/utils/render-with-providers';

// Mock fetch for useListInterfacesQuery which uses direct fetch
const mockFetch = vi.fn();

describe('Simple Query Hooks', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    it('fetches interfaces successfully via direct fetch', async () => {
      const mockInterfaces = [{ id: 'i1', name: 'Interface 1', projectId: 'p1' }];

      // Mock the fetch response that useListInterfacesQuery uses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ etag: 'abc123' }),
        json: async () => mockInterfaces,
      });

      // Don't provide list action - hook will use direct fetch which we mock
      const actions = {} as unknown as GranularInterfaceActions;

      const { result } = renderHook(() => useListInterfacesQuery('p1', actions), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockInterfaces);

      // Verify fetch was called with correct URL
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain('/api/interface');
      expect(fetchUrl).toContain('projectName=p1');
    });

    it('does not fetch if projectId is null', async () => {
      const actions = {
        list: vi.fn(),
      } as unknown as GranularInterfaceActions;

      const { result } = renderHook(() => useListInterfacesQuery(null, actions), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.isPending).toBe(true); // Queries disabled by 'enabled: false' start in pending state in v5
      expect(result.current.fetchStatus).toBe('idle');
      expect(mockFetch).not.toHaveBeenCalled(); // No fetch when disabled
    });

    it('handles fetch errors gracefully', async () => {
      // Reset and set up mock for this specific test
      mockFetch.mockReset();
      mockFetch.mockImplementation(async () => ({
        ok: false,
        status: 500,
        headers: {
          get: () => null,
        },
        json: async () => ({ detail: 'Server Error' }),
      }));

      const actions = {} as GranularInterfaceActions;

      const { result } = renderHook(() => useListInterfacesQuery('p1', actions), {
        wrapper: createQueryWrapper(),
      });

      // Wait for the query to complete - use a longer interval for state updates
      await waitFor(
        () => {
          expect(result.current.status).not.toBe('pending');
        },
        { timeout: 5000, interval: 100 }
      );

      // Verify error state
      expect(result.current.status).toBe('error');
      expect(result.current.error?.message).toBe('Server Error');
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
