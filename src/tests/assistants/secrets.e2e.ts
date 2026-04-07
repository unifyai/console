/**
 * Secrets Management E2E — create, edit, and delete secrets via
 * the Secrets Manager dialog. Verifies UI behaviour and that secrets
 * are persisted / removed in the Orchestra log_event table.
 *
 * Run: npx playwright test src/tests/assistants/secrets.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
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

/**
 * Queries from the per-assistant Secrets context.
 */
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

/**
 * Open the secrets manager via the list item dropdown menu.
 */
async function openSecretsManager(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  // Open the dropdown menu on the list item
  const menuBtn = page.getByTestId(`assistant-menu-${assistant.agentId}`);
  await listItem.hover();
  await expect(menuBtn).toBeVisible({ timeout: 5_000 });
  await menuBtn.click();
  await page.waitForTimeout(500);

  // Click "Manage secrets" in the dropdown
  const secretsItem = page.getByTestId('menu-manage-secrets');
  await expect(secretsItem).toBeVisible({ timeout: 5_000 });
  await secretsItem.click();
  await page.waitForTimeout(1_000);

  // Verify the dialog opened
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await expect(dialog.locator('text=Manage secrets')).toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('creating a secret persists it to the database', async ({ authedPage: page }) => {
  const secretName = `TEST_KEY_${Date.now()}`;
  const secretValue = 'sk-test-secret-value-1234';
  const secretDesc = 'E2E test secret description';

  await openSecretsManager(page);

  // Click "New" or "Add a secret" (depending on whether secrets already exist)
  const newBtn = page.getByRole('button', { name: 'New' });
  const addBtn = page.getByRole('button', { name: 'Add a secret' });
  if (await newBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await newBtn.click();
  } else {
    await addBtn.click();
  }
  await page.waitForTimeout(500);

  // Fill the secret form
  const nameInput = page.locator('#name');
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  await nameInput.fill(secretName);

  const valueInput = page.locator('#value');
  await valueInput.fill(secretValue);

  const descInput = page.locator('#description');
  await descInput.fill(secretDesc);

  // Submit
  const saveBtn = page.getByRole('button', { name: 'Save' });
  await saveBtn.click();

  // Wait for submission to complete (the "New" button re-enables)
  await expect(newBtn).toBeEnabled({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  // Verify the secret appears in the left pane tree
  await expect(page.locator(`text=${secretName}`).first()).toBeVisible({ timeout: 5_000 });

  // Verify in DB
  const dbSecret = getSecretFromDb(user.id, assistant.agentId, secretName);
  expect(dbSecret).toBe(secretName);

  // Verify private fields were injected
  const fields = getSecretPrivateFields(user.id, assistant.agentId, secretName);
  expect(fields).not.toBeNull();
  expect(fields!._user).toBe(user.id);
  expect(fields!._user_id).toBe(user.id);
  expect(fields!._assistant).toBe(String(assistant.agentId));
  expect(fields!._assistant_id).toBe(String(assistant.agentId));
});

test('creating a secret with a hierarchical name shows folder structure', async ({
  authedPage: page,
}) => {
  const folderName = `e2e/${Date.now()}`;
  const secretName = `${folderName}/API_KEY`;
  const secretValue = 'hierarchical-value';

  await openSecretsManager(page);

  const newBtn = page.getByRole('button', { name: 'New' });
  await newBtn.click();
  await page.waitForTimeout(500);

  await page.locator('#name').fill(secretName);
  await page.locator('#value').fill(secretValue);

  const saveBtn = page.getByRole('button', { name: 'Save' });
  await saveBtn.click();

  await expect(newBtn).toBeEnabled({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  // The tree should show the folder "e2e" — click it to expand
  const folderLabel = folderName.split('/')[0];
  await expect(page.locator(`text=${folderLabel}`).first()).toBeVisible({ timeout: 5_000 });

  // Verify in DB
  const dbSecret = getSecretFromDb(user.id, assistant.agentId, secretName);
  expect(dbSecret).toBe(secretName);
});

test('editing a secret name persists the change to the database', async ({ authedPage: page }) => {
  const originalName = `EDIT_ME_${Date.now()}`;
  const updatedName = `EDITED_${Date.now()}`;

  // Seed a secret first
  await openSecretsManager(page);

  const newBtn = page.getByRole('button', { name: 'New' });
  await newBtn.click();
  await page.waitForTimeout(500);

  await page.locator('#name').fill(originalName);
  await page.locator('#value').fill('original-value');

  let saveBtn = page.getByRole('button', { name: 'Save' });
  await saveBtn.click();
  await expect(newBtn).toBeEnabled({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  // Click the secret in the tree to select it for editing
  await page.locator(`text=${originalName}`).first().click();
  await page.waitForTimeout(500);

  // The name input should be populated with the original name
  const nameInput = page.locator('#name');
  await expect(nameInput).toHaveValue(originalName, { timeout: 5_000 });

  // Change the name
  await nameInput.fill(updatedName);

  // The button should now say "Save Changes" (editing mode)
  saveBtn = page.getByRole('button', { name: 'Save Changes' });
  await saveBtn.click();
  await expect(newBtn).toBeEnabled({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  // Verify updated name appears in tree
  await expect(page.locator(`text=${updatedName}`).first()).toBeVisible({ timeout: 5_000 });

  // Verify in DB: old name gone, new name exists
  const dbOld = getSecretFromDb(user.id, assistant.agentId, originalName);
  expect(dbOld).toBeFalsy();

  const dbNew = getSecretFromDb(user.id, assistant.agentId, updatedName);
  expect(dbNew).toBe(updatedName);
});

test('deleting a secret removes it from the database', async ({ authedPage: page }) => {
  const secretName = `DELETE_ME_${Date.now()}`;

  // Create a secret to delete
  await openSecretsManager(page);

  const newBtn = page.getByRole('button', { name: 'New' });
  await newBtn.click();
  await page.waitForTimeout(500);

  await page.locator('#name').fill(secretName);
  await page.locator('#value').fill('to-be-deleted');

  const saveBtn = page.getByRole('button', { name: 'Save' });
  await saveBtn.click();
  await expect(newBtn).toBeEnabled({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  // Verify it exists
  expect(getSecretFromDb(user.id, assistant.agentId, secretName)).toBe(secretName);

  // Click the secret row to select it, then find the trash button
  const secretSpan = page.locator(`span:text-is("${secretName}")`);
  await expect(secretSpan).toBeVisible({ timeout: 5_000 });

  // The trash button is in the same parent div as the span
  const rowDiv = secretSpan.locator('..');
  const trashBtn = rowDiv.locator('button');
  await trashBtn.click();
  await page.waitForTimeout(500);

  // Confirm deletion in the alert dialog
  await expect(page.locator('text=This action cannot be undone.')).toBeVisible({ timeout: 5_000 });
  const deleteConfirmBtn = page.getByRole('button', { name: 'Delete' });
  await deleteConfirmBtn.click();

  // Wait for deletion to complete — the secret should disappear from the tree
  await expect(secretSpan).not.toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  // Verify removed from DB
  const dbAfter = getSecretFromDb(user.id, assistant.agentId, secretName);
  expect(dbAfter).toBeFalsy();
});

test('secret value field is masked and full lifecycle works end-to-end', async ({
  authedPage: page,
}) => {
  const secretName = `LIFECYCLE_${Date.now()}`;

  await openSecretsManager(page);

  const countBefore = getSecretCountForAssistant(user.id, assistant.agentId);

  // Create
  const newBtn = page.getByRole('button', { name: 'New' });
  await newBtn.click();
  await page.waitForTimeout(500);

  // Verify the value input is masked (type="password")
  const valueInput = page.locator('#value');
  await expect(valueInput).toBeVisible({ timeout: 5_000 });
  await expect(valueInput).toHaveAttribute('type', 'password');

  await page.locator('#name').fill(secretName);
  await valueInput.fill('lifecycle-value');
  await page.locator('#description').fill('Lifecycle test');

  const saveBtn = page.getByRole('button', { name: 'Save' });
  await saveBtn.click();
  await expect(newBtn).toBeEnabled({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  // Verify created in DB
  expect(getSecretFromDb(user.id, assistant.agentId, secretName)).toBe(secretName);
  expect(getSecretCountForAssistant(user.id, assistant.agentId)).toBe(countBefore + 1);

  // Delete
  const secretSpan = page.locator(`span:text-is("${secretName}")`);
  await expect(secretSpan).toBeVisible({ timeout: 5_000 });
  const rowDiv = secretSpan.locator('..');
  const trashBtn = rowDiv.locator('button');
  await trashBtn.click();
  await page.waitForTimeout(500);

  await expect(page.locator('text=This action cannot be undone.')).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Delete' }).click();

  // Wait for deletion to complete
  await expect(secretSpan).not.toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  // Verify removed from DB
  expect(getSecretFromDb(user.id, assistant.agentId, secretName)).toBeFalsy();
  expect(getSecretCountForAssistant(user.id, assistant.agentId)).toBe(countBefore);
});
