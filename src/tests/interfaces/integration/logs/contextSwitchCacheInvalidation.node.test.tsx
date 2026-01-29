/**
 * Regression Test for Context Switch Cache Invalidation Bug
 *
 * BUG: When switching contexts, the cache invalidation predicate doesn't match
 * the actual infinite logs query key structure, so queries are never invalidated.
 *
 * The invalidation code checks:
 *   k0 === 'infiniteLogs' && k1 === tile.id
 *
 * But the actual query key structure is:
 *   ['logs', 'infinite', tileId, tabId, projectId, context, ...]
 *
 * So k0 === 'logs' and k1 === 'infinite', meaning the predicate NEVER matches.
 * This causes stale cached data to be served when switching back to a previously
 * visited context.
 *
 * FIX: Update the invalidation predicate to match the actual query key structure:
 *   k0 === 'logs' && k1 === 'infinite' && k2 === tile.id
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { buildLogQueryKey } from '@/utils/interfaces/logsCore';

describe('Context Switch Cache Invalidation - Regression Test', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * This test verifies the query key structure used by buildLogQueryKey.
   * If someone changes the query key structure, this test will catch it.
   */
  it('buildLogQueryKey should produce expected query key structure', () => {
    const queryKey = buildLogQueryKey('infinite', {
      tileId: 'tile-123',
      tabId: 'tab-456',
      projectId: 'RepairsAgent',
      context: 'DefaultUser/DefaultAssistant/Files/Local/0/Tables/July_2025',
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 20,
    });

    // Verify the query key structure
    expect(queryKey[0]).toBe('logs');
    expect(queryKey[1]).toBe('infinite');
    expect(queryKey[2]).toBe('tile-123');
    expect(queryKey[3]).toBe('tab-456');
    expect(queryKey[4]).toBe('RepairsAgent');
    expect(queryKey[5]).toBe('DefaultUser/DefaultAssistant/Files/Local/0/Tables/July_2025');
  });

  /**
   * REGRESSION TEST: The invalidation predicate must match the actual query key structure.
   *
   * The BUGGY predicate was:
   *   k0 === 'infiniteLogs' && k1 === tile.id
   *
   * The CORRECT predicate should be:
   *   k0 === 'logs' && k1 === 'infinite' && k2 === tile.id
   *
   * This test simulates what useTileSync.wrapContextAndColumnContext does
   * and verifies the predicate matches correctly.
   */
  it('invalidation predicate should match infinite logs query keys (REGRESSION TEST)', () => {
    const tileId = 'tile-123';

    // Set up a cached infinite logs query (simulating what happens after first context load)
    const queryKey = buildLogQueryKey('infinite', {
      tileId,
      tabId: 'tab-456',
      projectId: 'RepairsAgent',
      context: 'DefaultUser/DefaultAssistant/Files/Local/0/Tables/July_2025',
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 20,
    });

    // Add mock data to the cache
    queryClient.setQueryData(queryKey, {
      pages: [{ logs: [{ id: 'log-1' }], count: 1 }],
      pageParams: [0],
    });

    // Verify cache has data
    const cachedData = queryClient.getQueryData(queryKey);
    expect(cachedData).toBeDefined();

    // ========== THE BUGGY PREDICATE (what the code was doing) ==========
    const buggyPredicate = (q: any) => {
      const k0 = q?.queryKey?.[0] as string;
      const k1 = q?.queryKey?.[1] as string;
      return k0 === 'infiniteLogs' && k1 === tileId;
    };

    // The buggy predicate should NOT match the actual query key
    const matchesBuggyPredicate = buggyPredicate({ queryKey });
    expect(matchesBuggyPredicate, 'BUGGY predicate should NOT match (this documents the bug)').toBe(
      false
    );

    // ========== THE CORRECT PREDICATE (what the code should do) ==========
    const correctPredicate = (q: any) => {
      const k0 = q?.queryKey?.[0] as string;
      const k1 = q?.queryKey?.[1] as string;
      const k2 = q?.queryKey?.[2] as string;
      return k0 === 'logs' && k1 === 'infinite' && k2 === tileId;
    };

    // The correct predicate should match the actual query key
    const matchesCorrectPredicate = correctPredicate({ queryKey });
    expect(matchesCorrectPredicate, 'CORRECT predicate should match infinite logs query key').toBe(
      true
    );
  });

  /**
   * Test that invalidateQueries with the CORRECT predicate actually invalidates the cache.
   */
  it('invalidateQueries with correct predicate should invalidate infinite logs queries', async () => {
    const tileId = 'tile-123';

    // Set up cached queries for multiple contexts (simulating switching between contexts)
    const context1Key = buildLogQueryKey('infinite', {
      tileId,
      tabId: 'tab-456',
      projectId: 'RepairsAgent',
      context: 'Context1',
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 20,
    });

    const context2Key = buildLogQueryKey('infinite', {
      tileId,
      tabId: 'tab-456',
      projectId: 'RepairsAgent',
      context: 'Context2',
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 20,
    });

    // Different tile - should NOT be invalidated
    const otherTileKey = buildLogQueryKey('infinite', {
      tileId: 'tile-other',
      tabId: 'tab-456',
      projectId: 'RepairsAgent',
      context: 'Context1',
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 20,
    });

    // Add mock data to all caches
    queryClient.setQueryData(context1Key, { pages: [{ logs: [{ id: 'c1-log' }] }] });
    queryClient.setQueryData(context2Key, { pages: [{ logs: [{ id: 'c2-log' }] }] });
    queryClient.setQueryData(otherTileKey, { pages: [{ logs: [{ id: 'other-log' }] }] });

    // Verify all caches have data and are not stale initially
    expect(queryClient.getQueryData(context1Key)).toBeDefined();
    expect(queryClient.getQueryData(context2Key)).toBeDefined();
    expect(queryClient.getQueryData(otherTileKey)).toBeDefined();

    // Use the CORRECT predicate to invalidate
    await queryClient.invalidateQueries({
      predicate: (q: any) => {
        const k0 = q?.queryKey?.[0] as string;
        const k1 = q?.queryKey?.[1] as string;
        const k2 = q?.queryKey?.[2] as string;
        return k0 === 'logs' && k1 === 'infinite' && k2 === tileId;
      },
    });

    // After invalidation, queries for tileId should be marked as stale
    const state1 = queryClient.getQueryState(context1Key);
    const state2 = queryClient.getQueryState(context2Key);
    const stateOther = queryClient.getQueryState(otherTileKey);

    // Queries for our tile should be invalidated (isInvalidated = true or stale)
    expect(state1?.isInvalidated, 'Context1 query for tileId should be invalidated').toBe(true);
    expect(state2?.isInvalidated, 'Context2 query for tileId should be invalidated').toBe(true);

    // Query for other tile should NOT be invalidated
    expect(stateOther?.isInvalidated, 'Other tile query should NOT be invalidated').toBe(false);
  });

  /**
   * NEGATIVE TEST: Verify the buggy predicate fails to invalidate.
   * This documents the bug behavior to ensure we don't regress.
   */
  it('BUGGY predicate should FAIL to invalidate infinite logs queries (documents bug)', async () => {
    const tileId = 'tile-123';

    const queryKey = buildLogQueryKey('infinite', {
      tileId,
      tabId: 'tab-456',
      projectId: 'RepairsAgent',
      context: 'TestContext',
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      groupLimit: 20,
    });

    queryClient.setQueryData(queryKey, { pages: [{ logs: [{ id: 'test-log' }] }] });

    // Use the BUGGY predicate (what the code was doing)
    await queryClient.invalidateQueries({
      predicate: (q: any) => {
        const k0 = q?.queryKey?.[0] as string;
        const k1 = q?.queryKey?.[1] as string;
        // BUGGY: checks for 'infiniteLogs' instead of ['logs', 'infinite']
        return k0 === 'infiniteLogs' && k1 === tileId;
      },
    });

    // The query should NOT be invalidated because the predicate doesn't match
    const state = queryClient.getQueryState(queryKey);
    expect(
      state?.isInvalidated,
      'With BUGGY predicate, query should NOT be invalidated (this is the bug)'
    ).toBe(false);
  });
});
