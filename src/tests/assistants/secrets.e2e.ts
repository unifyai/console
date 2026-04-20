/**
 * Secrets Tab E2E — create, edit, and delete secrets via the dedicated
 * Secrets tab on the assistant right pane. Verifies UI behaviour and that
 * secrets are persisted / removed in the Orchestra log_event table.
 *
 * Run: npx playwright test src/tests/assistants/secrets.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  closeHireDialogIfOpen,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  dbExec,
} from './helpers';

const user = createTestUser({ name: 'SecretE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'SecretBot',
  surname: 'E2E',
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

// ---------------------------------------------------------------------------
// DB helpers for secrets (stored in log_event via context system)
// ---------------------------------------------------------------------------

function getSecretFromDb(userId: string, assistantId: number, secretName: string): string | null {
  try {
    const result = dbExec(
      `SELECT le.data->>'name' FROM log_event le ` +
        `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
        `JOIN context c ON lec.context_id = c.id ` +
        `WHERE c.name = '${userId}/${assistantId}/Secrets' ` +
        `AND le.data->>'name' = '${secretName}' LIMIT 1`
    );
    return result || null;
  } catch {
    return null;
  }
}

function getSecretPrivateFields(
  userId: string,
  assistantId: number,
  secretName: string
): Record<string, string | null> | null {
  try {
    const result = dbExec(
      `SELECT le.data->>'_user' AS u, le.data->>'_user_id' AS uid, ` +
        `le.data->>'_assistant' AS a, le.data->>'_assistant_id' AS aid, ` +
        `le.data->>'_org_id' AS oid, le.data->>'_org' AS o ` +
        `FROM log_event le ` +
        `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
        `JOIN context c ON lec.context_id = c.id ` +
        `WHERE c.name = '${userId}/${assistantId}/Secrets' ` +
        `AND le.data->>'name' = '${secretName}' LIMIT 1`
    );
    if (!result) return null;
    const parts = result.split('|').map((s: string) => s.trim() || null);
    return {
      _user: parts[0],
      _user_id: parts[1],
      _assistant: parts[2],
      _assistant_id: parts[3],
      _org_id: parts[4],
      _org: parts[5],
    };
  } catch {
    return null;
  }
}

function getSecretCountForAssistant(userId: string, assistantId: number): number {
  try {
    const result = dbExec(
      `SELECT count(*) FROM log_event le ` +
        `JOIN log_event_context lec ON le.id = lec.log_event_id ` +
        `JOIN context c ON lec.context_id = c.id ` +
        `WHERE c.name = '${userId}/${assistantId}/Secrets'`
    );
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function openSecretsTab(page: Page) {
  await page.goto(`/assistants?profile=${assistant.agentId}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await closeHireDialogIfOpen(page);
  await page.waitForTimeout(1_500);

  const tab = page.getByTestId('right-pane-tab-secrets');
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();

  const pane = page.getByTestId('secrets-pane');
  await expect(pane).toBeVisible({ timeout: 5_000 });

  // Wait for the initial fetch to complete (skeleton rows go away).
  await page.waitForTimeout(1_500);
}

async function openCreateDialog(page: Page) {
  await page.getByTestId('secrets-new-button').click();
  const dialog = page.getByTestId('secret-form-dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  return dialog;
}

async function fillAndSaveNewSecret(
  page: Page,
  { name, value, description }: { name: string; value: string; description?: string }
) {
  await openCreateDialog(page);

  await page.locator('#name').fill(name);
  await page.locator('#value').fill(value);
  if (description !== undefined) await page.locator('#description').fill(description);

  await page.getByRole('button', { name: 'Save' }).click();

  // Dialog auto-closes after the hook finishes submitting.
  await expect(page.getByTestId('secret-form-dialog')).toBeHidden({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Secrets tab is available on the right pane', async ({ authedPage: page }) => {
  await openSecretsTab(page);

  await expect(page.getByTestId('right-pane-tab-secrets')).toHaveAttribute('data-state', 'active');
  await expect(page.getByTestId('secrets-search')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('secrets-new-button')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('secrets-upload-button')).toBeVisible({ timeout: 5_000 });
});

test('creating a secret persists it to the database and renders a row', async ({
  authedPage: page,
}) => {
  const secretName = `TEST_KEY_${Date.now()}`;
  const secretValue = 'sk-test-secret-value-1234';
  const secretDesc = 'E2E test secret description';

  await openSecretsTab(page);

  await fillAndSaveNewSecret(page, {
    name: secretName,
    value: secretValue,
    description: secretDesc,
  });

  // Row should appear in the table with the description visible.
  const row = page.getByTestId(`secrets-row-${secretName}`);
  await expect(row).toBeVisible({ timeout: 5_000 });
  await expect(row).toContainText(secretDesc);

  // DB round-trip.
  expect(getSecretFromDb(user.id, assistant.agentId, secretName)).toBe(secretName);

  // Context-injected private fields.
  const fields = getSecretPrivateFields(user.id, assistant.agentId, secretName);
  expect(fields).not.toBeNull();
  expect(fields!._user).toBe(user.id);
  expect(fields!._user_id).toBe(user.id);
  expect(fields!._assistant).toBe(String(assistant.agentId));
  expect(fields!._assistant_id).toBe(String(assistant.agentId));
});

test('hierarchical secret names render as expandable folder rows', async ({ authedPage: page }) => {
  const folderName = `e2e_${Date.now()}`;
  const leafName = 'API_KEY';
  const secretName = `${folderName}/${leafName}`;

  await openSecretsTab(page);
  await fillAndSaveNewSecret(page, { name: secretName, value: 'hierarchical-value' });

  // The folder row should be visible, collapsed by default.
  const folderRow = page.getByTestId(`secrets-folder-${folderName}`);
  await expect(folderRow).toBeVisible({ timeout: 5_000 });
  await expect(folderRow).toHaveAttribute('data-expanded', 'false');

  // The leaf row should NOT yet be visible (collapsed).
  await expect(page.getByTestId(`secrets-row-${secretName}`)).toHaveCount(0);

  // Click to expand — then the leaf row should appear.
  await folderRow.locator('td').first().click();
  await expect(folderRow).toHaveAttribute('data-expanded', 'true');
  await expect(page.getByTestId(`secrets-row-${secretName}`)).toBeVisible({ timeout: 3_000 });

  // DB has the full path.
  expect(getSecretFromDb(user.id, assistant.agentId, secretName)).toBe(secretName);
});

test('searching filters secrets and auto-expands matching folders', async ({
  authedPage: page,
}) => {
  const ts = Date.now();
  const inFolder = `search_${ts}/nested/HIT_KEY`;
  const orphan = `ORPHAN_${ts}`;

  await openSecretsTab(page);
  await fillAndSaveNewSecret(page, { name: inFolder, value: 'v1' });
  await fillAndSaveNewSecret(page, { name: orphan, value: 'v2' });

  // Sanity: folder row is collapsed by default.
  const folderTop = page.getByTestId(`secrets-folder-search_${ts}`);
  await expect(folderTop).toBeVisible({ timeout: 5_000 });
  await expect(folderTop).toHaveAttribute('data-expanded', 'false');

  // Search for "HIT_KEY" — the folder chain should auto-expand and the leaf
  // row should become visible, while the unrelated orphan should disappear.
  // Search is server-driven and triggered on Enter (mirrors Memory/Tasks).
  const search = page.getByTestId('secrets-search');
  await search.fill('HIT_KEY');
  await search.press('Enter');
  await page.waitForTimeout(500);

  await expect(folderTop).toHaveAttribute('data-expanded', 'true');
  await expect(page.getByTestId(`secrets-folder-search_${ts}/nested`)).toHaveAttribute(
    'data-expanded',
    'true'
  );
  await expect(page.getByTestId(`secrets-row-${inFolder}`)).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId(`secrets-row-${orphan}`)).toHaveCount(0);

  // Clearing the search brings everything back and restores collapse state.
  await page.getByTestId('secrets-search-clear').click();
  await page.waitForTimeout(300);
  await expect(folderTop).toHaveAttribute('data-expanded', 'false');
  await expect(page.getByTestId(`secrets-row-${orphan}`)).toBeVisible({ timeout: 3_000 });
});

test('editing a secret name persists the change to the database', async ({ authedPage: page }) => {
  const originalName = `EDIT_ME_${Date.now()}`;
  const updatedName = `EDITED_${Date.now()}`;

  await openSecretsTab(page);
  await fillAndSaveNewSecret(page, { name: originalName, value: 'original-value' });

  // Open the row menu and click Update.
  await page.getByTestId(`secrets-row-menu-${originalName}`).click();
  await page.getByTestId('secrets-row-update').click();

  const dialog = page.getByTestId('secret-form-dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // The form should be prefilled with the current name.
  const nameInput = page.locator('#name');
  await expect(nameInput).toHaveValue(originalName);

  await nameInput.fill(updatedName);
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  // Row should reflect the new name, old row should be gone.
  await expect(page.getByTestId(`secrets-row-${updatedName}`)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId(`secrets-row-${originalName}`)).toHaveCount(0);

  // DB: old name deleted, new name present.
  expect(getSecretFromDb(user.id, assistant.agentId, originalName)).toBeFalsy();
  expect(getSecretFromDb(user.id, assistant.agentId, updatedName)).toBe(updatedName);
});

test('deleting a secret removes it from the UI and the database', async ({ authedPage: page }) => {
  const secretName = `DELETE_ME_${Date.now()}`;

  await openSecretsTab(page);
  await fillAndSaveNewSecret(page, { name: secretName, value: 'to-be-deleted' });
  expect(getSecretFromDb(user.id, assistant.agentId, secretName)).toBe(secretName);

  // Open the row menu → Delete → confirm.
  await page.getByTestId(`secrets-row-menu-${secretName}`).click();
  await page.getByTestId('secrets-row-delete').click();

  const confirm = page.getByTestId('secrets-delete-confirm');
  await expect(confirm).toBeVisible({ timeout: 5_000 });
  await expect(confirm).toContainText('This action cannot be undone.');
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByTestId(`secrets-row-${secretName}`)).toHaveCount(0, { timeout: 15_000 });
  expect(getSecretFromDb(user.id, assistant.agentId, secretName)).toBeFalsy();
});

test('deleting a folder removes every secret underneath it', async ({ authedPage: page }) => {
  const folder = `doomed_${Date.now()}`;
  const s1 = `${folder}/A`;
  const s2 = `${folder}/deeper/B`;

  await openSecretsTab(page);
  await fillAndSaveNewSecret(page, { name: s1, value: 'v' });
  await fillAndSaveNewSecret(page, { name: s2, value: 'v' });

  const countBefore = getSecretCountForAssistant(user.id, assistant.agentId);
  expect(countBefore).toBeGreaterThanOrEqual(2);

  // Open the folder's 3-dots and click "Delete folder".
  await page.getByTestId(`secrets-folder-menu-${folder}`).click();
  await page.getByTestId('secrets-folder-delete').click();

  const confirm = page.getByTestId('secrets-delete-confirm');
  await expect(confirm).toBeVisible({ timeout: 5_000 });
  await expect(confirm).toContainText(`Delete 2 secrets under "${folder}/"`);
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByTestId(`secrets-folder-${folder}`)).toHaveCount(0, { timeout: 15_000 });
  expect(getSecretFromDb(user.id, assistant.agentId, s1)).toBeFalsy();
  expect(getSecretFromDb(user.id, assistant.agentId, s2)).toBeFalsy();
  expect(getSecretCountForAssistant(user.id, assistant.agentId)).toBe(countBefore - 2);
});

test('secret value field is masked and full lifecycle works end-to-end', async ({
  authedPage: page,
}) => {
  const secretName = `LIFECYCLE_${Date.now()}`;

  await openSecretsTab(page);
  const countBefore = getSecretCountForAssistant(user.id, assistant.agentId);

  await openCreateDialog(page);

  // The value input is masked (type="password").
  const valueInput = page.locator('#value');
  await expect(valueInput).toBeVisible({ timeout: 5_000 });
  await expect(valueInput).toHaveAttribute('type', 'password');

  await page.locator('#name').fill(secretName);
  await valueInput.fill('lifecycle-value');
  await page.locator('#description').fill('Lifecycle test');

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('secret-form-dialog')).toBeHidden({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  expect(getSecretFromDb(user.id, assistant.agentId, secretName)).toBe(secretName);
  expect(getSecretCountForAssistant(user.id, assistant.agentId)).toBe(countBefore + 1);

  // Delete via row menu.
  await page.getByTestId(`secrets-row-menu-${secretName}`).click();
  await page.getByTestId('secrets-row-delete').click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByTestId(`secrets-row-${secretName}`)).toHaveCount(0, { timeout: 15_000 });
  expect(getSecretFromDb(user.id, assistant.agentId, secretName)).toBeFalsy();
  expect(getSecretCountForAssistant(user.id, assistant.agentId)).toBe(countBefore);
});
