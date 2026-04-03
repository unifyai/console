/**
 * Real API tests for interface mutation hooks.
 *
 * These tests hit the actual Orchestra API to verify the React Query mutation
 * hooks work correctly with real data.
 * Run with: npm run test:integration:real
 */

import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateInterfaceQuery,
  useUpdateInterfaceQuery,
  useUpdateInterfaceByIdQuery,
  useUpdateInterfaceUnifiedQuery,
} from '@/hooks/Interfaces/Query/useInterfacesQuery';
import type { GranularInterfaceActions, InterfaceData } from '@/types/interfaces/grid';
import {
  createNewInterface,
  updateInterfaceByName,
  updateInterfaceById,
  deleteInterfaceById,
  getInterfaceById,
} from '@/lib/interfaces/interfaces';
import {
  projectsApi,
  uniqueName,
  safeDelete,
  realTestOptionsExtended,
} from '@/tests/_interfaces/api/fixtures/api-actions';

const TEST_API_KEY = process.env.VITE_TEST_API_KEY || '';

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
  return { Wrapper, client };
};

describe('@real Interface Mutation Hooks (Real API)', () => {
  let testProjectName: string;
  const createdInterfaceIds: string[] = [];

  beforeAll(async () => {
    if (!TEST_API_KEY) {
      throw new Error('VITE_TEST_API_KEY is not set');
    }

    // Create test project
    testProjectName = uniqueName('test-hooks-mutations');
    await projectsApi.create(testProjectName);
  }, 30000);

  afterAll(async () => {
    // Cleanup interfaces
    for (const id of createdInterfaceIds) {
      const deleteFn = await deleteInterfaceById(TEST_API_KEY);
      await safeDelete(() => deleteFn(id), `interface: ${id}`);
    }
    // Cleanup project
    await safeDelete(() => projectsApi.delete(testProjectName), `project: ${testProjectName}`);
  }, 30000);

  it(
    '@real useCreateInterfaceQuery creates a real interface',
    realTestOptionsExtended,
    async () => {
      const createFn = await createNewInterface(TEST_API_KEY);
      const actions = {
        create: createFn,
      } as unknown as GranularInterfaceActions;

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateInterfaceQuery(), {
        wrapper: Wrapper,
      });

      const interfaceName = uniqueName('test-create');

      const mutationResult = await result.current.mutateAsync({
        projectId: testProjectName,
        name: interfaceName,
        actions,
      } as any);

      expect(mutationResult).toBeDefined();
      expect(mutationResult.id).toBeDefined();
      expect(mutationResult.name).toBe(interfaceName);

      // Track for cleanup
      createdInterfaceIds.push(mutationResult.id!);
    }
  );

  it(
    '@real useUpdateInterfaceQuery updates interface by name',
    realTestOptionsExtended,
    async () => {
      // First create an interface
      const createFn = await createNewInterface(TEST_API_KEY);
      const interfaceName = uniqueName('test-update-name');
      const created = await createFn(testProjectName, interfaceName);
      createdInterfaceIds.push(created.id);

      // Now update it
      const updateByNameFn = await updateInterfaceByName(TEST_API_KEY);
      const actions = {
        updateByName: updateByNameFn,
      } as unknown as GranularInterfaceActions;

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateInterfaceQuery(), {
        wrapper: Wrapper,
      });

      const newColor = '#ff0000';
      const mutationResult = await result.current.mutateAsync({
        projectId: testProjectName,
        interfaceName: interfaceName,
        data: { color: newColor } as any,
        actions,
      });

      expect(mutationResult).toBeDefined();
      expect(mutationResult.color).toBe(newColor);
    }
  );

  it(
    '@real useUpdateInterfaceByIdQuery updates interface by ID',
    realTestOptionsExtended,
    async () => {
      // First create an interface
      const createFn = await createNewInterface(TEST_API_KEY);
      const interfaceName = uniqueName('test-update-id');
      const created = await createFn(testProjectName, interfaceName);
      createdInterfaceIds.push(created.id);

      // Now update it by ID
      const updateByIdFn = await updateInterfaceById(TEST_API_KEY);
      const actions = {
        updateById: updateByIdFn,
      } as unknown as GranularInterfaceActions;

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateInterfaceByIdQuery(), {
        wrapper: Wrapper,
      });

      const newColor = '#00ff00';
      const mutationResult = await result.current.mutateAsync({
        interfaceId: created.id,
        data: { color: newColor } as any,
        actions,
      });

      expect(mutationResult).toBeDefined();
      expect(mutationResult.color).toBe(newColor);
    }
  );

  it(
    '@real useUpdateInterfaceUnifiedQuery routes to correct action',
    realTestOptionsExtended,
    async () => {
      // Create an interface
      const createFn = await createNewInterface(TEST_API_KEY);
      const interfaceName = uniqueName('test-unified-update');
      const created = await createFn(testProjectName, interfaceName);
      createdInterfaceIds.push(created.id);

      const updateByIdFn = await updateInterfaceById(TEST_API_KEY);
      const updateByNameFn = await updateInterfaceByName(TEST_API_KEY);
      const actions = {
        updateById: updateByIdFn,
        updateByName: updateByNameFn,
      } as unknown as GranularInterfaceActions;

      const { Wrapper } = createWrapper();

      // Update by ID
      const { result: byIdResult } = renderHook(() => useUpdateInterfaceUnifiedQuery(), {
        wrapper: Wrapper,
      });

      const byIdMutationResult = await byIdResult.current.mutateAsync({
        interfaceId: created.id,
        data: { color: '#0000ff' } as any,
        actions,
      });

      expect(byIdMutationResult.color).toBe('#0000ff');

      // Update by name
      const { result: byNameResult } = renderHook(() => useUpdateInterfaceUnifiedQuery(), {
        wrapper: Wrapper,
      });

      const byNameMutationResult = await byNameResult.current.mutateAsync({
        projectId: testProjectName,
        name: interfaceName,
        data: { color: '#ffff00' } as any,
        actions,
      });

      expect(byNameMutationResult.color).toBe('#ffff00');
    }
  );

  it('@real mutation updates are reflected when re-fetching', realTestOptionsExtended, async () => {
    // Create an interface
    const createFn = await createNewInterface(TEST_API_KEY);
    const interfaceName = uniqueName('test-verify-update');
    const created = await createFn(testProjectName, interfaceName);
    createdInterfaceIds.push(created.id);

    // Update it
    const updateByIdFn = await updateInterfaceById(TEST_API_KEY);
    const newColor = '#abcdef';
    await updateByIdFn(created.id, { color: newColor });

    // Verify by fetching
    const getByIdFn = await getInterfaceById(TEST_API_KEY);
    const fetched = await getByIdFn(created.id);

    expect(fetched).toBeDefined();
    expect(fetched.color).toBe(newColor);
  });
});
