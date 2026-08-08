import { getIntegrationProvider } from '@/constants/assistants/integrations';
import { mockSimulationEnabled } from '@/lib/simulation/config';
import { mapStaticProviderToDefinition } from '@/utils/integrations/static-package-adapter';
import type { IntegrationDefinition } from '@/types/integrations';

export const USE_MOCK_PROVIDER_INTEGRATIONS = false;

function canUseRuntimeMockFlag(): boolean {
  if (typeof window === 'undefined') return false;
  // Local stack often runs a production Next build on localhost; still allow the
  // explicit mock flag there so Playwright can drive the gallery without live
  // provider credentials.
  const host = window.location.hostname;
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  return process.env.NODE_ENV !== 'production' || isLocalHost;
}

export function shouldUseMockProviderIntegrations(): boolean {
  if (USE_MOCK_PROVIDER_INTEGRATIONS) return true;
  // Mock simulation has no backend at all, so the gallery has to be mocked
  // too — otherwise connecting a workflow's required app from the Workflows
  // tab opens the real provider drawer against a catalogue that cannot load.
  if (mockSimulationEnabled()) return true;
  if (!canUseRuntimeMockFlag()) return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('mockProviderIntegrations') === '1' ||
    window.localStorage.getItem('console:integrations:mock') === 'true'
  );
}

function providerDefinition(
  overrides: Partial<IntegrationDefinition> &
    Pick<IntegrationDefinition, 'canonicalSlug' | 'displayName' | 'status'>
): IntegrationDefinition {
  const source = overrides.source ?? 'provider_backed';
  const sourceMetadata = overrides.sourceMetadata ?? {
    source,
    label: 'Managed app',
    backendId: 'composio-dev',
    providerAppId: `mock-${overrides.canonicalSlug}`,
    overlayCurated: source === 'overlay_curated',
  };
  return {
    id: overrides.canonicalSlug,
    description: null,
    category: 'Productivity',
    iconUrl: null,
    authModes: ['oauth'],
    source,
    sourceMetadata,
    scopes: [],
    capabilityGroups: [],
    tools: [],
    connections: [],
    ...overrides,
  };
}

const staticEmploymentHero = (() => {
  const provider = getIntegrationProvider('employmenthero');
  return provider ? mapStaticProviderToDefinition(provider, { kind: 'configured' }, []) : null;
})();

const dynamicHubSpot = providerDefinition({
  canonicalSlug: 'hubspot',
  displayName: 'HubSpot',
  description: 'Connect CRM access for contacts, companies, and deals.',
  category: 'CRM',
  status: 'connected',
  source: 'overlay_curated',
  sourceMetadata: {
    source: 'overlay_curated',
    label: 'Managed app',
    backendId: 'composio-dev',
    providerAppId: 'hubspot',
    providerConnectionId: 'mock-hubspot-connection',
    overlayCurated: true,
  },
  scopes: [
    { id: 'crm.objects.contacts.read', label: 'Read contacts', required: true },
    { id: 'crm.objects.deals.read', label: 'Read deals', required: true },
    { id: 'crm.objects.contacts.write', label: 'Update contacts' },
  ],
  capabilityGroups: [
    {
      id: 'hubspot-crm',
      label: 'CRM records',
      description: 'Search, read, and update contact and deal records.',
      toolIds: ['hubspot.search_contacts', 'hubspot.update_contact'],
      policyLabels: ['Confirmation for writes', 'PII access'],
    },
  ],
  tools: [
    {
      id: 'hubspot.search_contacts',
      name: 'search_contacts',
      displayName: 'Search contacts',
      description: 'Find HubSpot contacts by name, email, company, or lifecycle stage.',
      providerToolId: 'HUBSPOT_SEARCH_CONTACTS',
      canonicalName: 'primitives.integrations.hubspot.search_contacts',
      activationState: 'connected_ready',
      actionClass: 'read',
    },
    {
      id: 'hubspot.update_contact',
      name: 'update_contact',
      displayName: 'Update contact',
      description: 'Update selected contact properties after confirmation.',
      providerToolId: 'HUBSPOT_UPDATE_CONTACT',
      canonicalName: 'primitives.integrations.hubspot.update_contact',
      activationState: 'connected_ready',
      actionClass: 'write',
    },
  ],
  connections: [
    {
      id: 'mock-hubspot-work-connection',
      definitionId: 'hubspot',
      canonicalSlug: 'hubspot',
      source: 'overlay_curated',
      status: 'connected',
      ownerScope: 'assistant',
      accountLabel: 'Work HubSpot',
      healthLabel: 'Healthy',
      lastCheckedAt: 'just now',
      grantedScopes: [
        { id: 'crm.objects.contacts.read', label: 'Read contacts' },
        { id: 'crm.objects.deals.read', label: 'Read deals' },
      ],
      sourceMetadata: {
        source: 'overlay_curated',
        label: 'Managed app',
        backendId: 'composio-dev',
        providerAppId: 'hubspot',
        providerConnectionId: 'mock-hubspot-work-connection',
        overlayCurated: true,
      },
    },
    {
      id: 'mock-hubspot-personal-connection',
      definitionId: 'hubspot',
      canonicalSlug: 'hubspot',
      source: 'overlay_curated',
      status: 'connected',
      ownerScope: 'assistant',
      accountLabel: 'Personal HubSpot',
      healthLabel: 'Healthy',
      lastCheckedAt: 'just now',
      grantedScopes: [
        { id: 'crm.objects.contacts.read', label: 'Read contacts' },
        { id: 'crm.objects.deals.read', label: 'Read deals' },
      ],
      sourceMetadata: {
        source: 'overlay_curated',
        label: 'Managed app',
        backendId: 'composio-dev',
        providerAppId: 'hubspot',
        providerConnectionId: 'mock-hubspot-personal-connection',
        overlayCurated: true,
      },
    },
  ],
});

const firstWaveProviderApps = [
  ['one_drive', 'OneDrive', 'Files', 'Search, read, and organize OneDrive files.', 'ONE_DRIVE'],
  [
    'share_point',
    'SharePoint',
    'Files',
    'Search SharePoint sites, files, and pages.',
    'SHARE_POINT',
  ],
  [
    'microsoft_teams',
    'Microsoft Teams',
    'Communication',
    'Read teams and send collaboration updates.',
    'MICROSOFT_TEAMS',
  ],
  [
    'google_drive',
    'Google Drive',
    'Files',
    'Search and read Drive files through Composio.',
    'GOOGLEDRIVE',
  ],
  [
    'google_calendar',
    'Google Calendar',
    'Calendar',
    'Read and create calendar events.',
    'GOOGLECALENDAR',
  ],
  [
    'gmail',
    'Gmail',
    'Email',
    'Search mail and draft responses through a provider-managed connection.',
    'GMAIL',
  ],
  ['google_docs', 'Google Docs', 'Documents', 'Find and read Google Docs content.', 'GOOGLEDOCS'],
  [
    'slack',
    'Slack',
    'Communication',
    'Search conversations and send approved workspace messages.',
    'SLACK',
  ],
  [
    'discord',
    'Discord',
    'Communication',
    'List guilds, channels, and messages from Discord.',
    'DISCORD',
  ],
  [
    'discordbot',
    'Discord Bot',
    'Communication',
    'Use bot-authenticated Discord workspace actions.',
    'DISCORDBOT',
  ],
  ['zoom', 'Zoom', 'Communication', 'List meetings, recordings, and webinar metadata.', 'ZOOM'],
  ['notion', 'Notion', 'Knowledge', 'Search pages, databases, and workspace content.', 'NOTION'],
  ['github', 'GitHub', 'Engineering', 'Search repositories, issues, and pull requests.', 'GITHUB'],
  ['jira', 'Jira', 'Project management', 'Search issues and create follow-up tasks.', 'JIRA'],
  [
    'linear',
    'Linear',
    'Project management',
    'Read issues and link assistant work to engineering tickets.',
    'LINEAR',
  ],
  ['asana', 'Asana', 'Project management', 'List projects, tasks, and assignee work.', 'ASANA'],
  ['trello', 'Trello', 'Project management', 'Read boards, lists, and cards.', 'TRELLO'],
  [
    'salesforce',
    'Salesforce',
    'CRM',
    'Query CRM leads, accounts, and opportunities.',
    'SALESFORCE',
  ],
  ['airtable', 'Airtable', 'Database', 'Read records and discover bases.', 'AIRTABLE'],
  ['dropbox', 'Dropbox', 'Files', 'Search and read Dropbox files.', 'DROPBOX'],
] as const;

const firstWaveDynamicDefinitions = firstWaveProviderApps.map(
  ([canonicalSlug, displayName, category, description, providerAppId], index) =>
    providerDefinition({
      canonicalSlug,
      displayName,
      description,
      category,
      iconUrl: `https://cdn.composio.dev/icons/${providerAppId.toLowerCase()}.svg`,
      status:
        index === 0
          ? 'connected'
          : index === 5
            ? 'error'
            : index === 14
              ? 'expired'
              : 'not_connected',
      scopes: [{ id: `${canonicalSlug}:read`, label: `Read ${displayName}`, required: true }],
      sourceMetadata: {
        source: 'provider_backed',
        label: 'Managed app',
        backendId: 'composio',
        providerAppId,
      },
      tools: [
        {
          id: `composio:${canonicalSlug}:search`,
          name: canonicalSlug.includes('calendar') ? 'list_events' : 'search',
          displayName: canonicalSlug.includes('calendar') ? 'List events' : `Search ${displayName}`,
          description: `Search and use ${displayName} data after this app is connected.`,
          providerToolId: `${providerAppId}_SEARCH`,
          canonicalName: `primitives.integrations.${canonicalSlug}.search`,
          activationState: index === 0 ? 'connected_ready' : 'not_connected',
          actionClass:
            canonicalSlug.includes('gmail') ||
            canonicalSlug.includes('drive') ||
            canonicalSlug.includes('share_point') ||
            canonicalSlug.includes('slack') ||
            canonicalSlug.includes('discord')
              ? 'sensitive_read'
              : 'read',
        },
      ],
      connections:
        index === 0
          ? [
              {
                id: `mock-${canonicalSlug}-connection`,
                definitionId: canonicalSlug,
                canonicalSlug,
                source: 'provider_backed',
                status: 'connected',
                ownerScope: 'assistant',
                accountLabel: `${displayName} workspace`,
                healthLabel: 'Healthy',
                sourceMetadata: {
                  source: 'provider_backed',
                  label: 'Managed app',
                  backendId: 'composio',
                  providerAppId,
                  providerConnectionId: `mock-${canonicalSlug}-connection`,
                },
              },
            ]
          : [],
    })
);

const clayApiKeyDefinition = providerDefinition({
  canonicalSlug: 'clay',
  displayName: 'Clay',
  description: 'Connect Clay with an API key to run enrichment workflows.',
  category: 'Data enrichment',
  status: 'not_connected',
  authModes: ['api_key'],
  scopes: [{ id: 'enrich:write', label: 'Run enrichments', required: true }],
  apiKeySchema: {
    fields: [
      {
        id: 'CLAY_API_KEY',
        label: 'Clay API key',
        required: true,
        sensitive: true,
        maskedValueLabel: '************',
      },
    ],
    submitLabel: 'Add API key',
  },
  tools: [
    {
      id: 'clay.enrich_company',
      name: 'enrich_company',
      displayName: 'Enrich company',
      description: 'Run a company enrichment workflow.',
      providerToolId: 'CLAY_ENRICH_COMPANY',
      canonicalName: 'primitives.integrations.clay.enrich_company',
      activationState: 'not_connected',
      actionClass: 'write',
      requiredScopes: [{ id: 'enrich:write', label: 'Run enrichments', required: true }],
    },
  ],
});

/**
 * The user's own Workspace, which is not a gallery app.
 *
 * It carries no auth modes because the gallery cannot connect it: the
 * workspace manager the profile pane and the onboarding checklist open owns
 * that flow, and this row exists so a requirement naming it resolves to the
 * `workspace` route rather than reading as an unverifiable slug.
 */
const workspaceIntegrationDefinition = providerDefinition({
  canonicalSlug: 'google_workspace',
  displayName: 'Google Workspace',
  description: 'Your own Google account, connected in the workspace manager.',
  category: 'Workspace',
  status: 'not_connected',
  source: 'workspace_integration',
  authModes: [],
  sourceMetadata: {
    source: 'workspace_integration',
    label: 'Your workspace',
    backendId: 'workspace',
    providerAppId: 'google_workspace',
  },
});

export const MOCK_PROVIDER_INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  ...(staticEmploymentHero ? [staticEmploymentHero] : []),
  dynamicHubSpot,
  ...firstWaveDynamicDefinitions,
  clayApiKeyDefinition,
  workspaceIntegrationDefinition,
];
