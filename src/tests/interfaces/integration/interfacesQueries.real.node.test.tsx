/**
 * Real API tests for interface query hooks.
 *
 * These tests hit the actual Orchestra API to verify the React Query hooks
 * work correctly with real data.
 * Run with: npm run test:integration:real
 */

import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useListInterfacesQuery,
  useGetInterfaceQuery,
  useGetInterfaceByIdQuery,
  useGetInterfaceUnifiedQuery,
} from '@/hooks/Interfaces/Query/useInterfacesQuery';
import type { GranularInterfaceActions, InterfaceData } from '@/types/interfaces/grid';
import {
  listInterfaces,
  getInterfaceByName,
  getInterfaceById,
  createNewInterface,
  deleteInterfaceById,
} from '@/lib/interfaces/interfaces';
import {
  projectsApi,
  uniqueName,
  safeDelete,
  realTestOptionsExtended,
} from '@/tests/interfaces/api/fixtures/api-actions';

const TEST_API_KEY = process.env.VITE_TEST_API_KEY || '';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const createWrapper = () => {
  const client = createQueryClient();
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

describe('@real Interface Query Hooks (Real API)', () => {
  let testProjectName: string;
  let testInterfaceId: string;
  let testInterfaceName: string;

  beforeAll(async () => {
    if (!TEST_API_KEY) {
      throw new Error('VITE_TEST_API_KEY is not set');
    }

    // Create test project
    testProjectName = uniqueName('test-hooks-queries');
    await projectsApi.create(testProjectName);

    // Create test interface
    testInterfaceName = uniqueName('test-interface');
    const createFn = await createNewInterface(TEST_API_KEY);
    const result = await createFn(testProjectName, testInterfaceName);
    testInterfaceId = result.id;
  }, 30000);

  afterAll(async () => {
    // Cleanup interface
    if (testInterfaceId) {
      const deleteFn = await deleteInterfaceById(TEST_API_KEY);
      await safeDelete(() => deleteFn(testInterfaceId), `interface: ${testInterfaceId}`);
    }
    // Cleanup project
    await safeDelete(() => projectsApi.delete(testProjectName), `project: ${testProjectName}`);
  }, 30000);

  // Skip: useListInterfacesQuery by design uses dedupedJson to call /api/interface (Console route),
  // not actions.list. This requires a running Console server which isn't available in real API tests.
  // The unit tests with mocked fetch verify the production code path correctly.
  it.skip(
    '@real useListInterfacesQuery fetches real interfaces',
    realTestOptionsExtended,
    async () => {
      const listFn = await listInterfaces(TEST_API_KEY);
      const actions = {
        list: listFn,
      } as unknown as GranularInterfaceActions;

      const wrapper = createWrapper();
      const { result } = renderHook(() => useListInterfacesQuery(testProjectName, actions), {
        wrapper,
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);

      // Should include our test interface
      const found = result.current.data?.find((i: InterfaceData) => i.name === testInterfaceName);
      expect(found).toBeDefined();
    }
  );

  it('@real useGetInterfaceQuery fetches interface by name', realTestOptionsExtended, async () => {
    const getByNameFn = await getInterfaceByName(TEST_API_KEY);
    const actions = {
      getByName: getByNameFn,
    } as unknown as GranularInterfaceActions;

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useGetInterfaceQuery(testProjectName, testInterfaceName, actions),
      { wrapper }
    );

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 10000 }
    );

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.name).toBe(testInterfaceName);
    expect(result.current.data?.id).toBe(testInterfaceId);
  });

  it(
    '@real useGetInterfaceByIdQuery fetches interface by ID',
    realTestOptionsExtended,
    async () => {
      const getByIdFn = await getInterfaceById(TEST_API_KEY);
      const actions = {
        getById: getByIdFn,
      } as unknown as GranularInterfaceActions;

      const wrapper = createWrapper();
      const { result } = renderHook(() => useGetInterfaceByIdQuery(testInterfaceId, actions), {
        wrapper,
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(testInterfaceId);
      expect(result.current.data?.name).toBe(testInterfaceName);
    }
  );

  it(
    '@real useGetInterfaceUnifiedQuery routes to correct action',
    realTestOptionsExtended,
    async () => {
      const getByIdFn = await getInterfaceById(TEST_API_KEY);
      const getByNameFn = await getInterfaceByName(TEST_API_KEY);
      const actions = {
        getById: getByIdFn,
        getByName: getByNameFn,
      } as unknown as GranularInterfaceActions;

      const wrapper = createWrapper();

      // Test by ID
      const { result: byIdResult } = renderHook(
        () =>
          useGetInterfaceUnifiedQuery(
            {
              interfaceId: testInterfaceId,
              projectId: undefined,
              name: undefined,
              checkpoint: false,
            },
            actions
          ),
        { wrapper }
      );

      await waitFor(
        () => {
          expect(byIdResult.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(byIdResult.current.data?.id).toBe(testInterfaceId);

      // Test by name
      const { result: byNameResult } = renderHook(
        () =>
          useGetInterfaceUnifiedQuery(
            {
              interfaceId: undefined,
              projectId: testProjectName,
              name: testInterfaceName,
              checkpoint: false,
            },
            actions
          ),
        { wrapper }
      );

      await waitFor(
        () => {
          expect(byNameResult.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(byNameResult.current.data?.name).toBe(testInterfaceName);
    }
  );

  it(
    '@real useListInterfacesQuery is disabled when projectId is null',
    realTestOptionsExtended,
    async () => {
      const listFn = await listInterfaces(TEST_API_KEY);
      const actions = {
        list: listFn,
      } as unknown as GranularInterfaceActions;

      const wrapper = createWrapper();
      const { result } = renderHook(() => useListInterfacesQuery(null, actions), { wrapper });

      // Query should not run when projectId is null
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.data).toBeUndefined();
      });
    }
  );
});
