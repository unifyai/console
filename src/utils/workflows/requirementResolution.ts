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

/**
 * Whether the gallery itself can connect this app.
 *
 * If it can, "not connected" means "press Connect" and nothing else — offering
 * a pasted secret instead sends the user to type a refresh token for an app
 * that supports OAuth. Gmail is exactly that case: provider-backed, OAuth, and
 * previously routed to a secret because the BYOD map matched on its name.
 */
function connectableViaGallery(definition: IntegrationDefinition): boolean {
  const providerBacked =
    definition.source === 'provider_backed' ||
    definition.source === 'overlay_curated' ||
    definition.source === 'static_package';
  return (
    providerBacked &&
    definition.authModes.some(
      (mode) => mode === 'oauth' || mode === 'api_key' || mode === 'api_key_multi'
    )
  );
}

/**
 * The refresh-token secret a Workspace connection is signalled by.
 *
 * Keyed off the provider family, and only ever consulted for a definition the
 * gallery does not connect. Matching on the name alone is what previously sent
 * Gmail — a provider-backed OAuth app — to a pasted-token form.
 */
function workspaceSecretKeys(definition: IntegrationDefinition): string[] {
  const prefix = definition.canonicalSlug.split('_')[0].toUpperCase();
  const known: Record<string, string> = {
    GOOGLE: 'GOOGLE_REFRESH_TOKEN',
    GMAIL: 'GOOGLE_REFRESH_TOKEN',
    MICROSOFT: 'MICROSOFT_REFRESH_TOKEN',
    OUTLOOK: 'MICROSOFT_REFRESH_TOKEN',
  };
  const key = known[prefix];
  return key ? [key] : [];
}

/**
 * A requirement the bundle lets the user satisfy more than one way.
 *
 * Each option resolves exactly like a requirement of its own and the first
 * connected one settles it, recommendation order deciding ties. The whole
 * set travels on the answer so the surface can offer the app the user
 * already has instead of the one named first — declaring Slack and stopping
 * there shuts out everyone on Discord for a workflow that serves them the
 * same.
 */
function resolveChoice(
  requirement: CatalogRequirement,
  context: RequirementResolutionContext
): WorkflowRequirement {
  const resolved = [
    { slug: requirement.slug, name: requirement.name },
    ...requirement.alternatives,
  ].map((option) =>
    resolveRequirement(
      { ...requirement, slug: option.slug, name: option.name, alternatives: [] },
      context
    )
  );

  const options = resolved.map((option) => ({
    canonicalSlug: option.canonicalSlug,
    displayName: option.displayName,
    iconUrl: option.iconUrl,
    iconComponent: option.iconComponent,
    connected: option.connected,
  }));

  const satisfied = resolved.find((option) => option.connected);
  return { ...(satisfied ?? resolved[0]), options };
}

export function resolveRequirement(
  requirement: CatalogRequirement,
  context: RequirementResolutionContext
): WorkflowRequirement {
  if (requirement.alternatives.length > 0) return resolveChoice(requirement, context);

  // Workspace first, and without consulting the gallery at all. It is the
  // user's own Google or Microsoft account, connected in their profile —
  // deliberately not a catalogue app — so a slug lookup finds nothing and
  // reports "couldn't check this app" about the one requirement whose
  // answer never depended on the gallery. Its signal is the refresh-token
  // secret the connect flow stores, which the bundle names.
  if (requirement.kind === 'workspace') {
    const declared = requirement.requiredSecrets ?? [];
    const missing = declared.filter((name) => !context.secretNames.has(name));
    return {
      canonicalSlug: requirement.slug,
      displayName: requirement.name,
      via: 'workspace',
      connected: declared.length > 0 && missing.length === 0,
      missingSecrets: missing.length > 0 ? missing : undefined,
    };
  }

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

  // Provider-backed comes first, and that includes the native packages we
  // author: either kind may be OAuth, an API key, or both, and all of them
  // connect through the gallery's own flow.
  if (connectableViaGallery(definition)) {
    return { ...base, via: 'connection', connected: false };
  }

  // A native package with no connect flow really is gated on its own declared
  // secrets, so it answers for itself.
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

  // Workspace: not in the gallery, not a package, connected elsewhere.
  if (definition.source === 'workspace_integration') {
    const keys = workspaceSecretKeys(definition);
    const missing = keys.filter((key) => !context.secretNames.has(key));
    return {
      ...base,
      via: 'workspace',
      connected: keys.length > 0 && missing.length === 0,
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
