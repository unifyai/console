import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INTEGRATION_CONNECT_SETTLED_EVENT,
  INTEGRATION_DISCONNECT_SETTLED_EVENT,
  broadcastIntegrationConnectSettled,
  broadcastIntegrationDisconnectSettled,
  disconnectConnectedIntegrationsForAppsReset,
  shouldReturnToChatAfterAppsConnect,
  warnIfAppsDerivationMismatch,
} from '@/lib/assistants/coordinatorIntegrationConnect';
import { fetchCoordinatorState } from '@/lib/assistants/coordinatorState';
import {
  disconnectProviderIntegration,
  listProviderIntegrationConnections,
  requestUnityIntegrationToolsSync,
} from '@/lib/client/integrations';

vi.mock('@/lib/assistants/coordinatorState', () => ({
  fetchCoordinatorState: vi.fn(),
}));

vi.mock('@/lib/client/integrations', () => ({
  listProviderIntegrationConnections: vi.fn(),
  disconnectProviderIntegration: vi.fn(),
  requestUnityIntegrationToolsSync: vi.fn(),
}));

describe('shouldReturnToChatAfterAppsConnect', () => {
  it('returns true only when armed and apps completed', () => {
    expect(
      shouldReturnToChatAfterAppsConnect({
        armed: true,
        completedStepIds: ['email-reference', 'apps'],
      })
    ).toBe(true);
  });

  it('returns false when not armed', () => {
    expect(
      shouldReturnToChatAfterAppsConnect({
        armed: false,
        completedStepIds: ['apps'],
      })
    ).toBe(false);
  });

  it('returns false when apps is not complete', () => {
    expect(
      shouldReturnToChatAfterAppsConnect({
        armed: true,
        completedStepIds: ['email-reference'],
      })
    ).toBe(false);
  });
});

describe('broadcastIntegrationConnectSettled', () => {
  it('dispatches a settled event with assistant id and auth mode', () => {
    const handler = vi.fn();
    window.addEventListener(INTEGRATION_CONNECT_SETTLED_EVENT, handler);
    broadcastIntegrationConnectSettled({ assistantId: '2103', authMode: 'api_key' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]?.detail).toEqual({
      assistantId: '2103',
      authMode: 'api_key',
    });
    window.removeEventListener(INTEGRATION_CONNECT_SETTLED_EVENT, handler);
  });
});

describe('broadcastIntegrationDisconnectSettled', () => {
  it('dispatches a disconnect settled event with connection ids', () => {
    const handler = vi.fn();
    window.addEventListener(INTEGRATION_DISCONNECT_SETTLED_EVENT, handler);
    broadcastIntegrationDisconnectSettled({
      assistantId: '2103',
      reason: 'apps_step_reset',
      connectionIds: ['ic_1', 'ic_2'],
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]?.detail).toEqual({
      assistantId: '2103',
      reason: 'apps_step_reset',
      connectionIds: ['ic_1', 'ic_2'],
    });
    window.removeEventListener(INTEGRATION_DISCONNECT_SETTLED_EVENT, handler);
  });
});

describe('disconnectConnectedIntegrationsForAppsReset', () => {
  beforeEach(() => {
    vi.mocked(listProviderIntegrationConnections).mockReset();
    vi.mocked(disconnectProviderIntegration).mockReset();
    vi.mocked(requestUnityIntegrationToolsSync).mockReset();
    vi.mocked(requestUnityIntegrationToolsSync).mockResolvedValue(undefined);
  });

  it('disconnects only connected coordinator integrations', async () => {
    vi.mocked(listProviderIntegrationConnections).mockResolvedValue([
      { id: 'ic_connected', status: 'connected', canonicalSlug: 'slack' },
      { id: 'ic_pending', status: 'pending', canonicalSlug: 'github' },
    ] as never);
    vi.mocked(disconnectProviderIntegration).mockResolvedValue(undefined);

    const disconnectedIds = await disconnectConnectedIntegrationsForAppsReset({
      coordinatorId: 2103,
    });

    expect(disconnectedIds).toEqual(['ic_connected']);
    expect(disconnectProviderIntegration).toHaveBeenCalledTimes(1);
    expect(disconnectProviderIntegration).toHaveBeenCalledWith('ic_connected');
    expect(requestUnityIntegrationToolsSync).toHaveBeenCalledWith({
      assistantId: 2103,
      connection: expect.objectContaining({ id: 'ic_connected' }),
      reason: 'disconnected',
    });
    expect(listProviderIntegrationConnections).toHaveBeenCalledWith({
      ownerScope: 'assistant',
      assistantId: 2103,
    });
  });

  it('returns an empty list when nothing is connected', async () => {
    vi.mocked(listProviderIntegrationConnections).mockResolvedValue([
      { id: 'ic_pending', status: 'pending', canonicalSlug: 'github' },
    ] as never);

    const disconnectedIds = await disconnectConnectedIntegrationsForAppsReset({
      coordinatorId: 2103,
    });

    expect(disconnectedIds).toEqual([]);
    expect(disconnectProviderIntegration).not.toHaveBeenCalled();
  });
});

describe('warnIfAppsDerivationMismatch', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    warnSpy.mockClear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns when a connected integration exists but apps is missing', async () => {
    vi.mocked(fetchCoordinatorState).mockResolvedValue({
      completedStepIds: ['email-reference'],
    } as never);
    vi.mocked(listProviderIntegrationConnections).mockResolvedValue([
      { id: 'ic_1', status: 'connected' },
    ] as never);

    await warnIfAppsDerivationMismatch(2103);

    expect(warnSpy).toHaveBeenCalledWith(
      '[onboarding] Connected integration exists but apps is not in completedStepIds',
      expect.objectContaining({
        coordinatorId: '2103',
        connectionIds: ['ic_1'],
        completedStepIds: ['email-reference'],
      })
    );
  });

  it('does not warn when apps is already derived', async () => {
    vi.mocked(fetchCoordinatorState).mockResolvedValue({
      completedStepIds: ['apps'],
    } as never);
    vi.mocked(listProviderIntegrationConnections).mockResolvedValue([
      { id: 'ic_1', status: 'connected' },
    ] as never);

    await warnIfAppsDerivationMismatch(2103);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
