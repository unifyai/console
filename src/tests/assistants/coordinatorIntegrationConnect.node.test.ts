import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INTEGRATION_CONNECT_SETTLED_EVENT,
  broadcastIntegrationConnectSettled,
  shouldReturnToChatAfterAppsConnect,
  warnIfAppsDerivationMismatch,
} from '@/lib/assistants/coordinatorIntegrationConnect';
import { fetchCoordinatorState } from '@/lib/assistants/coordinatorState';
import { listProviderIntegrationConnections } from '@/lib/client/integrations';

vi.mock('@/lib/assistants/coordinatorState', () => ({
  fetchCoordinatorState: vi.fn(),
}));

vi.mock('@/lib/client/integrations', () => ({
  listProviderIntegrationConnections: vi.fn(),
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
