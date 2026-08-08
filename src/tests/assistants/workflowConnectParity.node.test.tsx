import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowConnectAppSheet } from '@/components/Pages/Assistants/Workflows/WorkflowConnectAppSheet';
import { mergeIntegrationDetail } from '@/hooks/Integrations/useProviderIntegrationDetail';
import type { IntegrationDefinition, IntegrationGalleryItem } from '@/types/integrations';

/**
 * Connecting an app from Workflows must be the Integrations drawer, not a
 * drawer that resembles it.
 *
 * Mounting the same component was not enough. The gallery list carries a
 * *summary* — the per-app detail supplies scopes, the tool list, the
 * API-key schema and the bring-your-own-OAuth fields — so the workflow
 * sheet, which never fetched the detail, showed Slack with its scopes and
 * none of its 157 tools. Every existing test stubbed the drawer, so the
 * difference was invisible to all of them.
 */
const SUMMARY: IntegrationGalleryItem = {
  id: 'slack',
  canonicalSlug: 'slack',
  displayName: 'Slack',
  description: 'Team Chat',
  category: 'Communication',
  iconUrl: null,
  authModes: ['oauth'],
  source: 'provider_backed',
  sourceMetadata: {
    source: 'provider_backed',
    label: 'Managed app',
    backendId: 'composio',
    providerAppId: 'SLACK',
  },
  status: 'not_connected',
  scopes: [],
  capabilityGroups: [],
  tools: [],
  connections: [],
  sources: [],
} as unknown as IntegrationGalleryItem;

const DETAIL: IntegrationDefinition = {
  ...SUMMARY,
  scopes: [
    { id: 'chat:write', label: 'Send messages', required: true },
    { id: 'channels:read', label: 'Read channels' },
  ],
  tools: [
    {
      id: 'slack.send',
      name: 'send_message',
      displayName: 'Send message',
      description: 'Post a message to a channel.',
      providerToolId: 'SLACK_SEND',
      canonicalName: 'primitives.integrations.slack.send_message',
      activationState: 'not_connected',
      actionClass: 'write',
    },
  ],
  apiKeySchema: undefined,
} as unknown as IntegrationDefinition;

const catalogState = vi.hoisted(() => ({
  detailsBySlug: {} as Record<string, IntegrationDefinition>,
  fetchDetails: vi.fn(),
}));

vi.mock('@/hooks/Assistants/useProviderIntegrationCatalog', () => ({
  useProviderIntegrationCatalog: () => ({
    definitions: [SUMMARY],
    detailsBySlug: catalogState.detailsBySlug,
    fetchDetails: catalogState.fetchDetails,
    hasLoaded: true,
    isMock: false,
    isDetailLoading: null,
    isConnecting: null,
    startConnect: vi.fn(),
  }),
}));

vi.mock('@/hooks/Integrations/useIntegrationGalleryModel', () => ({
  useIntegrationGalleryModel: () => [SUMMARY],
}));

const toastCalls = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastCalls }));

// The drawer itself is heavy; what matters here is the *item* it is handed.
const received = vi.hoisted(() => ({ item: null as IntegrationGalleryItem | null }));
vi.mock('@/components/Integrations', () => ({
  ProviderIntegrationDetailSheet: ({ item }: { item: IntegrationGalleryItem | null }) => {
    received.item = item;
    return (
      <div data-testid="provider-drawer">
        <span data-testid="scope-count">{item?.scopes.length ?? -1}</span>
        <span data-testid="tool-count">{item?.tools.length ?? -1}</span>
      </div>
    );
  },
}));

describe('connecting an app from Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    received.item = null;
    catalogState.detailsBySlug = {};
  });

  it('fetches the app detail, as the Integrations tab does', async () => {
    render(
      <WorkflowConnectAppSheet
        assistantId="1"
        canonicalSlug="slack"
        displayName="Slack"
        open
        onOpenChange={vi.fn()}
        onConnected={vi.fn()}
      />
    );

    await waitFor(() => expect(catalogState.fetchDetails).toHaveBeenCalled());
    expect(catalogState.fetchDetails.mock.calls[0][0]).toMatchObject({ canonicalSlug: 'slack' });
  });

  it('hands the drawer the detail, not the list summary', async () => {
    catalogState.detailsBySlug = { slack: DETAIL };

    render(
      <WorkflowConnectAppSheet
        assistantId="1"
        canonicalSlug="slack"
        displayName="Slack"
        open
        onOpenChange={vi.fn()}
        onConnected={vi.fn()}
      />
    );

    // The summary carries neither; the drawer must still show both.
    await waitFor(() => expect(screen.getByTestId('scope-count')).toHaveTextContent('2'));
    expect(screen.getByTestId('tool-count')).toHaveTextContent('1');
  });

  it('never reports a connection that did not happen', async () => {
    // The old fallback: a slug the catalogue does not carry called
    // `onConnected`, so the shelf toasted "Gmail connected", armed the held
    // jobs, and left the app unconnected. Telling the user the opposite of
    // what happened is worse than any dead end.
    const onConnected = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <WorkflowConnectAppSheet
        assistantId="1"
        canonicalSlug="not_in_the_gallery"
        displayName="Nowhere"
        open
        onOpenChange={onOpenChange}
        onConnected={onConnected}
      />
    );

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onConnected).not.toHaveBeenCalled();
    expect(toastCalls.error).toHaveBeenCalled();
  });
});

describe('mergeIntegrationDetail', () => {
  it('adds what the summary lacks without blanking what it has', () => {
    const merged = mergeIntegrationDetail(SUMMARY, DETAIL);
    expect(merged.scopes).toHaveLength(2);
    expect(merged.tools).toHaveLength(1);

    // Connection state belongs to the list, which the catalogue refreshes;
    // the detail is a snapshot and must not overwrite it.
    const connected = { ...SUMMARY, status: 'connected' } as IntegrationGalleryItem;
    expect(mergeIntegrationDetail(connected, DETAIL).status).toBe('connected');

    // A detail that answered with nothing leaves the summary intact.
    const empty = { ...DETAIL, scopes: [], tools: [] } as IntegrationDefinition;
    const withScopes = { ...SUMMARY, scopes: DETAIL.scopes } as IntegrationGalleryItem;
    expect(mergeIntegrationDetail(withScopes, empty).scopes).toHaveLength(2);
  });
});
