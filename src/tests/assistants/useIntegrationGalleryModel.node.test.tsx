import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIntegrationGalleryModel } from '@/hooks/Integrations/useIntegrationGalleryModel';
import type { IntegrationConnection, IntegrationDefinition } from '@/types/integrations';

const FACADE_SOURCE_METADATA = {
  source: 'provider_backed' as const,
  label: 'Managed app',
  backendId: 'native_google',
  providerAppId: 'google_meet',
  providerConnectionId: 'ic_ws_native_google_google_meet_2693',
};

function facadeConnection(): IntegrationConnection {
  return {
    id: 'ic_ws_native_google_google_meet_2693',
    definitionId: 'google_meet',
    canonicalSlug: 'google_meet',
    source: 'provider_backed',
    status: 'connected',
    accountLabel: null,
    sourceMetadata: FACADE_SOURCE_METADATA,
    credentialStorage: 'assistant_workspace_secrets',
  };
}

function realConnection(): IntegrationConnection {
  return {
    id: 'conn-composio-meet',
    definitionId: 'google_meet',
    canonicalSlug: 'google_meet',
    source: 'provider_backed',
    status: 'connected',
    accountLabel: 'Composio Meet',
    sourceMetadata: {
      source: 'provider_backed',
      label: 'Managed app',
      backendId: 'composio-dev',
      providerAppId: 'google_meet',
      providerConnectionId: 'conn-composio-meet',
    },
    credentialStorage: 'provider_vault',
  };
}

function baseDefinition(
  overrides: Partial<IntegrationDefinition> & { connections: IntegrationConnection[] }
): IntegrationDefinition {
  return {
    id: 'google_meet',
    canonicalSlug: 'google_meet',
    displayName: 'Google Meet',
    description: null,
    category: 'Productivity',
    iconUrl: null,
    authModes: ['oauth'],
    status: 'connected',
    source: 'provider_backed',
    sourceMetadata: FACADE_SOURCE_METADATA,
    scopes: [],
    capabilityGroups: [],
    tools: [],
    ...overrides,
  };
}

describe('useIntegrationGalleryModel', () => {
  it('buckets a facade-only app as not_connected with zero accounts', () => {
    const definition = baseDefinition({ connections: [facadeConnection()] });

    const { result } = renderHook(() =>
      useIntegrationGalleryModel({ providerDefinitions: [definition], staticDefinitions: [] })
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].status).toBe('not_connected');
    expect(result.current[0].connections).toHaveLength(0);
    expect(result.current[0].primaryConnection).toBeNull();
  });

  it('shows only the real account when an app has both a facade and a real connection', () => {
    const definition = baseDefinition({
      connections: [facadeConnection(), realConnection()],
    });

    const { result } = renderHook(() =>
      useIntegrationGalleryModel({ providerDefinitions: [definition], staticDefinitions: [] })
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].status).toBe('connected');
    expect(result.current[0].connections).toHaveLength(1);
    expect(result.current[0].connections[0]).toMatchObject({ id: 'conn-composio-meet' });
  });

  it('excludes facade-only apps from the connected count', () => {
    const facadeOnly = baseDefinition({ connections: [facadeConnection()] });
    const realApp = baseDefinition({
      id: 'slack',
      canonicalSlug: 'slack',
      displayName: 'Slack',
      connections: [
        {
          id: 'conn-slack',
          definitionId: 'slack',
          canonicalSlug: 'slack',
          source: 'provider_backed',
          status: 'connected',
          accountLabel: 'Team Slack',
          sourceMetadata: FACADE_SOURCE_METADATA,
          credentialStorage: 'provider_vault',
        },
      ],
    });

    const { result } = renderHook(() =>
      useIntegrationGalleryModel({
        providerDefinitions: [facadeOnly, realApp],
        staticDefinitions: [],
      })
    );

    const connectedItems = result.current.filter((item) => item.status === 'connected');
    expect(connectedItems).toHaveLength(1);
    expect(connectedItems[0].canonicalSlug).toBe('slack');
  });
});
