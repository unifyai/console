/**
 * Data browser ownership scope — Personal vs team roots are selected via a
 * branded dropdown; All uses section headers (not filesystem folders).
 *
 * Run: npx playwright test src/tests/assistants/data-browser-scope.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  createOrg,
  deleteOrg,
  createTeamForAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  selectAssistantInList,
  ensureProjectSync,
  orchestraFetch,
  openRailSection,
  seedChatInfrastructure,
  switchWorkspace,
} from './helpers';

function uniqueEmail(): string {
  return `data-scope-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueEmail(),
  name: 'DataScopeE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(180_000);

const org = createOrg({ name: `DataScopeOrg_${Date.now()}`, ownerId: user.id });
ensureProjectSync(org.ownerOrgApiKey);

const assistant = createAssistant({
  userId: user.id,
  orgId: org.id,
  firstName: 'Scope',
  surname: 'Bot',
});

const team = createTeamForAssistant(assistant, {
  name: `Data Scope Team ${Date.now()}`,
});

const personalTranscripts = `${user.id}/${assistant.agentId}/Transcripts`;
const teamTranscripts = `Teams/${team.teamId}/Transcripts`;

test.beforeAll(async () => {
  await seedChatInfrastructure({
    apiKey: org.ownerOrgApiKey,
    userId: user.id,
    assistantId: assistant.agentId,
    email: user.email,
  });

  for (const [context, content] of [
    [personalTranscripts, 'Personal transcript row'],
    [teamTranscripts, 'Team transcript row'],
  ] as const) {
    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context,
          entries: [{ content }],
        }),
      },
      org.ownerOrgApiKey
    );
    if (!res.ok) {
      throw new Error(`Failed to seed ${context}: ${res.status} ${await res.text()}`);
    }
  }
});

test.afterAll(async () => {
  deleteOrg(org.id);
  await cleanupUser(user.id);
});

async function openDataTranscripts(page: import('@playwright/test').Page) {
  await switchWorkspace(page, org.id);
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await openRailSection(page, 'data');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('data-mode-Transcripts').click();
  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-mode', 'Transcripts');
}

test('All shows branded sections; Personal and Team scopes flatten the tree', async ({
  authedPage: page,
}) => {
  await openDataTranscripts(page);

  await expect(page.getByTestId('data-scope-dropdown')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-scope', 'all');

  await expect(page.getByTestId('data-scope-section-personal')).toBeVisible();
  await expect(page.getByTestId(`data-scope-section-team-${team.teamId}`)).toBeVisible();
  await expect(page.getByTestId(`data-scope-section-team-${team.teamId}`)).toContainText('Team');

  // Ownership is a section header — not a filesystem folder named after the team.
  await expect(page.getByTestId('data-folder-node').filter({ hasText: team.name })).toHaveCount(0);

  const transcriptsNodes = page.getByTestId('data-table-node').filter({ hasText: /^Transcripts$/ });
  await expect(transcriptsNodes).toHaveCount(2);

  await page.getByTestId('data-scope-dropdown').click();
  await page.getByTestId('data-scope-personal').click();
  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-scope', 'personal');
  await expect(page.getByTestId('data-scope-section-personal')).toHaveCount(0);
  await expect(page.getByTestId(`data-scope-section-team-${team.teamId}`)).toHaveCount(0);
  await expect(
    page.getByTestId('data-table-node').filter({ hasText: /^Transcripts$/ })
  ).toHaveCount(0);
  // Single-table personal Transcripts opens directly (no directory chrome).
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Transcripts' })).toBeVisible();

  await page.getByTestId('data-scope-dropdown').click();
  await page.getByTestId(`data-scope-team-${team.teamId}`).click();
  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-scope', `team-${team.teamId}`);
  await expect(page.getByTestId('data-scope-section-personal')).toHaveCount(0);
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Transcripts' })).toBeVisible();

  const listRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${encodeURIComponent(teamTranscripts)}&limit=5`,
    { method: 'GET' },
    org.ownerOrgApiKey
  );
  expect(listRes.ok).toBe(true);
  const body = (await listRes.json()) as { count?: number; logs?: unknown[] };
  expect((body.count ?? body.logs?.length ?? 0) > 0).toBe(true);
});
