import * as React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationsPane } from '@/components/Pages/Assistants/Integrations/IntegrationsPane';
import { useAssistantSecrets } from '@/hooks/Assistants/useAssistantSecrets';
import { useProviderIntegrationCatalog } from '@/hooks/Assistants/useProviderIntegrationCatalog';
import type {
  IntegrationConnectionStatus,
  IntegrationDefinition,
  IntegrationGalleryItem,
} from '@/types/integrations';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(),
    message: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/hooks/Assistants/useAssistantSecrets', () => ({
  useAssistantSecrets: vi.fn(),
}));

vi.mock('@/hooks/Assistants/useAssistantIntegrations', () => ({
  disconnectIntegration: vi.fn(),
  isWorkspaceManagedSecretName: vi.fn(() => false),
  partitionForIntegrations: vi.fn(() => ({ cards: [], otherSecrets: [] })),
  startOAuthConnect: vi.fn(),
  useIntegrationCallbackFlash: vi.fn(() => ({
    clear: vi.fn(),
    error: null,
    success: null,
  })),
}));

vi.mock('@/hooks/Assistants/useProviderIntegrationCatalog', () => ({
  useProviderIntegrationCatalog: vi.fn(),
}));

vi.mock('@/utils/assistants/oauth', () => ({
  openPendingOAuthTab: vi.fn(() => ({
    close: vi.fn(),
    navigate: vi.fn(),
    opened: true,
  })),
  subscribeOAuthComplete: vi.fn(() => vi.fn()),
}));

// The gallery shell is stubbed to a list of buttons; everything else in the
// barrel stays real, because the disconnect flow under test now lives in
// `ProviderConnectSurface` and stubbing it out would test nothing.
vi.mock('@/components/Integrations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/Integrations')>()),
  IntegrationGalleryShell: ({
    filters,
    items,
    onOpen,
    onFiltersChange,
    total,
    enableSemanticCategoryFilter,
  }: {
    filters?: {
      query: string;
      category: string;
      semanticCategory: string;
      status: 'all' | 'connected' | 'needs_attention' | 'not_connected';
    };
    items: IntegrationGalleryItem[];
    onOpen: (item: IntegrationGalleryItem) => void;
    onFiltersChange?: (filters: {
      query: string;
      category: string;
      semanticCategory: string;
      status: 'all' | 'connected' | 'needs_attention' | 'not_connected';
    }) => void;
    total?: number;
    enableSemanticCategoryFilter?: boolean;
  }) => (
    <div data-testid="integration-gallery">
      <div data-testid="integration-gallery-total">{total}</div>
      <div data-testid="integration-gallery-semantic-category">{filters?.semanticCategory}</div>
      <div data-testid="integration-gallery-semantic-enabled">
        {String(Boolean(enableSemanticCategoryFilter))}
      </div>
      <button
        type="button"
        data-testid="integration-gallery-third-party-filter"
        onClick={() =>
          onFiltersChange?.({
            query: '',
            category: 'third_party',
            semanticCategory: 'all',
            status: 'all',
          })
        }
      >
        Third-party
      </button>
      <div data-testid="integration-gallery-category">{filters?.category}</div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid={`open-integration-${item.canonicalSlug}`}
          onClick={() => onOpen(item)}
        >
          Open {item.displayName}
        </button>
      ))}
    </div>
  ),
}));

// The drawer itself is stubbed where the surface imports it, so the surface —
// which owns the disconnect confirm, the request and the refresh — is real.
vi.mock('@/components/Integrations/ProviderIntegrationDetailSheet', () => ({
  ProviderIntegrationDetailSheet: ({
    item,
    onDisconnectConnection,
    open,
  }: {
    item: IntegrationGalleryItem | null;
    onDisconnectConnection?: (connection: IntegrationGalleryItem['connections'][number]) => void;
    open: boolean;
  }) => {
    if (!open || !item || item.connections.length === 0) return null;
    const connection = item.connections[0];
    return (
      <button
        type="button"
        data-testid={`integration-disconnect-${connection.id}`}
        onClick={() => onDisconnectConnection?.(connection)}
      >
        Disconnect connection
      </button>
    );
  },
}));

vi.mock('@/components/Pages/Assistants/Integrations/ApiKeyIntegrationDialog', () => ({
  ApiKeyIntegrationDialog: () => null,
}));

vi.mock('@/components/Pages/Assistants/Integrations/OAuthIntegrationDialog', () => ({
  OAuthIntegrationDialog: () => null,
}));

vi.mock('@/components/Pages/Assistants/Secrets/SecretFormDialog', () => ({
  SecretFormDialog: () => null,
}));

vi.mock('@/components/Pages/Assistants/Secrets/JsonUploadPreviewDialog', () => ({
  JsonUploadPreviewDialog: () => null,
}));

const mockUseAssistantSecrets = vi.mocked(useAssistantSecrets);
const mockUseProviderIntegrationCatalog = vi.mocked(useProviderIntegrationCatalog);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildProviderDefinition(status: IntegrationConnectionStatus): IntegrationDefinition {
  const sourceMetadata = {
    source: 'provider_backed' as const,
    label: 'Managed app',
    backendId: 'composio-dev',
    providerAppId: 'slack',
    providerConnectionId: 'conn-slack',
  };
  return {
    id: 'slack',
    canonicalSlug: 'slack',
    displayName: 'Slack',
    description: null,
    category: 'Communication',
    iconUrl: null,
    authModes: ['oauth'],
    status,
    source: 'provider_backed',
    sourceMetadata,
    scopes: [],
    capabilityGroups: [],
    tools: [],
    connections: [
      {
        id: 'conn-slack',
        definitionId: 'slack',
        canonicalSlug: 'slack',
        source: 'provider_backed',
        status,
        accountLabel: 'Team Slack',
        sourceMetadata,
      },
    ],
  };
}

describe('IntegrationsPane provider disconnect sync', () => {
  let fetchDetails: ReturnType<typeof vi.fn>;
  let refreshProviderCatalog: ReturnType<typeof vi.fn>;
  let systemEventStatus: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    systemEventStatus = 202;
    fetchDetails = vi.fn().mockResolvedValue(null);
    refreshProviderCatalog = vi.fn().mockResolvedValue(undefined);

    mockUseAssistantSecrets.mockReturnValue({
      cancelUploadJson: vi.fn(),
      confirmUploadJson: vi.fn(),
      fetchSecrets: vi.fn(),
      formMethods: {},
      handleNewSecret: vi.fn(),
      isSubmitting: false,
      onSubmit: vi.fn(),
      pendingUpload: null,
      secrets: [],
    } as unknown as ReturnType<typeof useAssistantSecrets>);

    vi.spyOn(window, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/integrations/provider/connections/conn-slack/disconnect') {
        expect(init).toMatchObject({ method: 'POST' });
        return jsonResponse({ ok: true });
      }
      if (url === '/api/assistant/123/system-event') {
        return jsonResponse({ accepted: systemEventStatus < 400 }, systemEventStatus);
      }
      return jsonResponse({ error: `Unexpected fetch: ${url}` }, 404);
    });
  });

  function renderPane(status: IntegrationConnectionStatus = 'needs_reconnect') {
    const definition = buildProviderDefinition(status);
    fetchDetails.mockResolvedValue(definition);
    mockUseProviderIntegrationCatalog.mockReturnValue({
      apps: [definition],
      catalogVersion: null,
      definitions: [definition],
      detailsBySlug: {},
      facets: null,
      fetchDetails: fetchDetails as ReturnType<
        typeof useProviderIntegrationCatalog
      >['fetchDetails'],
      generatedAt: null,
      hasMore: false,
      hasLoaded: true,
      hasLoadedRequest: true,
      isConnecting: null,
      isDetailLoading: null,
      isLoadingMore: false,
      isLoading: false,
      isMock: false,
      loadMore: vi.fn(),
      refresh: refreshProviderCatalog as ReturnType<
        typeof useProviderIntegrationCatalog
      >['refresh'],
      startConnect: vi.fn(),
      total: 1,
    });

    render(
      <IntegrationsPane assistantId="123" ownerId="owner" secretActions={{} as never} isVisible />
    );

    fireEvent.click(screen.getByTestId('open-integration-slack'));
  }

  async function disconnectAndConfirm() {
    await waitFor(() => expect(fetchDetails).toHaveBeenCalled());
    fetchDetails.mockClear();

    fireEvent.click(screen.getByTestId('integration-disconnect-conn-slack'));
    const dialog = await screen.findByTestId('provider-integration-disconnect-confirm');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
  }

  it('requests Unity cleanup sync after provider disconnect succeeds', async () => {
    renderPane('needs_reconnect');
    await disconnectAndConfirm();

    await waitFor(() =>
      expect(window.fetch).toHaveBeenCalledWith(
        '/api/assistant/123/system-event',
        expect.objectContaining({ method: 'POST' })
      )
    );
    const systemEventCall = vi
      .mocked(window.fetch)
      .mock.calls.find(([input]) => String(input) === '/api/assistant/123/system-event');
    expect(systemEventCall).toBeDefined();
    expect(JSON.parse(String(systemEventCall?.[1]?.body))).toMatchObject({
      eventType: 'integration_tools_sync_requested',
      message: 'slack integration disconnected; removing tools.',
      extraEventFields: {
        appSlug: 'slack',
        backendId: 'composio-dev',
        connectionId: 'conn-slack',
        operation: 'cleanup',
      },
    });
    expect(refreshProviderCatalog).toHaveBeenCalledTimes(1);
    expect(fetchDetails).toHaveBeenCalledTimes(1);
  });

  it('does not include native static definitions in third-party catalog totals', async () => {
    mockUseProviderIntegrationCatalog.mockReturnValue({
      apps: [],
      catalogVersion: null,
      definitions: [],
      detailsBySlug: {},
      facets: null,
      fetchDetails: fetchDetails as ReturnType<
        typeof useProviderIntegrationCatalog
      >['fetchDetails'],
      generatedAt: null,
      hasMore: false,
      hasLoaded: true,
      hasLoadedRequest: true,
      isConnecting: null,
      isDetailLoading: null,
      isLoadingMore: false,
      isLoading: false,
      isMock: false,
      loadMore: vi.fn(),
      refresh: refreshProviderCatalog as ReturnType<
        typeof useProviderIntegrationCatalog
      >['refresh'],
      startConnect: vi.fn(),
      total: 1046,
    });

    render(
      <IntegrationsPane assistantId="123" ownerId="owner" secretActions={{} as never} isVisible />
    );

    expect(screen.getByTestId('integration-gallery-total')).toHaveTextContent('1049');
    fireEvent.click(screen.getByTestId('integration-gallery-third-party-filter'));

    await waitFor(() => {
      expect(screen.getByTestId('integration-gallery-category')).toHaveTextContent('third_party');
      expect(screen.getByTestId('integration-gallery-total')).toHaveTextContent('1046');
    });
  });

  it('strips semantic category filters while integration labels are disabled', async () => {
    mockUseProviderIntegrationCatalog.mockReturnValue({
      apps: [],
      catalogVersion: null,
      definitions: [],
      detailsBySlug: {},
      facets: null,
      fetchDetails: fetchDetails as ReturnType<
        typeof useProviderIntegrationCatalog
      >['fetchDetails'],
      generatedAt: null,
      hasMore: false,
      hasLoaded: true,
      hasLoadedRequest: true,
      isConnecting: null,
      isDetailLoading: null,
      isLoadingMore: false,
      isLoading: false,
      isMock: false,
      loadMore: vi.fn(),
      refresh: refreshProviderCatalog as ReturnType<
        typeof useProviderIntegrationCatalog
      >['refresh'],
      startConnect: vi.fn(),
      total: 0,
    });

    render(
      <IntegrationsPane
        assistantId="123"
        ownerId="owner"
        secretActions={{} as never}
        isVisible
        initialGalleryFilters={{ query: 'crm sales', semanticCategory: 'crm' }}
      />
    );

    await waitFor(() =>
      expect(mockUseProviderIntegrationCatalog).toHaveBeenLastCalledWith(
        '123',
        expect.objectContaining({
          query: 'crm sales',
          category: null,
        })
      )
    );
    expect(screen.getByTestId('integration-gallery-semantic-category')).toHaveTextContent('all');
    expect(screen.getByTestId('integration-gallery-semantic-enabled')).toHaveTextContent('false');
  });

  it('refreshes disconnect UI state when Unity cleanup sync fails', async () => {
    systemEventStatus = 500;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderPane('needs_reconnect');
    await disconnectAndConfirm();

    await waitFor(() => expect(refreshProviderCatalog).toHaveBeenCalledTimes(1));
    expect(fetchDetails).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to request Unity integration tool sync after disconnect',
      expect.any(Error)
    );
  });
});
