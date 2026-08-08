import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowConnectAppSheet } from '@/components/Pages/Assistants/Workflows/WorkflowConnectAppSheet';
import { mergeIntegrationDetail } from '@/hooks/Integrations/useProviderIntegrationDetail';
import type { IntegrationDefinition, IntegrationGalleryItem } from '@/types/integrations';

/**
 * Connecting an app from Workflows must be the Integrations drawer, not a
 * drawer that resembles it.
 *
 * There was a test here asserting exactly that, and it passed while the two
 * surfaces were visibly different products — because it stubbed the drawer
 * and inspected only the `item` handed to it. Data parity was real; the
 * behaviour around it was not. The Workflows mount passed ten of the
 * drawer's twenty-one props, so it had no account-label step, no
 * authorization-in-progress state, and no disconnect, cancel, reconnect,
 * test or relabel — and a connection begun there had nothing watching the
 * popup, so it never settled.
 *
 * Both surfaces now mount `ProviderConnectSurface`, which is the whole
 * flow. The structural test below is the one that would have caught it:
 * it fails if either surface starts hand-rolling the drawer again.
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
  hasLoadedRequest: true,
  requestedSlugs: [] as string[] | undefined,
  requestedQuery: undefined as string | undefined,
}));

vi.mock('@/hooks/Assistants/useProviderIntegrationCatalog', () => ({
  useProviderIntegrationCatalog: (
    _assistantId: string,
    options: { slugs?: string[]; query?: string } = {}
  ) => {
    catalogState.requestedSlugs = options.slugs;
    catalogState.requestedQuery = options.query;
    return {
      definitions: [SUMMARY],
      detailsBySlug: catalogState.detailsBySlug,
      fetchDetails: catalogState.fetchDetails,
      hasLoaded: true,
      hasLoadedRequest: catalogState.hasLoadedRequest,
      isMock: false,
      isDetailLoading: null,
      isConnecting: null,
      refresh: vi.fn(),
      startConnect: vi.fn(),
    };
  },
}));

vi.mock('@/hooks/Integrations/useIntegrationGalleryModel', () => ({
  useIntegrationGalleryModel: () => [SUMMARY],
}));

const toastCalls = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastCalls }));

// The surface itself is heavy; what matters here is the *item* it is handed.
const received = vi.hoisted(() => ({ item: null as IntegrationGalleryItem | null }));
vi.mock('@/components/Integrations', () => ({
  ProviderConnectSurface: ({ item }: { item: IntegrationGalleryItem | null }) => {
    received.item = item;
    return (
      <div data-testid="provider-drawer">
        <span data-testid="scope-count">{item?.scopes.length ?? -1}</span>
        <span data-testid="tool-count">{item?.tools.length ?? -1}</span>
      </div>
    );
  },
}));

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('the two surfaces mount the same connect flow', () => {
  const WORKFLOWS = 'src/components/Pages/Assistants/Workflows/WorkflowConnectAppSheet.tsx';
  const GALLERY = 'src/components/Pages/Assistants/Integrations/IntegrationsPane.tsx';

  it('neither surface mounts the bare drawer', () => {
    // Mounting `ProviderIntegrationDetailSheet` directly is how the two
    // drifted: the drawer renders whatever sections its props enable, so a
    // caller that omits them gets a quietly smaller product.
    for (const path of [WORKFLOWS, GALLERY]) {
      expect(read(path)).not.toContain('<ProviderIntegrationDetailSheet');
      expect(read(path)).toContain('<ProviderConnectSurface');
    }
  });

  it('keeps the connect flow in one file, not two', () => {
    // Each of these is a capability the Workflows drawer silently lacked.
    // They belong to the shared surface; a copy appearing in either caller
    // means the split has started again.
    const owned = [
      'provider-integration-connect-dialog', // account label
      'onCancelOAuthWaiting', // authorization in progress
      'onDisconnectConnection',
      'onCancelConnection',
      'onReconnectConnection',
      'onUpdateConnectionLabel',
      'onAddAnotherAccount',
      'subscribeOAuthComplete', // the popup lifecycle that settles a connection
    ];
    const surface = read('src/components/Integrations/ProviderConnectSurface.tsx');
    for (const marker of owned) {
      expect(surface, `the shared surface must own ${marker}`).toContain(marker);
      for (const path of [WORKFLOWS, GALLERY]) {
        expect(read(path), `${path} must not re-implement ${marker}`).not.toContain(marker);
      }
    }
  });
});

describe('connecting an app from Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    received.item = null;
    catalogState.detailsBySlug = {};
    catalogState.hasLoadedRequest = true;
    catalogState.requestedSlugs = undefined;
    catalogState.requestedQuery = undefined;
  });

  it('resolves the app by exact slug, never by search', () => {
    // The browse search is a substring match over display name, slug and
    // description, returned one page at a time. Asking it for `slack` and
    // reading an absent row as "not published" conflated a paging accident
    // with a missing app — and it fired the "not in the integrations
    // catalogue" toast on an app plainly in the gallery.
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

    expect(catalogState.requestedSlugs).toEqual(['slack']);
    expect(catalogState.requestedQuery).toBeUndefined();
  });

  it('waits for this request to land before calling an app missing', async () => {
    // `hasLoaded` stays true forever once set, so on a second open it
    // reported the *previous* app's answer for this one: the sheet declared
    // the app missing, toasted, and closed before its own query was issued.
    catalogState.hasLoadedRequest = false;
    const onOpenChange = vi.fn();

    render(
      <WorkflowConnectAppSheet
        assistantId="1"
        canonicalSlug="not_yet_answered"
        displayName="Pending"
        open
        onOpenChange={onOpenChange}
        onConnected={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByTestId('provider-drawer')).toBeInTheDocument());
    expect(toastCalls.error).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
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
