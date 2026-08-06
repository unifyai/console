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
      { slug: 'notion', name: 'Notion' },
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
      { slug: 'notion', name: 'Notion' },
      context([definition()])
    );
    expect(resolved).toMatchObject({ via: 'connection', connected: false });
    expect(resolved.missingSecrets).toBeUndefined();
  });

  it('ignores a trigger-only facade row, which cannot execute tools', () => {
    const resolved = resolveRequirement(
      { slug: 'notion', name: 'Notion' },
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

  it('gates a native package on its own declared secrets', () => {
    const resolved = resolveRequirement(
      { slug: 'employmenthero', name: 'Employment Hero' },
      context([
        definition({
          canonicalSlug: 'employmenthero',
          displayName: 'Employment Hero',
          source: 'static_package',
        }),
      ])
    );
    expect(resolved.via).toBe('native_package');
    expect(resolved.connected).toBe(false);
    expect(resolved.missingSecrets?.length).toBeGreaterThan(0);
  });

  it('gates a BYOD OAuth workspace app on its refresh-token secret', () => {
    const gmail = definition({ canonicalSlug: 'gmail', displayName: 'Gmail' });

    const missing = resolveRequirement({ slug: 'gmail', name: 'Gmail' }, context([gmail]));
    expect(missing).toMatchObject({ via: 'secret', connected: false });
    expect(missing.missingSecrets).toEqual(['GOOGLE_REFRESH_TOKEN']);

    const present = resolveRequirement(
      { slug: 'gmail', name: 'Gmail' },
      context([gmail], ['GOOGLE_REFRESH_TOKEN'])
    );
    expect(present).toMatchObject({ via: 'secret', connected: true });
    expect(present.missingSecrets).toBeUndefined();
  });

  it('lets a live connection outrank a missing secret — one route is enough', () => {
    const resolved = resolveRequirement(
      { slug: 'gmail', name: 'Gmail' },
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

  it('treats an unresolvable slug as met, and shouts about it in dev', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolved = resolveRequirement(
      { slug: 'google_workspace', name: 'Google Workspace' },
      context([])
    );

    // Never a blank chip that dead-ends: it reads as met…
    expect(resolved).toMatchObject({ via: 'undeclared', connected: true });
    // …but the bundle bug is loud rather than silent.
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain('google_workspace');
  });
});
