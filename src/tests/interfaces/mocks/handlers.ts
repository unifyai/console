import { http, HttpResponse } from 'msw';
import { mockProject } from './fixtures/projects';
import { mockInterface } from './fixtures/interfaces';
import { mockTab } from './fixtures/tabs';
import { createMockLogs, filterMockLogs, sortMockLogs, mockLogFields, MOCK_LOGS_TOTAL_COUNT } from './fixtures/logs';

/**
 * Interfaces-specific MSW handlers.
 *
 * These operate at the /api/* boundary and are intended for
 * integration/E2E tests. They should NOT depend on Orchestra directly.
 */
export const interfaceHandlers = [
  // Projects list
  http.get('/api/projects', () => {
    return HttpResponse.json({
      projects: [mockProject.name],
    });
  }),

  // Interfaces for a project
  http.get('/api/interfaces', () => {
    return HttpResponse.json({
      interfaces: [
        {
          id: mockInterface.id,
          name: mockInterface.name,
          projectId: mockInterface.projectId,
        },
      ],
    });
  }),

  // Tabs for an interface
  http.get('/api/tabs', () => {
    return HttpResponse.json({
      tabs: [
        {
          id: mockTab.id,
          name: mockTab.name,
          interfaceId: mockTab.interfaceId,
        },
      ],
    });
  }),

  // Fields for a project (column metadata)
  http.get('/api/fields', () => {
    return HttpResponse.json(mockLogFields);
  }),

  // Logs for the main table tile - parameterized for pagination, filtering, sorting
  http.get('/api/logs', ({ request }) => {
    const url = new URL(request.url);
    
    // Parse pagination params
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    
    // Parse filter/sort expressions
    const filterExpression = url.searchParams.get('filter') || url.searchParams.get('filter_expression');
    const sortingExpression = url.searchParams.get('sorting') || url.searchParams.get('sorting_expression');
    
    // Generate full dataset
    const allLogs = createMockLogs(MOCK_LOGS_TOTAL_COUNT, { offset: 0, totalCount: MOCK_LOGS_TOTAL_COUNT });
    
    // Work with logs as array (createMockLogs always returns LogProps[])
    let logsArray = allLogs.logs as import('@/types/interfaces/logs').LogProps[];
    let totalCount = allLogs.count;
    
    // Apply filtering
    if (filterExpression) {
      logsArray = filterMockLogs(logsArray, filterExpression);
      totalCount = logsArray.length;
    }
    
    // Apply sorting
    if (sortingExpression) {
      logsArray = sortMockLogs(logsArray, sortingExpression);
    }
    
    // Apply pagination
    const paginatedLogs = logsArray.slice(offset, offset + limit);
    
    return HttpResponse.json({
      params: allLogs.params,
      logs: paginatedLogs,
      count: totalCount,
      groups: allLogs.groups,
    });
  }),
];


