'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader } from '@/components/Common/Loader';
import {
  completeProviderIntegrationConnectionByProviderId,
  completeProviderIntegrationConnection,
  requestUnityIntegrationToolsSync,
  testProviderIntegration,
} from '@/lib/client/integrations';
import { broadcastOAuthComplete } from '@/utils/assistants/oauth';

function providerParam(params: URLSearchParams, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value;
  }
  return null;
}

function resultQuery(result: 'success' | 'error', detail?: string): string {
  const params = new URLSearchParams({ flow: 'provider-integrations' });
  if (result === 'success') {
    params.set('integration_success', 'provider');
  } else {
    params.set('integration_error', detail || 'provider_callback_failed');
  }
  return params.toString();
}

function completeAndClose(returnTo: string | null, result: 'success' | 'error', detail?: string) {
  const query = resultQuery(result, detail);
  window.dispatchEvent(
    new CustomEvent('unify:provider-integration-callback-redirect', { detail: { query, returnTo } })
  );
  if (navigator.userAgent.includes('jsdom')) return;
  broadcastOAuthComplete({ query, kind: 'integration' });
  try {
    window.setTimeout(() => window.close(), 50);
    window.setTimeout(() => {
      const destination = returnTo || '/assistants';
      const sep = destination.includes('?') ? '&' : '?';
      window.location.replace(`${destination}${sep}${query}`);
    }, 900);
  } catch {
    // jsdom cannot perform full navigation; the event above keeps tests deterministic.
  }
}

function assistantIdFromReturnTo(returnTo: string | null): string | null {
  if (!returnTo) return null;
  try {
    const url = new URL(returnTo, window.location.origin);
    const profile = url.searchParams.get('profile');
    if (profile) return profile;
    const match = url.pathname.match(/^\/assistants\/([^/?#]+)/);
    return match?.[1] ?? null;
  } catch {
    const profileMatch = returnTo.match(/[?&]profile=([^&#]+)/);
    if (profileMatch?.[1]) return decodeURIComponent(profileMatch[1]);
    const pathMatch = returnTo.match(/\/assistants\/([^/?#]+)/);
    return pathMatch?.[1] ?? null;
  }
}

function assistantIdForCallback(params: URLSearchParams, returnTo: string | null): string | null {
  return providerParam(params, 'assistant_id', 'assistantId') || assistantIdFromReturnTo(returnTo);
}

async function persistFailedConnection(params: URLSearchParams, reason: string): Promise<void> {
  const connectionId = providerParam(params, 'connection_id', 'alias', 'state');
  const providerConnectionId = providerParam(
    params,
    'connected_account_id',
    'connectedAccountId',
    'provider_connection_id',
    'account_id'
  );
  if (connectionId) {
    await completeProviderIntegrationConnection(connectionId, {
      status: 'error',
      reconnectReason: reason,
    });
    return;
  }
  if (providerConnectionId) {
    await completeProviderIntegrationConnectionByProviderId({
      providerConnectionId,
      status: 'error',
      reconnectReason: reason,
    });
  }
}

function ProviderIntegrationCallback() {
  const searchParams = useSearchParams();
  const hasSubmittedRef = React.useRef(false);
  const [message, setMessage] = React.useState('Completing integration connection...');

  React.useEffect(() => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const params = new URLSearchParams(searchParams.toString());
    const returnTo = params.get('return');
    const providerError = providerParam(params, 'error', 'error_description');
    const connectionId = providerParam(params, 'connection_id', 'alias', 'state');
    const providerConnectionId = providerParam(
      params,
      'connected_account_id',
      'connectedAccountId',
      'provider_connection_id',
      'account_id'
    );
    if (providerError) {
      setMessage('Integration authorization failed. Returning to Console...');
      void persistFailedConnection(params, providerError).finally(() => {
        completeAndClose(returnTo, 'error', providerError);
      });
      return;
    }

    if (!connectionId && !providerConnectionId) {
      setMessage(
        'We could not match this authorization to an integration. Returning to Console...'
      );
      completeAndClose(returnTo, 'error', 'connection_not_found');
      return;
    }

    const grantedScopes = providerParam(params, 'granted_scopes', 'scope')
      ?.split(/[,\s]+/)
      .filter(Boolean);
    const externalAccountLabel = providerParam(
      params,
      'external_account_label',
      'account_label',
      'email'
    );

    void (async () => {
      try {
        const assistantId = assistantIdForCallback(params, returnTo);
        const connection = connectionId
          ? await completeProviderIntegrationConnection(connectionId, {
              providerConnectionId,
              grantedScopes,
              externalAccountLabel,
              status: 'connected',
            })
          : await completeProviderIntegrationConnectionByProviderId({
              providerConnectionId: providerConnectionId!,
              ...(assistantId ? { ownerScope: 'assistant', assistantId } : {}),
              grantedScopes,
              externalAccountLabel,
              status: 'connected',
            });
        await testProviderIntegration(connection.id);
        if (assistantId) {
          await requestUnityIntegrationToolsSync({ assistantId, connection }).catch((error) => {
            console.warn('Failed to request Droid integration tool sync', error);
          });
        }
        setMessage('Integration connected. Returning to Console...');
        completeAndClose(returnTo, 'success');
      } catch (error) {
        console.error('Failed to complete provider integration callback', error);
        setMessage('We could not finish connecting this app. Returning to Console...');
        completeAndClose(returnTo, 'error', 'connection_not_found');
      }
    })();
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
        <Loader size={24} />
        <p className="text-body-muted">{message}</p>
      </div>
    </main>
  );
}

export default function ProviderIntegrationCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Loader size={24} />
            <p className="text-body-muted">Completing integration connection...</p>
          </div>
        </main>
      }
    >
      <ProviderIntegrationCallback />
    </React.Suspense>
  );
}
