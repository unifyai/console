import * as React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProviderIntegrationCallbackPage from '@/app/integrations/callback/page';
import {
  completeProviderIntegrationConnectionByProviderId,
  completeProviderIntegrationConnection,
  requestUnityIntegrationToolsSync,
  testProviderIntegration,
} from '@/lib/client/integrations';

let currentSearch = '';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock('@/utils/assistants/oauth', () => ({
  broadcastOAuthComplete: vi.fn(),
}));

vi.mock('@/lib/client/integrations', () => ({
  completeProviderIntegrationConnection: vi.fn().mockResolvedValue({
    id: 'ic_discord',
    canonicalSlug: 'discord',
    status: 'connected',
  }),
  completeProviderIntegrationConnectionByProviderId: vi.fn().mockResolvedValue({
    id: 'ic_discord',
    canonicalSlug: 'discord',
    status: 'connected',
  }),
  requestUnityIntegrationToolsSync: vi.fn().mockResolvedValue(undefined),
  testProviderIntegration: vi.fn().mockResolvedValue({ id: 'ic_discord' }),
}));

describe('provider integration callback page', () => {
  let completions: Array<{ query: string; returnTo: string | null }>;

  beforeEach(() => {
    vi.clearAllMocks();
    currentSearch =
      'connection_id=ic_discord&connected_account_id=ca_discord&scope=guilds%20messages.read&email=discord@example.com&return=/assistants/123';
    completions = [];
    window.addEventListener('unify:provider-integration-callback-redirect', (event) => {
      completions.push((event as CustomEvent<{ query: string; returnTo: string | null }>).detail);
    });
  });

  it('completes and tests the provider connection before bouncing back', async () => {
    render(<ProviderIntegrationCallbackPage />);

    expect(screen.getByText('Completing integration connection...')).toBeInTheDocument();
    await waitFor(() =>
      expect(completeProviderIntegrationConnection).toHaveBeenCalledWith('ic_discord', {
        providerConnectionId: 'ca_discord',
        grantedScopes: ['guilds', 'messages.read'],
        externalAccountLabel: 'discord@example.com',
        status: 'connected',
      })
    );
    expect(testProviderIntegration).toHaveBeenCalledWith('ic_discord');
    expect(requestUnityIntegrationToolsSync).toHaveBeenCalledWith({
      assistantId: '123',
      connection: expect.objectContaining({ id: 'ic_discord', canonicalSlug: 'discord' }),
    });
    await waitFor(() =>
      expect(completions).toContainEqual({
        returnTo: '/assistants/123',
        query: 'flow=provider-integrations&integration_success=provider',
      })
    );
  });

  it('bounces with an error when the provider callback omits connection id', async () => {
    currentSearch = 'error=access_denied&return=/assistants/123';

    render(<ProviderIntegrationCallbackPage />);

    await waitFor(() =>
      expect(completions).toContainEqual({
        returnTo: '/assistants/123',
        query: 'flow=provider-integrations&integration_error=access_denied',
      })
    );
    expect(completeProviderIntegrationConnection).not.toHaveBeenCalled();
    expect(requestUnityIntegrationToolsSync).not.toHaveBeenCalled();
  });

  it('completes by provider account id when the provider omits local connection id', async () => {
    currentSearch = 'connected_account_id=ca_discord&scope=guilds&return=/assistants/123';

    render(<ProviderIntegrationCallbackPage />);

    await waitFor(() =>
      expect(completeProviderIntegrationConnectionByProviderId).toHaveBeenCalledWith({
        providerConnectionId: 'ca_discord',
        ownerScope: 'assistant',
        assistantId: '123',
        grantedScopes: ['guilds'],
        externalAccountLabel: null,
        status: 'connected',
      })
    );
    expect(completeProviderIntegrationConnection).not.toHaveBeenCalled();
    expect(testProviderIntegration).toHaveBeenCalledWith('ic_discord');
    expect(requestUnityIntegrationToolsSync).toHaveBeenCalledWith({
      assistantId: '123',
      connection: expect.objectContaining({ id: 'ic_discord', canonicalSlug: 'discord' }),
    });
  });

  it('extracts assistant id from realistic assistants profile return URLs', async () => {
    currentSearch =
      'connection_id=ic_discord&connected_account_id=ca_discord&return=/assistants?profile=123';

    render(<ProviderIntegrationCallbackPage />);

    await waitFor(() =>
      expect(requestUnityIntegrationToolsSync).toHaveBeenCalledWith({
        assistantId: '123',
        connection: expect.objectContaining({ id: 'ic_discord', canonicalSlug: 'discord' }),
      })
    );
  });

  it('prefers explicit assistant_id from callback params', async () => {
    currentSearch =
      'connection_id=ic_discord&connected_account_id=ca_discord&assistant_id=456&return=/assistants?profile=123';

    render(<ProviderIntegrationCallbackPage />);

    await waitFor(() =>
      expect(requestUnityIntegrationToolsSync).toHaveBeenCalledWith({
        assistantId: '456',
        connection: expect.objectContaining({ id: 'ic_discord', canonicalSlug: 'discord' }),
      })
    );
  });
});
