/**
 * Data pane ui_editable gating — SM modes opt-in edit fields and block deletes.
 *
 * Run: npx playwright test src/tests/assistants/data-ui-editable.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  selectAssistantInList,
  ensureProjectSync,
  orchestraFetch,
  openRailSection,
  seedChatInfrastructure,
} from './helpers';

function uniqueEmail(): string {
  return `data-ui-editable-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueEmail(),
  name: 'DataUiEditableE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(180_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'UiEdit',
  surname: 'Bot',
});

const contactsContext = `${user.id}/${assistant.agentId}/Contacts`;
const transcriptsContext = `${user.id}/${assistant.agentId}/Transcripts`;

test.beforeAll(async () => {
  await seedChatInfrastructure({
    apiKey: user.apiKey,
    userId: user.id,
    assistantId: assistant.agentId,
    email: user.email,
  });

  const fieldsRes = await orchestraFetch(
    '/v0/logs/fields',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: contactsContext,
        fields: {
          contact_id: { type: 'int', mutable: true, ui_editable: false },
          first_name: { type: 'str', mutable: true, ui_editable: true },
          surname: { type: 'str', mutable: true, ui_editable: true },
          email_address: { type: 'str', mutable: true, ui_editable: true },
        },
      }),
    },
    user.apiKey
  );
  if (!fieldsRes.ok) {
    throw new Error(
      `Failed to set Contacts ui_editable fields: ${fieldsRes.status} ${await fieldsRes.text()}`
    );
  }

  const contactRes = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: contactsContext,
        entries: [
          {
            contact_id: 42,
            first_name: 'Editable',
            surname: 'Contact',
            email_address: 'editable-contact@unify.ai',
          },
        ],
      }),
    },
    user.apiKey
  );
  if (!contactRes.ok) {
    throw new Error(`Failed to seed Contacts row: ${contactRes.status} ${await contactRes.text()}`);
  }

  const transcriptFields = await orchestraFetch(
    '/v0/logs/fields',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: transcriptsContext,
        fields: {
          message_id: { type: 'int', mutable: true, ui_editable: false },
          content: { type: 'str', mutable: true, ui_editable: false },
        },
      }),
    },
    user.apiKey
  );
  if (!transcriptFields.ok) {
    throw new Error(
      `Failed to set Transcripts ui_editable fields: ${transcriptFields.status} ${await transcriptFields.text()}`
    );
  }

  const transcriptRes = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: transcriptsContext,
        entries: [{ message_id: 1, content: 'locked transcript line' }],
      }),
    },
    user.apiKey
  );
  if (!transcriptRes.ok) {
    throw new Error(
      `Failed to seed Transcripts row: ${transcriptRes.status} ${await transcriptRes.text()}`
    );
  }
});

test.afterAll(async () => {
  await cleanupUser(user.id);
});

async function openDataPane(page: Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await openRailSection(page, 'data');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 30_000 });
}

async function openCellViewFromFirstCell(page: Page) {
  const firstCell = page.locator('[data-testid^="log-grid-cell-"]').first();
  await expect(firstCell).toBeVisible({ timeout: 30_000 });
  await firstCell.click();
  const toggle = page.getByTestId('log-grid-view-panel-toggle');
  await expect(toggle).toBeEnabled({ timeout: 10_000 });
  await toggle.click();
  await expect(page.getByTestId('log-cell-view-panel')).toBeVisible({ timeout: 15_000 });
}

test('Contacts SM mode: allowlisted fields editable, contact_id read-only, no delete', async ({
  authedPage: page,
}) => {
  await openDataPane(page);
  await page.getByTestId('data-mode-Contacts').click();
  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-mode', 'Contacts');
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });

  // Select the locked contact_id cell and confirm click does not enter edit.
  const contactIdHeader = page.getByTestId(/log-grid-header-(contact_id|contactId)/);
  await expect(contactIdHeader).toBeVisible({ timeout: 30_000 });
  const contactIdCell = page
    .locator('tr[data-testid^="log-grid-row-"]')
    .first()
    .locator('[data-testid^="log-grid-cell-"]')
    .filter({ hasText: '42' })
    .first();
  await contactIdCell.click();
  await page.getByTestId('log-grid-view-panel-toggle').click();
  await expect(page.getByTestId('log-cell-view-panel')).toBeVisible({ timeout: 15_000 });
  const lockedValue = page
    .locator(
      '[data-testid="log-cell-view-column"][data-column="contact_id"], [data-testid="log-cell-view-column"][data-column="contactId"]'
    )
    .getByTestId('log-cell-view-value');
  await expect(lockedValue).toHaveAttribute('data-editable', 'false');
  await lockedValue.click();
  await expect(page.getByTestId('log-cell-view-editor')).toHaveCount(0);
  await page.getByTestId('log-cell-view-panel').getByRole('button', { name: 'Close' }).click();

  // Select an allowlisted field and confirm click opens an inline editor.
  const firstNameCell = page
    .locator('tr[data-testid^="log-grid-row-"]')
    .first()
    .locator('[data-testid^="log-grid-cell-"]')
    .filter({ hasText: 'Editable' })
    .first();
  await firstNameCell.click();
  await page.getByTestId('log-grid-view-panel-toggle').click();
  await expect(page.getByTestId('log-cell-view-panel')).toBeVisible({ timeout: 15_000 });
  const editableValue = page
    .locator(
      '[data-testid="log-cell-view-column"][data-column="first_name"], [data-testid="log-cell-view-column"][data-column="firstName"]'
    )
    .getByTestId('log-cell-view-value');
  await expect(editableValue).toHaveAttribute('data-editable', 'true');
  await editableValue.click();
  await expect(page.getByTestId('log-cell-view-editor')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('log-cell-view-editor')).toHaveCount(0);

  // Grid toolbar must not offer row delete in SM modes
  const firstRow = page.locator('tr[data-testid^="log-grid-row-"]').first();
  await firstRow.locator('[data-testid^="log-grid-row-index-"]').click();
  await expect(page.getByTestId('log-grid-delete-row')).toHaveCount(0);
});

test('Transcripts SM mode: fully read-only and no delete', async ({ authedPage: page }) => {
  await openDataPane(page);
  await page.getByTestId('data-mode-Transcripts').click();
  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-mode', 'Transcripts');
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });

  await openCellViewFromFirstCell(page);

  const valueBox = page.getByTestId('log-cell-view-value').first();
  await expect(valueBox).toHaveAttribute('data-editable', 'false');
  await valueBox.click();
  await expect(page.getByTestId('log-cell-view-editor')).toHaveCount(0);

  const firstRow = page.locator('tr[data-testid^="log-grid-row-"]').first();
  await firstRow.locator('[data-testid^="log-grid-row-index-"]').click();
  await expect(page.getByTestId('log-grid-delete-row')).toHaveCount(0);
});
