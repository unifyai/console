#!/usr/bin/env npx tsx
/**
 * Local-only integration FunctionManager shortcut.
 *
 * This is deliberately for local experimentation and E2E testing. It only
 * materializes tools for currently connected apps; inactive apps should stay
 * undiscoverable through FunctionManager until the user connects them.
 * Production provider-backed materialization is owned by Unity; this script
 * mirrors the row shape only so local Console scenarios can seed data directly.
 */

import { createHash } from 'crypto';
import { dbExec, ensureProject, orchestraFetch } from './client';

const DEFAULT_LOCAL_APPS = [
  'discord',
  'slack',
  'gmail',
  'google_drive',
  'google_calendar',
  'github',
  'linear',
  'salesforce',
];

interface AssistantRow {
  agentId: number;
  userId: string;
}

interface ProviderTool {
  tool_id?: string;
  backend_id?: string;
  provider_app_id?: string;
  provider_tool_id?: string;
  canonical_name?: string;
  function_manager_name?: string;
  app_slug?: string;
  app_display_name?: string;
  app_icon_url?: string | null;
  tool_display_name?: string;
  description?: string | null;
  activation_state?: string;
  connection_id?: string | null;
  required_scopes?: string[];
  action_class?: string;
  confirmation_required?: boolean;
  approval_level?: string;
  score?: number;
}

function localApps(): Set<string> {
  const raw = process.env.LOCAL_INTEGRATION_FUNCTION_SYNC_APPS;
  const values = raw ? raw.split(',') : DEFAULT_LOCAL_APPS;
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

function providerIntegrationFunctionId(toolId: string): number {
  // Local E2E seeding mirrors Unity's materialized provider-row ID shape.
  // Unity remains the production source of truth; integration_tool_id is the
  // canonical execution identifier, while function_id is only the integer
  // FunctionManager storage/search key required by Functions/Primitives.
  const digest = createHash('sha256')
    .update(`IntegrationPrimitives.provider_backed:${toolId}`)
    .digest();
  return digest.readUInt32BE(0) & 0x7fffffff;
}

function parseAssistants(): AssistantRow[] {
  const output = dbExec('SELECT agent_id, user_id FROM assistants ORDER BY agent_id;');
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [agentId, userId] = line.split('|');
      return { agentId: Number(agentId), userId };
    })
    .filter((row) => Number.isFinite(row.agentId) && Boolean(row.userId));
}

function localApiKey(): string {
  return dbExec('SELECT key FROM api_key ORDER BY id LIMIT 1;').trim();
}

async function searchTools(
  apiKey: string,
  assistantId: number,
  offset: number
): Promise<ProviderTool[]> {
  const params = new URLSearchParams({
    owner_scope: 'assistant',
    assistant_id: String(assistantId),
    include_unconnected: 'false',
    limit: '500',
    offset: String(offset),
  });
  const response = await orchestraFetch(
    `/v0/integrations/tools/search?${params.toString()}`,
    {
      method: 'GET',
    },
    apiKey
  );

  if (!response.ok) {
    throw new Error(`Provider tool search failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as ProviderTool[];
}

function toPrimitiveRow(tool: ProviderTool): Record<string, unknown> | null {
  const toolId = tool.tool_id;
  const name = tool.canonical_name;
  if (!toolId || !name) return null;

  const app = tool.app_display_name || tool.app_slug || 'Integration';
  const title = tool.tool_display_name || tool.provider_tool_id || name;
  const requiredScopes = tool.required_scopes ?? [];
  const actionClass = tool.action_class || 'read';
  const confirmationRequired = Boolean(tool.confirmation_required);
  const approvalLevel =
    tool.approval_level || (confirmationRequired ? 'specific_approval' : 'auto');
  const activation = tool.activation_state || 'not_connected';
  const docstring = [
    `${title} for ${app}.`,
    tool.description || '',
    `Activation state: ${activation}.`,
    `Action class: ${actionClass}.`,
    requiredScopes.length ? `Required scopes: ${requiredScopes.join(', ')}.` : '',
    `Tool approval level: ${approvalLevel}.`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    name,
    function_id: providerIntegrationFunctionId(toolId),
    language: 'python',
    argspec: '(**kwargs) -> dict',
    docstring,
    embedding_text: [name, app, title, tool.description, activation, actionClass, ...requiredScopes]
      .filter(Boolean)
      .join(' '),
    implementation: null,
    depends_on: [],
    precondition: null,
    verify: confirmationRequired || ['write', 'destructive', 'bulk_export'].includes(actionClass),
    is_primitive: true,
    guidance_ids: [],
    primitive_class: 'unity.integrations.primitives.IntegrationPrimitives',
    primitive_method: tool.function_manager_name || name.replace(/\./g, '__'),
    integration_source: 'provider_backed',
    integration_tool_id: toolId,
    backend_id: tool.backend_id,
    provider_app_id: tool.provider_app_id,
    provider_tool_id: tool.provider_tool_id,
    namespace: 'primitives.integrations',
    app_slug: tool.app_slug,
    app_display_name: app,
    app_icon_url: tool.app_icon_url,
    activation_state: activation,
    connection_id: tool.connection_id ?? null,
    required_scopes: requiredScopes,
    action_class: actionClass,
    approval_level: approvalLevel,
    confirmation_required: confirmationRequired,
    schema_available: true,
  };
}

async function seedAssistant(
  apiKey: string,
  assistant: AssistantRow,
  apps: Set<string>
): Promise<number> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await searchTools(apiKey, assistant.agentId, offset);
    rows.push(
      ...page
        .filter((tool) => tool.app_slug && apps.has(tool.app_slug))
        .map(toPrimitiveRow)
        .filter((row): row is Record<string, unknown> => Boolean(row))
    );
    if (page.length < 500) break;
  }

  if (rows.length === 0) return 0;

  const response = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${assistant.userId}/${assistant.agentId}/Functions/Primitives`,
        entries: rows,
      }),
    },
    apiKey
  );

  if (!response.ok) {
    throw new Error(
      `Failed to seed Functions/Primitives for assistant ${assistant.agentId}: ${response.status} ${await response.text()}`
    );
  }

  return rows.length;
}

async function main(): Promise<void> {
  const apiKey = localApiKey();
  if (!apiKey) throw new Error('No local API key found. Run a seed scenario first.');

  await ensureProject(apiKey, 'Assistants');

  const apps = localApps();
  const assistants = parseAssistants();
  if (assistants.length === 0) throw new Error('No seeded assistants found.');

  let total = 0;
  for (const assistant of assistants) {
    const count = await seedAssistant(apiKey, assistant, apps);
    total += count;
    console.log(`Seeded ${count} local integration primitives for assistant ${assistant.agentId}`);
  }
  console.log(
    `Seeded ${total} local integration primitive rows for apps: ${Array.from(apps).join(', ')}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
