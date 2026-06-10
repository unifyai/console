'use client';

import * as React from 'react';
import type {
  IntegrationDefinition,
  IntegrationGalleryItem,
  IntegrationConnectionStatus,
} from '@/types/integrations';

const STATUS_RANK: Record<IntegrationConnectionStatus, number> = {
  connected: 100,
  configured: 95,
  pending: 80,
  ['missing_scope']: 70,
  ['needs_reconnect']: 65,
  ['missing_secrets']: 60,
  expired: 55,
  revoked: 50,
  error: 45,
  disconnected: 20,
  ['not_connected']: 10,
};

function bestStatus(definitions: IntegrationDefinition[]): IntegrationConnectionStatus {
  return (
    definitions
      .map((definition) => definition.status)
      .sort((a, b) => STATUS_RANK[b] - STATUS_RANK[a])[0] ?? 'not_connected'
  );
}

function mergeDefinitionGroup(
  definitions: IntegrationDefinition[],
  isMock: boolean
): IntegrationGalleryItem {
  const preferred =
    definitions.find((definition) => definition.source === 'overlay_curated') ??
    definitions.find((definition) => definition.source === 'provider_backed') ??
    definitions[0];
  const connections = definitions
    .flatMap((definition) => definition.connections)
    .filter((connection) => connection.status !== 'disconnected');
  const toolsById = new Map(
    definitions.flatMap((definition) => definition.tools).map((tool) => [tool.id, tool])
  );
  const scopesById = new Map(
    definitions.flatMap((definition) => definition.scopes).map((scope) => [scope.id, scope])
  );
  const capabilityGroupsById = new Map(
    definitions
      .flatMap((definition) => definition.capabilityGroups)
      .map((capabilityGroup) => [capabilityGroup.id, capabilityGroup])
  );
  const primaryConnection =
    connections.slice().sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])[0] ?? null;

  return {
    ...preferred,
    status: bestStatus(definitions),
    scopes: Array.from(scopesById.values()),
    capabilityGroups: Array.from(capabilityGroupsById.values()),
    tools: Array.from(toolsById.values()),
    connections,
    sources: definitions.map((definition) => definition.sourceMetadata),
    primaryConnection,
    isMock,
  };
}

export function useIntegrationGalleryModel({
  providerDefinitions,
  staticDefinitions,
  customDefinition,
  mockDefinitions,
  useMock,
}: {
  providerDefinitions: IntegrationDefinition[];
  staticDefinitions: IntegrationDefinition[];
  customDefinition?: IntegrationDefinition;
  mockDefinitions?: IntegrationDefinition[];
  useMock?: boolean;
}) {
  return React.useMemo<IntegrationGalleryItem[]>(() => {
    const definitions = useMock
      ? (mockDefinitions ?? [])
      : [
          ...providerDefinitions,
          ...staticDefinitions,
          ...(customDefinition ? [customDefinition] : []),
        ];
    const bySlug = new Map<string, IntegrationDefinition[]>();
    for (const definition of definitions) {
      const list = bySlug.get(definition.canonicalSlug) ?? [];
      list.push(definition);
      bySlug.set(definition.canonicalSlug, list);
    }
    return Array.from(bySlug.values())
      .map((group) => mergeDefinitionGroup(group, Boolean(useMock)))
      .sort((a, b) => {
        const statusDelta = STATUS_RANK[b.status] - STATUS_RANK[a.status];
        if (statusDelta !== 0) return statusDelta;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [customDefinition, mockDefinitions, providerDefinitions, staticDefinitions, useMock]);
}
