import { http, HttpResponse } from 'msw';
import { mockProject } from './fixtures/projects';
import { mockInterface } from './fixtures/interfaces';
import { mockTab } from './fixtures/tabs';
import { createMockLogs } from './fixtures/logs';

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
          project_id: mockInterface.projectId,
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
          interface_id: mockTab.interfaceId,
        },
      ],
    });
  }),

  // Logs for the main table tile
  http.get('/api/logs', () => {
    const logs = createMockLogs(20);
    return HttpResponse.json(logs);
  }),
];


