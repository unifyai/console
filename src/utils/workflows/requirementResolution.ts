/**
 * Resolve a catalogue requirement's connection state against the
 * integrations layer Console already loads.
 *
 * The catalogue is connection-agnostic on purpose — connection state changes
 * without the catalogue changing — so the route is decided here, and the
 * route decides the fix. Offering the wrong fix is worse than offering none:
 * an OAuth click does nothing for an app gated on a secret.
 */

import {
  getIntegrationProvider,
  requiredCustomerProvidedSecretKeysFor,
} from '@/constants/assistants/integrations';
import { isTriggerOnlyConnection } from '@/types/integrations';
import type { IntegrationDefinition } from '@/types/integrations';
import type { IntegrationProviderId } from '@/types/assistants/integration';
import type { CatalogRequirement } from './workflowRows';
import type { WorkflowRequirement } from '@/types/workflows';

export interface RequirementResolutionContext {
  /** Gallery definitions keyed by canonical slug. */
  definitionsBySlug: Map<string, IntegrationDefinition>;
  /** Names of secrets this assistant already holds. */
  secretNames: Set<string>;
}

/**
 * A connection counts only when it can actually execute tools. Trigger-only
 * facade rows bind provider events to workspace credentials and must never
 * read as a live account.
 */
function hasLiveConnection(definition: IntegrationDefinition): boolean {
  const usable = definition.connections.filter(
    (connection) => !isTriggerOnlyConnection(connection)
  );
  if (usable.some((connection) => connection.status === 'connected')) return true;
  return definition.status === 'connected' || definition.status === 'configured';
}

/** Workspace BYOD OAuth (Google Workspace, Microsoft 365) is secret-gated. */
function byodSecretKeys(definition: IntegrationDefinition): string[] {
  const prefix = definition.canonicalSlug.split('_')[0].toUpperCase();
  const known: Record<string, string> = {
    GMAIL: 'GOOGLE_REFRESH_TOKEN',
    GOOGLE: 'GOOGLE_REFRESH_TOKEN',
    MICROSOFT: 'MICROSOFT_REFRESH_TOKEN',
    OUTLOOK: 'MICROSOFT_REFRESH_TOKEN',
  };
  const key = known[prefix];
  return key ? [key] : [];
}

export function resolveRequirement(
  requirement: CatalogRequirement,
  context: RequirementResolutionContext
): WorkflowRequirement {
  const definition = context.definitionsBySlug.get(requirement.slug);

  // Nothing resolvable: the integrations catalogue has not answered for this
  // slug (not loaded yet, or the bundle names a slug outside the gallery's id
  // space). Unknown is not met — reporting a green check for an app nobody
  // verified is how a real app once rendered as "Built in". It is not unmet
  // either: the assistant derives the real held state, and the client must
  // not hold jobs on a check it could not run. Shout in dev so a genuinely
  // wrong slug gets fixed in the bundle.
  if (!definition) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[workflows] Requirement slug "${requirement.slug}" does not resolve to an ` +
          `integrations gallery app. Requirement slugs are provider app slugs from ` +
          `the same id space as IntegrationDefinition.canonicalSlug — fix the bundle ` +
          `manifest rather than the UI.`
      );
    }
    return {
      canonicalSlug: requirement.slug,
      displayName: requirement.name,
      via: 'unresolved',
      connected: false,
    };
  }

  const base = {
    canonicalSlug: definition.canonicalSlug,
    displayName: definition.displayName || requirement.name,
    iconUrl: definition.iconUrl ?? null,
  };

  // One route is enough: a live connection outranks a missing secret.
  if (hasLiveConnection(definition)) {
    const primary = definition.connections.find(
      (connection) => !isTriggerOnlyConnection(connection) && connection.status === 'connected'
    );
    return {
      ...base,
      via: 'connection',
      connected: true,
      accountLabel: primary?.accountLabel ?? undefined,
    };
  }

  // A native integration package is gated on its own declared secrets, not
  // on an OAuth handshake.
  const provider = getIntegrationProvider(definition.canonicalSlug as IntegrationProviderId);
  if (definition.source === 'static_package' && provider) {
    const required = requiredCustomerProvidedSecretKeysFor(provider);
    const missing = required.filter((key) => !context.secretNames.has(key));
    return {
      ...base,
      via: 'native_package',
      connected: missing.length === 0,
      missingSecrets: missing.length > 0 ? missing : undefined,
    };
  }

  const byod = byodSecretKeys(definition);
  if (byod.length > 0) {
    const missing = byod.filter((key) => !context.secretNames.has(key));
    return {
      ...base,
      via: 'secret',
      connected: missing.length === 0,
      missingSecrets: missing.length > 0 ? missing : undefined,
    };
  }

  return { ...base, via: 'connection', connected: false };
}

export function resolveRequirements(
  requirements: CatalogRequirement[],
  context: RequirementResolutionContext
): WorkflowRequirement[] {
  return requirements.map((requirement) => resolveRequirement(requirement, context));
}
