import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveRequirement } from '@/utils/workflows/requirementResolution';
import { WORKSPACE_TRIGGER_FACADE_CREDENTIAL_STORAGE } from '@/types/integrations';
import type { IntegrationConnection, IntegrationDefinition } from '@/types/integrations';

function definition(overrides: Partial<IntegrationDefinition> = {}): IntegrationDefinition {
  return {
    id: 'def',
    canonicalSlug: 'notion',
    displayName: 'Notion',
    description: null,
    category: 'Productivity',
    iconUrl: null,
    status: 'not_connected',
    authModes: ['oauth'],
    source: 'provider_backed',
    sourceMetadata: { source: 'provider_backed', label: 'Managed app' },
    scopes: [],
    capabilityGroups: [],
    tools: [],
    connections: [],
    ...overrides,
  } as unknown as IntegrationDefinition;
}

function connection(overrides: Partial<IntegrationConnection> = {}): IntegrationConnection {
  return {
    id: 'conn-1',
    canonicalSlug: 'notion',
    status: 'connected',
    ownerScope: 'assistant',
    ...overrides,
  } as unknown as IntegrationConnection;
}

function context(definitions: IntegrationDefinition[], secrets: string[] = []) {
  return {
    definitionsBySlug: new Map(definitions.map((entry) => [entry.canonicalSlug, entry])),
    secretNames: new Set(secrets),
  };
}

afterEach(() => vi.restoreAllMocks());

/**
 * The catalogue never carries connection state, so the route is resolved
 * here — and the route decides which fix the user is offered.
 */
describe('resolveRequirement', () => {
  it('reports a live provider connection as connected via connection', () => {
    const resolved = resolveRequirement(
      { slug: 'notion', name: 'Notion', kind: 'app', requiredSecrets: [] },
      context([
        definition({
          status: 'connected',
          connections: [connection({ accountLabel: 'unify' })],
        }),
      ])
    );
    expect(resolved).toMatchObject({ via: 'connection', connected: true, accountLabel: 'unify' });
  });

  it('reports an unconnected provider-backed app as connection, unmet', () => {
    const resolved = resolveRequirement(
      { slug: 'notion', name: 'Notion', kind: 'app', requiredSecrets: [] },
      context([definition()])
    );
    expect(resolved).toMatchObject({ via: 'connection', connected: false });
    expect(resolved.missingSecrets).toBeUndefined();
  });

  it('ignores a trigger-only facade row, which cannot execute tools', () => {
    const resolved = resolveRequirement(
      { slug: 'notion', name: 'Notion', kind: 'app', requiredSecrets: [] },
      context([
        definition({
          status: 'not_connected',
          connections: [
            connection({ credentialStorage: WORKSPACE_TRIGGER_FACADE_CREDENTIAL_STORAGE }),
          ],
        }),
      ])
    );
    expect(resolved.connected).toBe(false);
  });

  it('gates a native package with no connect flow on its own secrets', () => {
    // No provider auth modes, so the gallery cannot connect it and the
    // package's declared secrets really are the only signal.
    const resolved = resolveRequirement(
      { slug: 'employmenthero', name: 'Employment Hero', kind: 'app', requiredSecrets: [] },
      context([
        definition({
          canonicalSlug: 'employmenthero',
          displayName: 'Employment Hero',
          source: 'static_package',
          authModes: [],
        }),
      ])
    );
    expect(resolved.via).toBe('native_package');
    expect(resolved.connected).toBe(false);
    expect(resolved.missingSecrets?.length).toBeGreaterThan(0);
  });

  it('sends a gallery app to Connect, not to a pasted secret', () => {
    // Gmail is provider-backed with OAuth, so "not connected" means press
    // Connect. It used to route to a refresh-token secret purely because the
    // BYOD map matched on the name, which asked the user to paste a token for
    // an app the gallery can connect in two clicks.
    const gmail = definition({ canonicalSlug: 'gmail', displayName: 'Gmail' });

    const resolved = resolveRequirement(
      { slug: 'gmail', name: 'Gmail', kind: 'app', requiredSecrets: [] },
      context([gmail])
    );
    expect(resolved).toMatchObject({ via: 'connection', connected: false });
    expect(resolved.missingSecrets).toBeUndefined();
  });

  it('gives Workspace its own route, separate from integrations', () => {
    // Workspace is not in the gallery and not a package: it is connected in the
    // onboarding and profile flows, so its route is neither a gallery connect
    // nor an integration secret.
    const workspace = definition({
      canonicalSlug: 'google_workspace',
      displayName: 'Google Workspace',
      source: 'workspace_integration',
      authModes: [],
    });

    const missing = resolveRequirement(
      { slug: 'google_workspace', name: 'Google Workspace', kind: 'app', requiredSecrets: [] },
      context([workspace])
    );
    expect(missing).toMatchObject({ via: 'workspace', connected: false });
    expect(missing.missingSecrets).toEqual(['GOOGLE_REFRESH_TOKEN']);

    const present = resolveRequirement(
      { slug: 'google_workspace', name: 'Google Workspace', kind: 'app', requiredSecrets: [] },
      context([workspace], ['GOOGLE_REFRESH_TOKEN'])
    );
    expect(present).toMatchObject({ via: 'workspace', connected: true });
  });

  it('sends a native package with a connect flow to Connect, not to secrets', () => {
    // A package we author is provider-backed too, and may be OAuth or API-key.
    // Only a package with no connect flow at all is genuinely secret-gated.
    const connectable = definition({
      canonicalSlug: 'hubspot',
      displayName: 'HubSpot',
      source: 'static_package',
      authModes: ['oauth'],
    });

    expect(
      resolveRequirement(
        { slug: 'hubspot', name: 'HubSpot', kind: 'app', requiredSecrets: [] },
        context([connectable])
      )
    ).toMatchObject({ via: 'connection', connected: false });
  });

  it('lets a live connection outrank a missing secret — one route is enough', () => {
    const resolved = resolveRequirement(
      { slug: 'gmail', name: 'Gmail', kind: 'app', requiredSecrets: [] },
      context(
        [
          definition({
            canonicalSlug: 'gmail',
            displayName: 'Gmail',
            status: 'connected',
            connections: [connection({ canonicalSlug: 'gmail' })],
          }),
        ],
        [] // no GOOGLE_REFRESH_TOKEN
      )
    );
    expect(resolved).toMatchObject({ via: 'connection', connected: true });
  });

  it('reports an unresolvable slug as unverified, and shouts about it in dev', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolved = resolveRequirement(
      { slug: 'google_workspace', name: 'Google Workspace', kind: 'app', requiredSecrets: [] },
      context([])
    );

    // Unknown is not met: a fabricated green check once rendered a real
    // app as "Built in". It is not unmet either — never hold jobs on a
    // check the client could not run.
    expect(resolved).toMatchObject({ via: 'unresolved', connected: false });
    // And the bundle bug is loud rather than silent.
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain('google_workspace');
  });

  it('resolves a workspace from its secret, never from the gallery', () => {
    // The staging bug: Meeting prep required `google_workspace`, which is
    // the user's own account and deliberately not a catalogue app. The
    // resolver looked it up, found nothing, and reported "couldn't check
    // this app" about the one requirement whose answer never depended on
    // the gallery at all.
    const requirement = {
      slug: 'google_workspace',
      name: 'Google Workspace',
      kind: 'workspace',
      requiredSecrets: ['GOOGLE_REFRESH_TOKEN'],
    };

    const unconnected = resolveRequirement(requirement, context([]));
    expect(unconnected).toMatchObject({ via: 'workspace', connected: false });
    expect(unconnected.missingSecrets).toEqual(['GOOGLE_REFRESH_TOKEN']);

    const connected = resolveRequirement(requirement, context([], ['GOOGLE_REFRESH_TOKEN']));
    expect(connected).toMatchObject({ via: 'workspace', connected: true });
  });

  it('never reports a workspace as unverified, whatever the gallery holds', () => {
    const resolved = resolveRequirement(
      {
        slug: 'google_workspace',
        name: 'Google Workspace',
        kind: 'workspace',
        requiredSecrets: [],
      },
      context([])
    );
    expect(resolved.via).not.toBe('unresolved');
  });
});
