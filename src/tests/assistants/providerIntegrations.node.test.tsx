import * as React from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

import { IntegrationGalleryShell, ProviderIntegrationDetailSheet } from '@/components/Integrations';
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

describe('provider integrations gallery model', () => {
  beforeEach(() => {
    virtualizerMockState.visibleRows = Number.POSITIVE_INFINITY;
  });

  it('merges built-in and dynamic provider-backed apps into one gallery model', () => {
    const { result } = renderHook(() => useMockGalleryItems());

    const hubspot = result.current.find((item) => item.canonicalSlug === 'hubspot');

    expect(hubspot).toBeDefined();
    expect(hubspot?.sources.map((source) => source.source)).toEqual(
      expect.arrayContaining(['static_package', 'overlay_curated'])
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
        .find((item) => item.canonicalSlug === 'hubspot')
        ?.sources.some((source) => source.source === 'static_package')
    ).toBe(true);
    expect(screen.queryByText('Provider-backed')).not.toBeInTheDocument();
    expect(screen.queryByText('Overlay curated')).not.toBeInTheDocument();
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
    expect(screen.getByText(/Scroll to browse the full catalog/)).toBeInTheDocument();
    expect(screen.queryByTestId('integration-page-size')).not.toBeInTheDocument();
    expect(screen.queryByText(/marketplace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/primitives\.integrations/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('integration-source-filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('integration-connected-only-filter')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('integration-gallery-refresh'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('mounts only the virtualized available-app window for large catalogs', () => {
    const { result } = renderHook(() => useMockGalleryItems());
    const template = result.current.find((item) => item.canonicalSlug === 'discord');
    expect(template).toBeDefined();
    virtualizerMockState.visibleRows = 3;

    render(
      <IntegrationGalleryShell
        items={buildLargeGalleryItems(template!, 60)}
        total={60}
        onOpen={vi.fn()}
        onPrimaryAction={vi.fn()}
      />
    );

    expect(screen.getByText(/Showing 60 matching apps/)).toBeInTheDocument();
    expect(screen.getAllByTestId('integration-virtual-row')).toHaveLength(3);
    expect(screen.getByTestId('provider-integration-card-virtual-app-0')).toBeInTheDocument();
    expect(
      screen.queryByTestId('provider-integration-card-virtual-app-20')
    ).not.toBeInTheDocument();
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
    expect(screen.getByText('Loading available integrations...')).toBeInTheDocument();
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
    expect(screen.getByTestId('provider-integration-detail-sheet')).toHaveClass(
      '!max-w-[calc(100vw-2rem)]'
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
