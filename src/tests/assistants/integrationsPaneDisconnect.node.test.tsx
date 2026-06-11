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

vi.mock('@/components/Integrations', () => ({
  IntegrationGalleryShell: ({
    items,
    onOpen,
  }: {
    items: IntegrationGalleryItem[];
    onOpen: (item: IntegrationGalleryItem) => void;
  }) => (
    <div data-testid="integration-gallery">
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
      definitions: [definition],
      detailsBySlug: {},
      fetchDetails: fetchDetails as ReturnType<
        typeof useProviderIntegrationCatalog
      >['fetchDetails'],
      hasLoaded: true,
      isConnecting: null,
      isDetailLoading: null,
      isLoading: false,
      isMock: false,
      refresh: refreshProviderCatalog as ReturnType<
        typeof useProviderIntegrationCatalog
      >['refresh'],
      startConnect: vi.fn(),
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
      },
    });
    expect(refreshProviderCatalog).toHaveBeenCalledTimes(1);
    expect(fetchDetails).toHaveBeenCalledTimes(1);
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
