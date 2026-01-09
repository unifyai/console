import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLogsCore, type CoreLogFetchParams } from '@/utils/interfaces/logsCore';
import type { LogsActions } from '@/types/interfaces/grid';
import type { LogProps } from '@/types/interfaces/logs';
import { createMockLogs, MOCK_LOGS_TOTAL_COUNT } from '@/tests/interfaces/mocks/fixtures/logs';

// Mock fetch - fetchLogsCore now uses direct fetch to /api/logs
const mockFetch = vi.fn();

// Helper to create mock fetch response with proper headers
const createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => data,
});

describe('logsCore + getLogs (MSW integration)', () => {
  let allLogs: ReturnType<typeof createMockLogs>;
  let fetchCallUrls: string[];

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    fetchCallUrls = [];
    
    // Create mock data
    allLogs = createMockLogs(MOCK_LOGS_TOTAL_COUNT, { offset: 0, totalCount: MOCK_LOGS_TOTAL_COUNT });
    
    // Setup fetch mock to return logs
    mockFetch.mockImplementation(async (url: string) => {
      fetchCallUrls.push(url);
      
      if (url.includes('/api/logs')) {
        // Parse limit and offset from URL
        const urlObj = new URL(url, 'http://localhost');
        const limit = parseInt(urlObj.searchParams.get('limit') || '20');
        const offset = parseInt(urlObj.searchParams.get('offset') || '0');
        
        // Return paginated logs
        const paginatedLogs = (allLogs.logs as LogProps[]).slice(offset, offset + limit);
        
        return createMockResponse({
          params: allLogs.params,
          logs: paginatedLogs,
          count: allLogs.count,
          groups: allLogs.groups || [],
        });
      }
      
      return createMockResponse({}, 404);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetchLogsCore uses direct fetch and returns correct metadata for ungrouped logs', async () => {
    // logsActions is still passed for type compatibility but not used for fetching
    const logsActions = {
      create: vi.fn(),
      get: vi.fn(), // Not used - fetchLogsCore uses direct fetch
      getLatest: vi.fn(),
      getMetrics: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    } as unknown as LogsActions;

    const params: CoreLogFetchParams = {
      projectId: 'project-1',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      offset: 0,
      groupLimit: 20,
      groupOffset: 0,
      logsActions,
    };

    const result = await fetchLogsCore(params);

    // Verify fetch was called
    expect(mockFetch).toHaveBeenCalled();
    expect(fetchCallUrls.some(url => url.includes('/api/logs'))).toBe(true);

    // response.count is the TOTAL count (100), not the page size
    expect(result.response.count).toBe(MOCK_LOGS_TOTAL_COUNT);
    expect(result.totalCount).toBe(MOCK_LOGS_TOTAL_COUNT);
    // currentCount = offset + fetched logs = 0 + 20 = 20
    expect(result.currentCount).toBe(20);
    // hasMore is true because 20 < 100
    expect(result.hasMore).toBe(true);
    expect(result.useGroupPagination).toBe(false);
    expect(result.effectiveLimit).toBe(20);
    expect(result.effectiveOffset).toBe(0);

    // Converted logs should be paginated (first 20 of 100)
    expect(result.convertedLogs.length).toBe(20);
    const first = result.convertedLogs[0] as LogProps;
    expect(first.type).toBe('ungrouped');
  });

  it('fetchLogsCore passes limit/offset vs groupLimit/groupOffset correctly based on groupingExpression', async () => {
    const logsActions = {
      create: vi.fn(),
      get: vi.fn(),
      getLatest: vi.fn(),
      getMetrics: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    } as unknown as LogsActions;

    // Ungrouped call
    const ungroupedParams: CoreLogFetchParams = {
      projectId: 'project-1',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: null,
      groupSortingExpression: null,
      limit: 20,
      offset: 40,
      groupLimit: 20,
      groupOffset: 2,
      logsActions,
    };

    await fetchLogsCore(ungroupedParams);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const ungroupedUrl = fetchCallUrls[0];
    const ungroupedUrlObj = new URL(ungroupedUrl, 'http://localhost');
    
    // limit/offset should be used for ungrouped
    expect(ungroupedUrlObj.searchParams.get('limit')).toBe('20');
    expect(ungroupedUrlObj.searchParams.get('offset')).toBe('40');
    // group_* should NOT be in URL for ungrouped
    expect(ungroupedUrlObj.searchParams.has('groupLimit')).toBe(false);
    expect(ungroupedUrlObj.searchParams.has('groupOffset')).toBe(false);

    // Reset for grouped call
    mockFetch.mockClear();
    fetchCallUrls = [];

    // Setup mock for grouped response
    mockFetch.mockImplementation(async (url: string) => {
      fetchCallUrls.push(url);
      return createMockResponse({
        params: {},
        logs: [],
        count: 0,
        groups: [],
      });
    });

    // Grouped call
    const groupedParams: CoreLogFetchParams = {
      projectId: 'project-1',
      context: null,
      columnContext: null,
      filterExpression: null,
      sortingExpression: null,
      groupingExpression: 'entries/group',
      groupSortingExpression: null,
      limit: 20,
      offset: 0,
      groupLimit: 50,
      groupOffset: 10,
      logsActions,
    };

    await fetchLogsCore(groupedParams);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const groupedUrl = fetchCallUrls[0];
    const groupedUrlObj = new URL(groupedUrl, 'http://localhost');
    
    // group_* should be used for grouped
    expect(groupedUrlObj.searchParams.get('groupLimit')).toBe('50');
    expect(groupedUrlObj.searchParams.get('groupOffset')).toBe('10');
    expect(groupedUrlObj.searchParams.get('groupDepth')).toBe('0');
    // limit/offset should NOT be in URL for grouped
    expect(groupedUrlObj.searchParams.has('limit')).toBe(false);
    expect(groupedUrlObj.searchParams.has('offset')).toBe(false);
    // grouping should be in URL
    expect(groupedUrlObj.searchParams.get('groupBy')).toBe('entries/group');
  });
});
