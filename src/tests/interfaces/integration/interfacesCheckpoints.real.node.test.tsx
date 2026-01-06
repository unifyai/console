/**
 * Real API tests for interface checkpoint functionality.
 *
 * These tests hit the actual Orchestra API to verify the checkpoint
 * hooks work correctly with real data.
 * Run with: npm run test:integration:real
 */

import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useGetInterfaceUnifiedQuery,
  useUpdateInterfaceUnifiedQuery,
} from '@/hooks/Interfaces/Query/useInterfacesQuery';
import type { GranularInterfaceActions, InterfaceData } from '@/types/interfaces/grid';
import {
  createNewInterface,
  getInterfaceByName,
  updateInterfaceByName,
  deleteInterfaceById,
  createInterfaceCheckpoint,
} from '@/lib/interfaces/interfaces';
import {
  projectsApi,
  uniqueName,
  safeDelete,
  realTestOptionsExtended,
} from '@/tests/interfaces/api/fixtures/api-actions';

const TEST_API_KEY = process.env.VITE_TEST_API_KEY || '';

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

describe('@real Interface Checkpoint Hooks (Real API)', () => {
  let testProjectName: string;
  const createdInterfaceIds: string[] = [];

  beforeAll(async () => {
    if (!TEST_API_KEY) {
      throw new Error('VITE_TEST_API_KEY is not set');
    }

    // Create test project
    testProjectName = uniqueName('test-hooks-checkpoints');
    await projectsApi.create(testProjectName);
  }, 30000);

  afterAll(async () => {
    // Cleanup interfaces
    for (const id of createdInterfaceIds) {
      const deleteFn = await deleteInterfaceById(TEST_API_KEY);
      await safeDelete(() => deleteFn(id), `interface: ${id}`);
    }
    // Cleanup project
    await safeDelete(
      () => projectsApi.delete(testProjectName),
      `project: ${testProjectName}`
    );
  }, 30000);

  it(
    '@real creates interface checkpoint and retrieves it',
    realTestOptionsExtended,
    async () => {
      // Create an interface
      const createFn = await createNewInterface(TEST_API_KEY);
      const interfaceName = uniqueName('test-checkpoint');
      const created = await createFn(testProjectName, interfaceName);
      createdInterfaceIds.push(created.id);

      // Create a checkpoint
      const checkpointFn = await createInterfaceCheckpoint(TEST_API_KEY);
      const checkpointResult = await checkpointFn(
        testProjectName,
        interfaceName,
        'Test checkpoint description'
      );

      expect(checkpointResult).toBeDefined();
      expect(checkpointResult.error).toBeUndefined();
    }
  );

  it(
    '@real useGetInterfaceUnifiedQuery supports checkpoint flag',
    realTestOptionsExtended,
    async () => {
      // Create an interface
      const createFn = await createNewInterface(TEST_API_KEY);
      const interfaceName = uniqueName('test-get-checkpoint');
      const created = await createFn(testProjectName, interfaceName);
      createdInterfaceIds.push(created.id);

      // Create a checkpoint
      const checkpointFn = await createInterfaceCheckpoint(TEST_API_KEY);
      await checkpointFn(testProjectName, interfaceName, 'Checkpoint for get test');

      // Get with checkpoint flag
      const getByNameFn = await getInterfaceByName(TEST_API_KEY);
      const actions = {
        getByName: getByNameFn,
      } as unknown as GranularInterfaceActions;

      const { Wrapper } = createWrapper();

      // Get the checkpoint version
      const { result } = renderHook(
        () =>
          useGetInterfaceUnifiedQuery(
            {
              interfaceId: undefined,
              projectId: testProjectName,
              name: interfaceName,
              checkpoint: true,
            },
            actions
          ),
        { wrapper: Wrapper }
      );

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.name).toBe(interfaceName);
      // Checkpoint version should have is_checkpoint = true
      expect((result.current.data as any)?.is_checkpoint).toBe(true);
    }
  );

  it(
    '@real useUpdateInterfaceUnifiedQuery updates interface with checkpoint flag',
    realTestOptionsExtended,
    async () => {
      // Create an interface
      const createFn = await createNewInterface(TEST_API_KEY);
      const interfaceName = uniqueName('test-update-checkpoint');
      const created = await createFn(testProjectName, interfaceName);
      createdInterfaceIds.push(created.id);

      // Create a checkpoint
      const checkpointFn = await createInterfaceCheckpoint(TEST_API_KEY);
      await checkpointFn(testProjectName, interfaceName, 'Checkpoint for update test');

      // Update the active interface (not the checkpoint directly)
      const updateByNameFn = await updateInterfaceByName(TEST_API_KEY);
      const actions = {
        updateByName: updateByNameFn,
      } as unknown as GranularInterfaceActions;

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateInterfaceUnifiedQuery(), {
        wrapper: Wrapper,
      });

      const newColor = '#updated';
      const mutationResult = await result.current.mutateAsync({
        projectId: testProjectName,
        name: interfaceName,
        data: { color: newColor } as any,
        checkpoint: false, // Update active version
        actions,
      });

      expect(mutationResult).toBeDefined();
      expect(mutationResult.color).toBe(newColor);
    }
  );

  it(
    '@real checkpoint and active versions are independent',
    realTestOptionsExtended,
    async () => {
      // Create an interface with initial color
      const createFn = await createNewInterface(TEST_API_KEY);
      const interfaceName = uniqueName('test-independent-checkpoint');
      const created = await createFn(testProjectName, interfaceName, '#initial');
      createdInterfaceIds.push(created.id);

      // Create a checkpoint (saves current state)
      const checkpointFn = await createInterfaceCheckpoint(TEST_API_KEY);
      await checkpointFn(testProjectName, interfaceName, 'Checkpoint before update');

      // Update the active version
      const updateByNameFn = await updateInterfaceByName(TEST_API_KEY);
      await updateByNameFn(testProjectName, interfaceName, { color: '#updated' }, false);

      // Get both versions
      const getByNameFn = await getInterfaceByName(TEST_API_KEY);

      const activeVersion = await getByNameFn(testProjectName, interfaceName, false);
      const checkpointVersion = await getByNameFn(testProjectName, interfaceName, true);

      // Active should have the new color
      expect(activeVersion.color).toBe('#updated');
      // Checkpoint should still have the original color
      expect(checkpointVersion.color).toBe('#initial');
    }
  );
});

