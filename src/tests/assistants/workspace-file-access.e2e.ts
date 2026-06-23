/**
 * Workspace File Access E2E — exercises the post-OAuth file-access allowlist
 * picker on a connected Google Workspace assistant and verifies the resulting
 * policy is persisted to the `assistant_workspace_file_access` table.
 *
 * The connected account is seeded directly (BYOD email contact + granted
 * Drive scope) so the test goes straight to the file-access step without a
 * real OAuth round-trip. The live Drive tree requires a real provider token,
 * so the test asserts the locally-reachable parts: the picker renders, the
 * "new files default" toggle + Save persist, and the DB reflects the change.
 *
 * Run: npx playwright test src/tests/assistants/workspace-file-access.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  createAssistant,
  createAssistantTest,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openDroidSwitcher,
  ensureProjectSync,
  cleanupUser,
  dbExec,
  dbExecBlock,
} from './helpers';

const user = createTestUser({ name: 'Drive', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'DriveBot',
  surname: 'E2E',
});

// Seed a connected Google Workspace account with Drive granted: a BYOD email
// contact (so `assistant.email` resolves and the connected view renders) plus
// the granted-scopes + access-token secrets the file-access gating reads.
dbExecBlock(`
INSERT INTO assistant_contacts (assistant_id, contact_type, contact_value, provider, provisioned_by, status)
VALUES (${assistant.agentId}, 'email', 'drivebot-${user.id}@example.com', 'google_workspace', 'user', 'active');
INSERT INTO assistant_secrets (user_id, agent_id, secret_name, secret_value)
VALUES
  ('${user.id}', ${assistant.agentId}, 'GOOGLE_GRANTED_SCOPES', 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email'),
  ('${user.id}', ${assistant.agentId}, 'GOOGLE_ACCESS_TOKEN', 'e2e-google-access-token')
ON CONFLICT (agent_id, secret_name) DO UPDATE SET secret_value = EXCLUDED.secret_value;
`);

test.afterAll(() => {
  cleanupUser(user.id);
});

async function openWorkspaceManager(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openDroidSwitcher(page);

  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  const menuBtn = page.getByTestId(`assistant-menu-${assistant.agentId}`);
  await listItem.hover();
  await expect(menuBtn).toBeVisible({ timeout: 5_000 });
  await menuBtn.click();
  await page.waitForTimeout(500);

  const workspaceItem = page.getByTestId('menu-update-workspace');
  await expect(workspaceItem).toBeVisible({ timeout: 5_000 });
  await workspaceItem.click();

  await expect(page.getByRole('dialog').getByText('Workspace', { exact: true })).toBeVisible({
    timeout: 5_000,
  });
}

test('the file-access picker renders for a Drive-connected assistant', async ({
  authedPage: page,
}) => {
  await openWorkspaceManager(page);

  // The connected view exposes the file-access step with its controls.
  await expect(page.getByTestId('workspace-file-tree')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('workspace-file-select-all')).toBeVisible();
  await expect(page.getByTestId('workspace-file-deselect-all')).toBeVisible();
  await expect(page.getByTestId('workspace-file-default-toggle')).toBeVisible();
});

test('toggling the new-files default and saving persists the policy', async ({
  authedPage: page,
}) => {
  await openWorkspaceManager(page);

  await expect(page.getByTestId('workspace-file-tree')).toBeVisible({ timeout: 15_000 });

  // Flip "new files accessible by default" on.
  await page.getByTestId('workspace-file-default-toggle').click();

  const save = page.getByTestId('workspace-file-save');
  await expect(save).toBeEnabled({ timeout: 5_000 });

  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes('/workspace-files/policy') &&
        resp.request().method() === 'PATCH' &&
        resp.status() === 200,
      { timeout: 30_000 }
    ),
    save.click(),
  ]);

  // The allowlist row must now exist with default_allow = true.
  const defaultAllow = dbExec(
    `SELECT default_allow FROM assistant_workspace_file_access WHERE agent_id = ${assistant.agentId} AND provider = 'google'`
  ).trim();
  expect(defaultAllow).toBe('t');
});

test('deselect all stores a deny-by-default policy', async ({ authedPage: page }) => {
  await openWorkspaceManager(page);

  await expect(page.getByTestId('workspace-file-tree')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('workspace-file-deselect-all').click();

  const save = page.getByTestId('workspace-file-save');
  await expect(save).toBeEnabled({ timeout: 5_000 });

  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes('/workspace-files/policy') &&
        resp.request().method() === 'PATCH' &&
        resp.status() === 200,
      { timeout: 30_000 }
    ),
    save.click(),
  ]);

  const defaultAllow = dbExec(
    `SELECT default_allow FROM assistant_workspace_file_access WHERE agent_id = ${assistant.agentId} AND provider = 'google'`
  ).trim();
  expect(defaultAllow).toBe('f');
});
