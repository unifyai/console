import * as React from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const virtualizerMockState = vi.hoisted(() => ({
  visibleRows: Number.POSITIVE_INFINITY,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => {
    const visibleRows = Math.min(count, virtualizerMockState.visibleRows);
    return {
      getTotalSize: () => count * 226,
      getVirtualItems: () =>
        Array.from({ length: visibleRows }, (_, index) => ({
          index,
          key: index,
          size: 226,
          start: index * 226,
        })),
    };
  },
}));

const integrationClientMocks = vi.hoisted(() => ({
  getProviderIntegrationToolPolicy: vi.fn(),
  patchProviderIntegrationToolPolicy: vi.fn(),
  getProviderIntegrationAppPreference: vi.fn(async () => ({
    canonicalAppSlug: 'hubspot',
    ownerScope: 'assistant',
    usageMode: 'primary',
    poolCursor: 0,
  })),
  updateProviderIntegrationAppPreference: vi.fn(async ({ usageMode }) => ({
    canonicalAppSlug: 'hubspot',
    ownerScope: 'assistant',
    usageMode,
    poolCursor: 0,
  })),
}));

vi.mock('@/lib/client/integrations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/client/integrations')>();
  return {
    ...actual,
    getProviderIntegrationToolPolicy: integrationClientMocks.getProviderIntegrationToolPolicy,
    patchProviderIntegrationToolPolicy: integrationClientMocks.patchProviderIntegrationToolPolicy,
    getProviderIntegrationAppPreference: integrationClientMocks.getProviderIntegrationAppPreference,
    updateProviderIntegrationAppPreference:
      integrationClientMocks.updateProviderIntegrationAppPreference,
  };
});

import {
  IntegrationGalleryShell,
  ProviderIntegrationCard,
  ProviderIntegrationDetailSheet,
} from '@/components/Integrations';
import { mapProviderAppToDefinition } from '@/lib/client/integrations';
import { useIntegrationGalleryModel } from '@/hooks/Integrations/useIntegrationGalleryModel';
import { INTEGRATION_PROVIDERS } from '@/constants/assistants/integrations';
import { MOCK_PROVIDER_INTEGRATION_DEFINITIONS } from '@/utils/assistants/provider-integration-mock-data';
import type { IntegrationGalleryItem } from '@/types/integrations';

const staticDefinitions = MOCK_PROVIDER_INTEGRATION_DEFINITIONS.filter(
  (definition) => definition.source === 'static_package'
);
const dynamicDefinitions = MOCK_PROVIDER_INTEGRATION_DEFINITIONS.filter(
  (definition) => definition.source !== 'static_package'
);

function useMockGalleryItems() {
  return useIntegrationGalleryModel({
    providerDefinitions: dynamicDefinitions,
    staticDefinitions,
    useMock: false,
  });
}

function buildLargeGalleryItems(
  template: IntegrationGalleryItem,
  count: number
): IntegrationGalleryItem[] {
  return Array.from({ length: count }, (_, index) => ({
    ...template,
    id: `virtual-app-${index}`,
    canonicalSlug: `virtual-app-${index}`,
    displayName: `Virtual App ${index}`,
    description: `Generated integration ${index}`,
    connections: [],
    primaryConnection: null,
    status: 'not_connected' as const,
  }));
}

function buildGalleryItem(
  template: IntegrationGalleryItem,
  overrides: Partial<IntegrationGalleryItem>
): IntegrationGalleryItem {
  return {
    ...template,
    ...overrides,
    sourceMetadata: {
      ...template.sourceMetadata,
      ...overrides.sourceMetadata,
    },
  };
}

describe('provider integrations gallery model', () => {
  beforeEach(() => {
    virtualizerMockState.visibleRows = Number.POSITIVE_INFINITY;
    integrationClientMocks.getProviderIntegrationToolPolicy.mockReset();
    integrationClientMocks.patchProviderIntegrationToolPolicy.mockReset();
    integrationClientMocks.getProviderIntegrationToolPolicy.mockResolvedValue({
      connectionId: 'mock-connection',
      canonicalAppSlug: 'hubspot',
      appDisplayName: 'HubSpot',
      accountLabel: 'Mock account',
      policies: [],
    });
    integrationClientMocks.patchProviderIntegrationToolPolicy.mockResolvedValue({
      connectionId: 'mock-connection',
      canonicalAppSlug: 'hubspot',
      appDisplayName: 'HubSpot',
      accountLabel: 'Mock account',
      policies: [],
    });
  });

  it('merges built-in and dynamic provider-backed apps into one gallery model', () => {
    const { result } = renderHook(() => useMockGalleryItems());

    const hubspot = result.current.find((item) => item.canonicalSlug === 'hubspot');
    const employmenthero = result.current.find((item) => item.canonicalSlug === 'employmenthero');

    expect(hubspot).toBeDefined();
    expect(hubspot?.sources.map((source) => source.source)).toEqual(['overlay_curated']);
    expect(employmenthero?.sources.map((source) => source.source)).toEqual(
      expect.arrayContaining(['static_package'])
    );
    expect(result.current.some((item) => item.canonicalSlug === 'slack')).toBe(true);
  });

  it('renders dynamic provider-backed apps that are not in INTEGRATION_PROVIDERS', () => {
    const staticProviderIds = new Set(INTEGRATION_PROVIDERS.map((provider) => provider.id));
    expect(staticProviderIds.has('slack' as never)).toBe(false);

    const { result } = renderHook(() => useMockGalleryItems());
    const { rerender } = render(
      <IntegrationGalleryShell
        items={result.current}
        isMock
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    fireEvent.change(screen.getByTestId('integration-gallery-search'), {
      target: { value: 'Slack' },
    });
    expect(screen.getByTestId('provider-integration-card-slack')).toBeInTheDocument();
    expect(
      result.current
        .find((item) => item.canonicalSlug === 'employmenthero')
        ?.sources.some((source) => source.source === 'static_package')
    ).toBe(true);
    expect(
      result.current
        .find((item) => item.canonicalSlug === 'hubspot')
        ?.sources.some((source) => source.source === 'static_package')
    ).toBe(false);
    expect(screen.queryByText('Provider-backed')).not.toBeInTheDocument();
    expect(screen.queryByText('Overlay curated')).not.toBeInTheDocument();
  });

  it('matches any search term in pipe-separated onboarding app queries', () => {
    const { result } = renderHook(() => useMockGalleryItems());

    const { rerender } = render(
      <IntegrationGalleryShell
        items={result.current}
        isMock
        filters={{
          query: 'github linear jira hr ops',
          category: 'all',
          semanticCategory: 'all',
          status: 'all',
        }}
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    expect(screen.queryByTestId('provider-integration-card-github')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provider-integration-card-linear')).not.toBeInTheDocument();

    rerender(
      <IntegrationGalleryShell
        items={result.current}
        isMock
        filters={{
          query: 'github|linear|jira|hr|ops',
          category: 'all',
          semanticCategory: 'all',
          status: 'all',
        }}
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    expect(screen.getByTestId('provider-integration-card-github')).toBeInTheDocument();
    expect(screen.getByTestId('provider-integration-card-linear')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-integration-card-slack')).not.toBeInTheDocument();
  });

  it('keeps mock mode aligned with the Composio first-wave catalog', () => {
    const mockSlugs = new Set(
      MOCK_PROVIDER_INTEGRATION_DEFINITIONS.map((item) => item.canonicalSlug)
    );

    for (const slug of [
      'one_drive',
      'share_point',
      'google_drive',
      'google_calendar',
      'gmail',
      'notion',
      'slack',
      'discord',
      'github',
      'linear',
      'salesforce',
      'airtable',
      'dropbox',
    ]) {
      expect(mockSlugs.has(slug)).toBe(true);
    }
    expect(dynamicDefinitions.length).toBeGreaterThanOrEqual(20);
    expect(
      dynamicDefinitions.find((definition) => definition.canonicalSlug === 'discord')?.iconUrl
    ).toMatch(/cdn\.composio\.dev/);
    expect(
      dynamicDefinitions.find((definition) => definition.canonicalSlug === 'google_drive')?.tools[0]
        ?.actionClass
    ).toBe('sensitive_read');
  });

  it('renders the redesigned user-facing gallery controls', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const refresh = vi.fn();

    const { rerender } = render(
      <IntegrationGalleryShell
        items={result.current}
        isMock
        facets={{
          total: 24,
          sourceType: { native: 2, thirdParty: 22 },
          status: {
            connected: 2,
            configured: 1,
            pending: 1,
            missingScope: 0,
            missingSecrets: 0,
            needsReconnect: 1,
            expired: 0,
            revoked: 0,
            error: 0,
            notConnected: 19,
          },
          statusGroup: {
            connected: 3,
            needsAttention: 2,
            notConnected: 19,
          },
        }}
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
        onRefresh={refresh}
      />
    );

    expect(screen.getAllByText('Connected apps').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('connected-integrations-section')).toBeInTheDocument();
    expect(screen.getByTestId('available-integrations-section')).toBeInTheDocument();
    expect(screen.getByText('Available apps')).toBeInTheDocument();
    expect(screen.getByTestId('integration-gallery-refresh')).toBeInTheDocument();
    expect(screen.getByTestId('integration-virtual-list')).toBeInTheDocument();
    expect(screen.getByTestId('integration-status-filter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs attention' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not connected' })).toBeInTheDocument();
    expect(screen.queryByText('All (24)')).not.toBeInTheDocument();
    expect(screen.getByText(/Scroll to browse the full catalog/)).toBeInTheDocument();
    expect(screen.queryByTestId('integration-page-size')).not.toBeInTheDocument();
    expect(screen.queryByText(/marketplace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/primitives\.integrations/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('integration-source-filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('integration-connected-only-filter')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('integration-gallery-refresh'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('filters gallery items by semantic provider category', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const template = result.current.find((item) => item.canonicalSlug === 'hubspot');
    expect(template).toBeDefined();
    const crm = buildGalleryItem(template!, {
      id: 'crm-app',
      canonicalSlug: 'crm-app',
      displayName: 'CRM App',
      category: 'CRM',
      status: 'not_connected',
    });
    const dev = buildGalleryItem(template!, {
      id: 'dev-app',
      canonicalSlug: 'dev-app',
      displayName: 'Dev App',
      category: 'Developer Tools',
      status: 'not_connected',
    });

    render(
      <IntegrationGalleryShell
        items={[crm, dev]}
        total={2}
        enableSemanticCategoryFilter
        facets={{
          total: 2,
          sourceType: { native: 0, thirdParty: 2 },
          status: {
            connected: 0,
            configured: 0,
            pending: 0,
            missingScope: 0,
            missingSecrets: 0,
            needsReconnect: 0,
            expired: 0,
            revoked: 0,
            error: 0,
            notConnected: 2,
          },
          statusGroup: {
            connected: 0,
            needsAttention: 0,
            notConnected: 2,
          },
          categories: [
            { value: 'crm', label: 'CRM', count: 1 },
            { value: 'developer tools', label: 'Developer Tools', count: 1 },
          ],
        }}
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'CRM' }));
    expect(screen.getByTestId('provider-integration-card-crm-app')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-integration-card-dev-app')).not.toBeInTheDocument();
  });

  it('hides semantic provider categories by default', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const template = result.current.find((item) => item.canonicalSlug === 'discord');
    expect(template).toBeDefined();

    render(
      <IntegrationGalleryShell
        items={[
          buildGalleryItem(template!, {
            id: 'crm-app',
            canonicalSlug: 'crm-app',
            displayName: 'CRM App',
            category: 'CRM',
            status: 'not_connected',
          }),
        ]}
        total={1}
        facets={{
          total: 1,
          sourceType: { native: 0, thirdParty: 1 },
          status: {
            connected: 0,
            configured: 0,
            pending: 0,
            missingScope: 0,
            missingSecrets: 0,
            needsReconnect: 0,
            expired: 0,
            revoked: 0,
            error: 0,
            notConnected: 1,
          },
          statusGroup: {
            connected: 0,
            needsAttention: 0,
            notConnected: 1,
          },
          categories: [{ value: 'crm', label: 'CRM', count: 1 }],
        }}
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    expect(screen.queryByTestId('integration-semantic-category-filter')).not.toBeInTheDocument();
  });

  it('mounts only the virtualized available-app window for large catalogs', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const template = result.current.find((item) => item.canonicalSlug === 'discord');
    expect(template).toBeDefined();
    virtualizerMockState.visibleRows = 3;

    render(
      <IntegrationGalleryShell
        items={buildLargeGalleryItems(template!, 60)}
        total={100}
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    expect(screen.getByText(/Showing 60 of 100 available apps/)).toBeInTheDocument();
    expect(screen.getByText('100 available')).toBeInTheDocument();
    expect(screen.getAllByTestId('integration-virtual-row')).toHaveLength(3);
    expect(screen.getByTestId('provider-integration-card-virtual-app-0')).toBeInTheDocument();
    expect(
      screen.queryByTestId('provider-integration-card-virtual-app-20')
    ).not.toBeInTheDocument();
  });

  it('promotes needs-attention apps above the available catalog', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const template = result.current.find((item) => item.canonicalSlug === 'discord');
    expect(template).toBeDefined();
    const items = [
      buildGalleryItem(template!, {
        id: 'connected-app',
        canonicalSlug: 'connected-app',
        displayName: 'Connected App',
        status: 'connected',
      }),
      buildGalleryItem(template!, {
        id: 'attention-app',
        canonicalSlug: 'attention-app',
        displayName: 'Attention App',
        status: 'needs_reconnect',
      }),
      ...buildLargeGalleryItems(template!, 4),
    ];

    render(
      <IntegrationGalleryShell
        items={items}
        total={12}
        facets={{
          total: 12,
          sourceType: { native: 0, thirdParty: 12 },
          status: {
            connected: 1,
            configured: 1,
            pending: 0,
            missingScope: 0,
            missingSecrets: 0,
            needsReconnect: 3,
            expired: 0,
            revoked: 0,
            error: 0,
            notConnected: 7,
          },
          statusGroup: {
            connected: 2,
            needsAttention: 3,
            notConnected: 7,
          },
        }}
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    // Under "All", connected and needs-attention apps share one pinned card.
    const pinnedSection = screen.getByTestId('connected-integrations-section');
    const availableSection = screen.getByTestId('available-integrations-section');
    expect(pinnedSection).toBeInTheDocument();
    expect(screen.queryByTestId('needs-attention-integrations-section')).not.toBeInTheDocument();
    expect(pinnedSection).toContainElement(
      screen.getByTestId('provider-integration-card-attention-app')
    );
    expect(pinnedSection).toContainElement(
      screen.getByTestId('provider-integration-card-connected-app')
    );
    expect(screen.getByText('1 connected')).toBeInTheDocument();
    expect(screen.getByText('1 need attention')).toBeInTheDocument();
    expect(screen.getByText(/Showing 4 of 7 available apps/)).toBeInTheDocument();
    expect(screen.getByText('7 available')).toBeInTheDocument();
    expect(
      pinnedSection.compareDocumentPosition(availableSection) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('requests more apps when the virtualized window reaches the end', async () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const template = result.current.find((item) => item.canonicalSlug === 'discord');
    expect(template).toBeDefined();
    const loadMore = vi.fn();
    virtualizerMockState.visibleRows = Number.POSITIVE_INFINITY;

    render(
      <IntegrationGalleryShell
        items={buildLargeGalleryItems(template!, 4)}
        total={8}
        hasMore
        onLoadMore={loadMore}
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(1));
  });

  it('does not request more apps while a load-more request is already in flight', async () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const template = result.current.find((item) => item.canonicalSlug === 'discord');
    expect(template).toBeDefined();
    const loadMore = vi.fn();
    virtualizerMockState.visibleRows = Number.POSITIVE_INFINITY;

    render(
      <IntegrationGalleryShell
        items={buildLargeGalleryItems(template!, 4)}
        total={8}
        hasMore
        isLoadingMore
        onLoadMore={loadMore}
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('integration-virtual-list-loading')).toBeInTheDocument()
    );
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('shows a centered loading message while live integrations load', () => {
    render(
      <IntegrationGalleryShell items={[]} isLoading onOpen={vi.fn()} onPrimaryAction={vi.fn()} />
    );

    expect(screen.getByTestId('integration-gallery-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Loading integrations...')).not.toBeInTheDocument();
  });

  it('uses generic card CTAs and renders app icons', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const open = vi.fn();
    const primaryAction = vi.fn();
    const { rerender } = render(
      <IntegrationGalleryShell
        items={result.current}
        isMock
        onOpen={open}
        onPrimaryAction={primaryAction}
      />
    );

    const discord = result.current.find((item) => item.canonicalSlug === 'discord');
    expect(discord?.iconUrl).toBeTruthy();
    const discordCard = screen.getByTestId('provider-integration-card-discord');
    expect(discordCard.querySelector('img')).toBeInTheDocument();
    expect(discordCard).toHaveTextContent('Third-party');
    expect(discordCard).not.toHaveTextContent('Communication');
    expect(screen.getByTestId('integration-card-details-discord')).toHaveTextContent(
      'View details'
    );
    expect(screen.getByTestId('integration-card-primary-discord')).toHaveTextContent('Connect');
    expect(screen.queryByText('Add API key')).not.toBeInTheDocument();
    expect(screen.queryByText('Review permissions')).not.toBeInTheDocument();

    fireEvent.click(discordCard);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ canonicalSlug: 'discord' }));

    fireEvent.click(screen.getByTestId('integration-card-details-discord'));
    expect(open).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('integration-card-primary-discord'));
    expect(primaryAction).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalSlug: 'discord' })
    );
    expect(open).toHaveBeenCalledTimes(2);

    rerender(
      <IntegrationGalleryShell
        items={[
          {
            ...discord!,
            id: 'native-test',
            canonicalSlug: 'native-test',
            displayName: 'Native Test',
            category: 'Operations',
            source: 'static_package' as const,
            sourceMetadata: {
              source: 'static_package' as const,
              label: 'Native connector',
            },
            sources: [
              {
                source: 'static_package' as const,
                label: 'Native connector',
              },
            ],
          },
        ]}
        isMock
        onOpen={open}
        onPrimaryAction={primaryAction}
      />
    );
    const nativeCard = screen.getByTestId('provider-integration-card-native-test');
    expect(nativeCard).toHaveTextContent('Native');
    expect(nativeCard).not.toHaveTextContent('Operations');
  });

  it('shows access, credential form, and a compact expandable tools list in the detail sheet', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const clay = result.current.find((item) => item.canonicalSlug === 'clay');
    expect(clay).toBeDefined();
    const clayWithMultipleScopes = {
      ...clay!,
      scopes: [...clay!.scopes, { id: 'records:read', label: 'Read records', required: true }],
      tools: [
        ...clay!.tools,
        {
          id: 'clay.lookup_record',
          name: 'lookup_record',
          displayName: 'Lookup record',
          description: 'Read an existing Clay record.',
          providerToolId: 'CLAY_LOOKUP_RECORD',
          activationState: 'not_connected' as const,
          actionClass: 'read' as const,
          requiredScopes: [{ id: 'records:read', label: 'Read records', required: true }],
        },
      ],
    };

    render(
      <ProviderIntegrationDetailSheet
        item={clayWithMultipleScopes}
        open
        onOpenChange={vi.fn()}
        onPrimaryAction={vi.fn()}
        onApiKeySubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId('provider-permission-review')).toBeInTheDocument();
    expect(screen.getByText('Access scopes')).toBeInTheDocument();
    expect(screen.getByText('2 scopes')).toBeInTheDocument();
    expect(screen.queryByTestId('integration-scope-search')).not.toBeInTheDocument();
    expect(screen.getByTestId('integration-permission-list')).toHaveTextContent('enrich:write');
    expect(screen.getByTestId('integration-permission-list')).not.toHaveTextContent(
      'Run Enrichments'
    );
    expect(screen.getByTestId('provider-api-key-form')).toBeInTheDocument();
    expect(screen.queryByTestId('integration-actor-visibility')).not.toBeInTheDocument();
    expect(screen.getByText('Available tools')).toBeInTheDocument();
    expect(screen.getByText('2 tools')).toBeInTheDocument();
    expect(screen.getByText('Enrich company')).toBeInTheDocument();
    expect(screen.getByText('Lookup record')).toBeInTheDocument();
    expect(screen.queryByText('CLAY_ENRICH_COMPANY')).not.toBeInTheDocument();
    // The drawer takes the shared width from the sheet primitive rather than
    // picking its own — it used to open at 960px while Workflows opened at
    // 640px and Functions at 42rem, so the panel resized between tabs.
    expect(screen.getByTestId('provider-integration-detail-sheet')).toHaveClass(
      'w-[min(96vw,max(40vw,26rem))]'
    );
    const toolRow = screen.getByTestId('integration-tool-row-clay.enrich_company');
    expect(toolRow).toHaveTextContent('1.');
    expect(toolRow).toHaveTextContent('enrich:write');
    expect(toolRow).not.toHaveTextContent('Run a company enrichment workflow.');
    fireEvent.click(screen.getByTestId('integration-scope-tag-enrich:write'));
    expect(screen.getByText('1 tools')).toBeInTheDocument();
    expect(screen.getByTestId('integration-scope-tag-enrich:write')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('Enrich company')).toBeInTheDocument();
    expect(screen.queryByText('Lookup record')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('integration-scope-tag-records:read'));
    expect(screen.getByTestId('integration-scope-tag-enrich:write')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('integration-scope-tag-records:read')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('2 tools')).toBeInTheDocument();
    expect(screen.getByText('Enrich company')).toBeInTheDocument();
    expect(screen.getByText('Lookup record')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('integration-tool-scope-filter-clear'));
    expect(screen.getByText('2 tools')).toBeInTheDocument();
    expect(screen.getByText('Lookup record')).toBeInTheDocument();
    fireEvent.click(toolRow.querySelector('button')!);
    expect(screen.getAllByText('Run a company enrichment workflow.')).toHaveLength(1);
  });

  it('renders an api-key app drawer from a raw JSON-schema without crashing', async () => {
    const definition = mapProviderAppToDefinition({
      backendId: 'composio',
      providerAppId: 'ANTHROPIC_ADMINISTRATOR',
      canonicalAppSlug: 'anthropic_administrator',
      displayName: 'Anthropic Administrator',
      sourceType: 'third_party',
      authModes: ['api_key'],
      availableScopes: [],
      toolCount: 0,
      apiKeySchema: {
        type: 'object',
        required: ['generic_api_key'],
        properties: {
          genericApiKey: {
            type: 'string',
            title: 'Admin API Key',
            secret: true,
            description:
              "The Admin API key used for authentication, starting with 'sk-ant-admin...'.",
          },
        },
      },
    });
    const item = {
      ...definition,
      sources: [definition.sourceMetadata],
      primaryConnection: null,
    } as IntegrationGalleryItem;

    render(
      <ProviderIntegrationDetailSheet
        item={item}
        open
        onOpenChange={vi.fn()}
        onPrimaryAction={vi.fn()}
        onApiKeySubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId('provider-api-key-form')).toBeInTheDocument();
    expect(screen.getByTestId('provider-api-key-field-genericApiKey')).toBeInTheDocument();
    expect(screen.getByText('Admin API Key')).toBeInTheDocument();
  });

  it('shows connected account chips on gallery cards', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const hubspot = result.current.find((item) => item.canonicalSlug === 'hubspot');
    expect(hubspot).toBeDefined();
    render(<ProviderIntegrationCard item={hubspot!} onOpen={vi.fn()} onPrimaryAction={vi.fn()} />);
    expect(screen.getByTestId('integration-card-accounts-hubspot')).toHaveTextContent('2 accounts');
  });

  it('shows waiting and success multi-add loop banners on the detail sheet', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const hubspot = result.current.find((item) => item.canonicalSlug === 'hubspot');
    expect(hubspot).toBeDefined();
    const onAddAnother = vi.fn();
    const onDone = vi.fn();
    const onCancelWaiting = vi.fn();

    const { rerender } = render(
      <ProviderIntegrationDetailSheet
        item={hubspot ?? null}
        open={Boolean(hubspot)}
        onOpenChange={vi.fn()}
        onPrimaryAction={vi.fn()}
        oauthWaiting={{
          canonicalSlug: 'hubspot',
          displayName: 'HubSpot',
          accountLabel: 'rate-limit-bot',
          connectUrl: 'https://example.com/oauth',
          mode: 'popup',
        }}
        onCancelOAuthWaiting={onCancelWaiting}
        onCopyOAuthAuthorizeUrl={vi.fn()}
      />
    );

    expect(screen.getByTestId('integration-oauth-waiting')).toBeInTheDocument();
    expect(screen.getByTestId('integration-oauth-waiting')).toHaveTextContent('rate-limit-bot');
    fireEvent.click(screen.getByTestId('integration-oauth-waiting-cancel'));
    expect(onCancelWaiting).toHaveBeenCalled();

    rerender(
      <ProviderIntegrationDetailSheet
        item={hubspot ?? null}
        open={Boolean(hubspot)}
        onOpenChange={vi.fn()}
        onPrimaryAction={vi.fn()}
        connectSuccess={{
          canonicalSlug: 'hubspot',
          displayName: 'HubSpot',
          accountLabel: 'rate-limit-bot',
          accountCount: 3,
        }}
        onAddAnotherAccount={onAddAnother}
        onDismissConnectSuccess={onDone}
      />
    );

    expect(screen.getByTestId('integration-connect-success')).toBeInTheDocument();
    expect(screen.getByTestId('integration-connect-success')).toHaveTextContent(
      '3 accounts on this assistant'
    );
    fireEvent.click(screen.getByTestId('integration-connect-add-another'));
    expect(onAddAnother).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('integration-connect-success-done'));
    expect(onDone).toHaveBeenCalled();
  });

  it('places connected app management controls at the top of the detail sheet', async () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const hubspot = result.current.find((item) => item.canonicalSlug === 'hubspot');
    expect(hubspot).toBeDefined();
    const updateLabel = vi.fn().mockResolvedValue(undefined);
    const onPrimaryAction = vi.fn();

    render(
      <ProviderIntegrationDetailSheet
        item={hubspot ?? null}
        open={Boolean(hubspot)}
        onOpenChange={vi.fn()}
        onPrimaryAction={onPrimaryAction}
        onUpdateConnectionLabel={updateLabel}
      />
    );

    const management = screen.getByText('Connections');
    expect(management).toBeInTheDocument();
    expect(screen.getByText('Manage accounts and labels.')).toBeInTheDocument();
    expect(screen.getByTestId('integration-connect-another-account')).toBeInTheDocument();
    expect(screen.getByTestId('integration-connect-another-account')).toHaveTextContent(
      'Add account'
    );
    expect(screen.queryByTestId('integration-account-label-input')).not.toBeInTheDocument();
    const connectedConnection = hubspot!.connections.find(
      (connection) => connection.status !== 'disconnected'
    );
    expect(connectedConnection).toBeDefined();
    fireEvent.click(
      screen.getByTestId(`integration-account-label-rename-${connectedConnection!.id}`)
    );
    fireEvent.change(
      screen.getByTestId(`integration-account-label-edit-${connectedConnection!.id}`),
      {
        target: { value: 'Work HubSpot' },
      }
    );
    fireEvent.click(
      screen.getByTestId(`integration-account-label-save-${connectedConnection!.id}`)
    );
    await waitFor(() => {
      expect(updateLabel).toHaveBeenCalledWith(
        expect.objectContaining({ id: connectedConnection!.id }),
        'Work HubSpot'
      );
    });
    fireEvent.click(screen.getByTestId('integration-connect-another-account'));
    expect(onPrimaryAction).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalSlug: 'hubspot' })
    );
    expect(screen.queryByTestId('integration-account-label-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('integration-secure-connection-summary')).toHaveTextContent(
      'Secure connection'
    );
    expect(
      management.compareDocumentPosition(screen.getByText('Access scopes')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('requires an account before editing per-connection tool policy', async () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const hubspot = result.current.find((item) => item.canonicalSlug === 'hubspot');
    expect(hubspot).toBeDefined();
    const policyForConnection = (connectionId: string) => ({
      connectionId,
      canonicalAppSlug: 'hubspot',
      appDisplayName: 'HubSpot',
      accountLabel:
        connectionId === 'mock-hubspot-personal-connection' ? 'Personal HubSpot' : 'Work HubSpot',
      policies: [
        {
          toolId: 'hubspot.search_contacts',
          providerToolId: 'HUBSPOT_SEARCH_CONTACTS',
          canonicalName: 'primitives.integrations.hubspot.search_contacts',
          displayName: 'Search contacts',
          actionClass: 'read',
          behaviorHints: ['read_only'],
          defaultApprovalLevel: 'auto',
          approvalLevel: connectionId === 'mock-hubspot-personal-connection' ? 'forbidden' : 'auto',
          activationState: 'connected_ready',
          confirmationRequired: false,
        },
        {
          toolId: 'hubspot.update_contact',
          providerToolId: 'HUBSPOT_UPDATE_CONTACT',
          canonicalName: 'primitives.integrations.hubspot.update_contact',
          displayName: 'Update contact',
          actionClass: 'write',
          behaviorHints: ['mutates_state'],
          defaultApprovalLevel: 'specific_approval',
          approvalLevel: 'specific_approval',
          activationState: 'connected_ready',
          confirmationRequired: true,
        },
      ],
    });
    integrationClientMocks.getProviderIntegrationToolPolicy.mockImplementation((connectionId) =>
      Promise.resolve(policyForConnection(String(connectionId)))
    );
    integrationClientMocks.patchProviderIntegrationToolPolicy.mockImplementation((connectionId) =>
      Promise.resolve({
        ...policyForConnection(String(connectionId)),
        policies: policyForConnection(String(connectionId)).policies.map((policy) =>
          policy.toolId === 'hubspot.search_contacts'
            ? { ...policy, approvalLevel: 'forbidden' }
            : policy
        ),
      })
    );

    render(
      <ProviderIntegrationDetailSheet
        item={hubspot ?? null}
        open={Boolean(hubspot)}
        assistantId="123"
        onOpenChange={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    expect(screen.getByTestId('integration-policy-account-required')).toHaveTextContent(
      'Select which HubSpot account to edit'
    );
    expect(integrationClientMocks.getProviderIntegrationToolPolicy).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('integration-tool-policy-hubspot.search_contacts')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('integration-account-select-mock-hubspot-work-connection'));

    await waitFor(() => {
      expect(integrationClientMocks.getProviderIntegrationToolPolicy).toHaveBeenCalledWith(
        'mock-hubspot-work-connection',
        { ownerScope: 'assistant', assistantId: '123' }
      );
    });
    const workSummary = screen.getByTestId('integration-secure-connection-summary');
    expect(workSummary).toHaveTextContent('Tool permissions for HubSpot · Work HubSpot');
    // Counts reflect the effective level of every tool (search_contacts → auto,
    // update_contact → specific_approval), matching the Available tools list.
    expect(workSummary).toHaveTextContent('1 allow');
    expect(workSummary).toHaveTextContent('1 ask every time');
    expect(workSummary).toHaveTextContent('0 blocked');
    const searchPolicy = screen.getByTestId('integration-tool-policy-hubspot.search_contacts');
    fireEvent.click(within(searchPolicy).getByRole('button', { name: 'Block for this account' }));

    await waitFor(() => {
      expect(integrationClientMocks.patchProviderIntegrationToolPolicy).toHaveBeenCalledWith(
        'mock-hubspot-work-connection',
        { toolPolicies: { 'hubspot.search_contacts': 'forbidden' } },
        { ownerScope: 'assistant', assistantId: '123' }
      );
    });

    fireEvent.click(
      screen.getByTestId('integration-account-select-mock-hubspot-personal-connection')
    );

    await waitFor(() => {
      expect(integrationClientMocks.getProviderIntegrationToolPolicy).toHaveBeenCalledWith(
        'mock-hubspot-personal-connection',
        { ownerScope: 'assistant', assistantId: '123' }
      );
    });
    const personalSummary = screen.getByTestId('integration-secure-connection-summary');
    expect(personalSummary).toHaveTextContent('Tool permissions for HubSpot · Personal HubSpot');
    // Personal account blocks search_contacts, so the counts shift accordingly.
    expect(personalSummary).toHaveTextContent('0 allow');
    expect(personalSummary).toHaveTextContent('1 ask every time');
    expect(personalSummary).toHaveTextContent('1 blocked');
  });

  it('derives risk badges from public action and behavior fields only', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const clay = result.current.find((item) => item.canonicalSlug === 'clay');
    expect(clay).toBeDefined();
    const providerAgnosticItem = {
      ...clay!,
      tools: [
        {
          id: 'provider.noisy_read',
          name: 'dangerous_destroy_everything',
          displayName: 'Noisy read',
          description: 'Provider text says destructive and sensitive, but metadata says read-only.',
          providerToolId: 'COMPOSIO_DANGEROUS_DELETE',
          activationState: 'not_connected' as const,
          actionClass: 'read' as const,
          behaviorHints: ['read_only' as const],
          requiredScopes: [],
        },
        {
          id: 'provider.sensitive_lookup',
          name: 'lookup',
          displayName: 'Sensitive lookup',
          description: 'Read private records.',
          providerToolId: 'LOOKUP',
          activationState: 'not_connected' as const,
          actionClass: 'read' as const,
          behaviorHints: ['sensitive_data' as const],
          requiredScopes: [],
        },
      ],
    };

    render(
      <ProviderIntegrationDetailSheet
        item={providerAgnosticItem}
        open
        onOpenChange={vi.fn()}
        onPrimaryAction={vi.fn()}
        onApiKeySubmit={vi.fn()}
      />
    );

    const noisyRead = screen.getByTestId('integration-tool-row-provider.noisy_read');
    expect(noisyRead).not.toHaveTextContent('Destructive');
    expect(noisyRead).not.toHaveTextContent('Sensitive data');
    expect(noisyRead).not.toHaveTextContent('Can change data');
    expect(screen.getByTestId('integration-tool-row-provider.sensitive_lookup')).toHaveTextContent(
      'Sensitive data'
    );
  });

  it('starts the same connect flow from the detail sheet primary action', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const slack = result.current.find((item) => item.canonicalSlug === 'slack');
    expect(slack).toBeDefined();
    const onPrimaryAction = vi.fn();

    render(
      <ProviderIntegrationDetailSheet
        item={{ ...slack!, status: 'not_connected' as const, connections: [] }}
        open
        onOpenChange={vi.fn()}
        onPrimaryAction={onPrimaryAction}
      />
    );

    expect(screen.queryByTestId('integration-account-label-input')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('provider-integration-primary-action'));
    expect(onPrimaryAction).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalSlug: 'slack' })
    );
  });

  it('shows pending reset controls and human health labels in the detail sheet', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const discord = result.current.find((item) => item.canonicalSlug === 'discord');
    expect(discord).toBeDefined();
    const pendingDiscord = {
      ...discord!,
      status: 'pending' as const,
      connections: [
        {
          id: 'ic_pending_discord',
          definitionId: 'discord',
          canonicalSlug: 'discord',
          source: 'provider_backed' as const,
          status: 'pending' as const,
          accountLabel: 'Authorization in progress',
          healthLabel: 'ok',
          sourceMetadata: discord!.sourceMetadata,
        },
      ],
    };
    const cancel = vi.fn();

    render(
      <ProviderIntegrationDetailSheet
        item={pendingDiscord}
        open
        onOpenChange={vi.fn()}
        onPrimaryAction={vi.fn()}
        onCancelConnection={cancel}
      />
    );

    expect(screen.getByText('Healthy')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('integration-cancel-ic_pending_discord'));
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
