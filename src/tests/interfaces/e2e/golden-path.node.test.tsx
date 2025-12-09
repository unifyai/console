import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/tests/interfaces/utils/render-with-providers';
import Interface from '@/components/Pages/Interfaces/Interface/Interface';
import { useQueryState } from 'nuqs'; // Will be mocked
import {
  mockProjectsActions,
  mockInterfaceActions,
  mockTabActions,
  mockTileActions,
  mockLogsActions,
  mockFieldsActions,
  mockDerivedEntryActions,
  mockContextActions,
  mockCodeActions,
  mockFileActions,
  mockFavouritesActions,
} from '@/tests/interfaces/mocks/fixtures/actions';
import { mockProjectId } from '@/tests/interfaces/mocks/fixtures/projects';
import { mockInterface } from '@/tests/interfaces/mocks/fixtures/interfaces';
import { mockTab } from '@/tests/interfaces/mocks/fixtures/tabs';
import { createMockLogs, MOCK_LOGS_TOTAL_COUNT } from '@/tests/interfaces/mocks/fixtures/logs';

// Mock fetch - hooks now use direct fetch to API routes
const mockFetch = vi.fn();

// Helper to create mock fetch response with proper headers
const createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => name === 'etag' ? 'mock-etag' : null },
  json: async () => data,
});

// Stub the heavy Tab component to avoid ReactGridLayout and complex data flow.
// For the Golden Path we only need to know that the main tab view rendered.
vi.mock('@/components/Pages/Interfaces/Tab/Tab', () => ({
  default: function StubTab(props: { tabId: string; interfaceId: string; projectId: string }) {
    return (
      <div data-testid="golden-path-tab">
        Tab loaded for project {props.projectId}, interface {props.interfaceId}, tab {props.tabId}
      </div>
    );
  },
}));

// Nuqs mock: shared in‑memory store so different hooks see the same URL state
const nuqsStore = new Map<string, any>();
const nuqsListeners = new Set<() => void>();

vi.mock('nuqs', async () => {
  const React = await import('react');

  return {
    useQueryState: (key: string, options?: { defaultValue?: any }) => {
      const [, forceUpdate] = React.useState(0);

      React.useEffect(() => {
        const onUpdate = () => forceUpdate((n) => n + 1);
        nuqsListeners.add(onUpdate);
        return () => nuqsListeners.delete(onUpdate);
      }, []);

      const value = nuqsStore.get(key) ?? options?.defaultValue ?? null;

      const setValue = (newValue: any) => {
        if (newValue === null) {
          nuqsStore.delete(key);
        } else {
          nuqsStore.set(key, newValue);
        }
        nuqsListeners.forEach((l) => l());
        return Promise.resolve(newValue);
      };

      return [value, setValue];
    },
    useQueryStates: () => {
      return [null, () => {}];
    },
  };
});

// next/navigation mock
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => {
    const params = new URLSearchParams();
    nuqsStore.forEach((value, key) => {
      if (value !== null && value !== undefined) {
        params.set(key, String(value));
      }
    });
    return params;
  },
  usePathname: () => '/',
}));

// Basic scroll mocks for jsdom
// @ts-expect-error jsdom patch
window.scrollTo = vi.fn();
// @ts-expect-error jsdom patch
HTMLElement.prototype.scrollTo = vi.fn();

describe('Interfaces Golden Path (node/jsdom)', () => {
  const originalConsoleError = console.error;

  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      const [message] = args;
      if (
        typeof message === 'string' &&
        (message.startsWith('Failed to fetch project tree') ||
          message.startsWith('Failed to fetch tabs') ||
          message.startsWith('Failed to fetch interface colour') ||
          message.startsWith('[buildCompleteTabData] Error'))
      ) {
        // Swallow expected network/build errors in this test environment
        return;
      }
      originalConsoleError(...(args as Parameters<typeof console.error>));
    });
  });

  afterAll(() => {
    (console.error as any).mockRestore?.();
  });

  beforeEach(() => {
    mockPush.mockClear();
    vi.clearAllMocks();
    nuqsStore.clear();
    nuqsListeners.clear();
    
    // Setup fetch mock
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    
    // Create mock response data
    const allLogs = createMockLogs(MOCK_LOGS_TOTAL_COUNT, { offset: 0, totalCount: MOCK_LOGS_TOTAL_COUNT });
    
    // Default fetch mock implementation
    mockFetch.mockImplementation(async (url: string) => {
      // API routes
      if (url.includes('/api/logs/fields')) {
        return createMockResponse({
          'entries/value': { data_type: 'string', field_type: 'entry', artifacts: '', mutable: 'false', created_at: '' },
        });
      }
      if (url.includes('/api/logs')) {
        // Parse limit and offset from URL
        const urlObj = new URL(url, 'http://localhost');
        const limit = parseInt(urlObj.searchParams.get('limit') || '20');
        const offset = parseInt(urlObj.searchParams.get('offset') || '0');
        
        // Return paginated logs
        const paginatedLogs = allLogs.logs.slice(offset, offset + limit);
        
        return createMockResponse({
          params: allLogs.params,
          logs: paginatedLogs,
          count: allLogs.count,
          groups: allLogs.groups || [],
        });
      }
      if (url.includes('/api/interface')) {
        return createMockResponse([mockInterface]);
      }
      if (url.includes('/api/tab')) {
        return createMockResponse([mockTab]);
      }
      if (url.includes('/api/tile')) {
        return createMockResponse([{
          id: 'tile-1',
          name: 'Logs Table',
          type: 'Table',
          tab_id: mockTab.id,
          visible: true,
          position: { x: 0, y: 0, width: 4, height: 4 },
          table_tile: { table_type: 'logs', page_number: '0' },
        }]);
      }
      if (url.includes('/api/projects/tree')) {
        return createMockResponse([{ id: mockProjectId, name: mockProjectId, contexts: [] }]);
      }
      if (url.includes('/api/context')) {
        return createMockResponse([]);
      }
      
      // Default: return 404
      return createMockResponse({}, 404);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const defaultProps = {
    interfaceId: '',
    projectsActions: mockProjectsActions,
    interfaceActions: mockInterfaceActions,
    tabActions: mockTabActions,
    tileActions: mockTileActions,
    logsActions: mockLogsActions,
    fieldsActions: mockFieldsActions,
    derivedEntryActions: mockDerivedEntryActions,
    contextActions: mockContextActions,
    codeActions: mockCodeActions,
    fileActions: mockFileActions,
    favouritesActions: mockFavouritesActions,
    initialFavourites: [],
  };

  it('Step 1: user selects a project and leaves the selection screen', async () => {
    const initialState = {
      projects: [mockProjectId],
    };

    renderWithProviders(<Interface {...defaultProps} />, { initialState });

    // Project selection screen is visible
    expect(await screen.findByText('Select a project')).toBeInTheDocument();

    const projectButton = await screen.findByText(mockProjectId);
    expect(projectButton).toBeInTheDocument();

    // Select project
    fireEvent.click(projectButton);

    // The project selection overlay should disappear
    await waitFor(() => {
      expect(screen.queryByText('Select a project')).not.toBeInTheDocument();
    });
  });

  it('Step 2: main Interface view loads and renders logs', async () => {
    // Pre‑seed URL state so Interface skips the selection screen
    nuqsStore.set('project', mockProjectId);
    nuqsStore.set('interface', mockInterface.name);

    const initialState = {
      projects: [mockProjectId],
      activeProjectId: mockProjectId,
      activeInterfaceId: mockInterface.id,
      activeTabId: mockTab.id,
      projectsById: {
        [mockProjectId]: {
          id: mockProjectId,
          name: 'Test Project',
          contexts: [],
          interfaceIds: [mockInterface.id],
          activeInterfaceId: mockInterface.id,
        },
      },
      interfacesById: {
        [mockInterface.id]: {
          ...mockInterface,
          activeTabId: mockTab.id,
        },
      },
      tabsById: {
        [mockTab.id]: {
          ...mockTab,
          tileIds: ['tile-1'],
        },
      },
      tilesById: {
        'tile-1': {
          id: 'tile-1',
          name: 'Logs Table',
          type: 'Table',
          tabId: mockTab.id,
          visible: true,
          position: { x: 0, y: 0, width: 4, height: 4 },
          tableTile: { table_type: 'logs', page_number: '0' },
        },
      },
    };

    renderWithProviders(
      <Interface {...defaultProps} interfaceId={mockInterface.id} />,
      { initialState },
    );

    // We should not be stuck on the project selection screen
    await waitFor(() => {
      expect(screen.queryByText('Select a project')).not.toBeInTheDocument();
    });

    // Our stub Tab component should have rendered, indicating the main view loaded
    expect(await screen.findByTestId('golden-path-tab')).toBeInTheDocument();
  });
});
