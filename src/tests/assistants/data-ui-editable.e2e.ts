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

async function openRowDetailFromFirstCell(page: Page) {
  const firstCell = page.locator('[data-testid^="log-grid-cell-"]').first();
  await expect(firstCell).toBeVisible({ timeout: 30_000 });
  await firstCell.click();
  const toggle = page.getByTestId('log-grid-view-panel-toggle');
  await expect(toggle).toBeEnabled({ timeout: 10_000 });
  await toggle.click();
  await expect(page.getByTestId('log-cell-view-panel')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('log-cell-view-edit-cell').click();
  await expect(page.getByTestId('data-row-detail')).toBeVisible({ timeout: 15_000 });
  // Editable cells open in single-field edit; exit so callers can use Edit row.
  const discard = page.getByRole('button', { name: 'Discard changes' });
  if ((await discard.count()) > 0) {
    await discard.click();
  }
}

test('Contacts SM mode: allowlisted fields editable, contact_id read-only, no delete', async ({
  authedPage: page,
}) => {
  await openDataPane(page);
  await page.getByTestId('data-mode-Contacts').click();
  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-mode', 'Contacts');
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });

  await openRowDetailFromFirstCell(page);

  await expect(page.getByTestId('data-row-detail-delete')).toHaveCount(0);
  await expect(page.getByTestId('data-row-detail-edit')).toBeVisible();

  await page.getByTestId('data-row-detail-edit').click();

  const fields = page.getByTestId('data-row-detail-fields');
  // Field keys may be snake_case (Orchestra) or camelCase (client conversion).
  const contactIdRow = fields.locator('div.group\\/field').filter({
    has: page.locator('dt span', { hasText: /^(contact_id|contactId)$/ }),
  });
  await expect(contactIdRow.getByText('Read-only')).toBeVisible();
  await expect(contactIdRow.locator('input, textarea')).toHaveCount(0);

  const firstNameRow = fields.locator('div.group\\/field').filter({
    has: page.locator('dt span', { hasText: /^(first_name|firstName)$/ }),
  });
  // In row-edit mode, allowlisted fields render inputs (not the per-field pencil).
  await expect(firstNameRow.locator('input, textarea').first()).toBeVisible();
  await expect(firstNameRow.getByText('Read-only')).toHaveCount(0);

  // Grid toolbar must not offer row delete in SM modes
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('data-row-detail')).toHaveCount(0);
  const firstRow = page.locator('tr[data-testid^="log-grid-row-"]').first();
  await firstRow.locator('[data-testid^="log-grid-row-index-"]').click();
  await expect(page.getByTestId('log-grid-delete-row')).toHaveCount(0);
});

test('Transcripts SM mode: fully read-only and no delete', async ({ authedPage: page }) => {
  await openDataPane(page);
  await page.getByTestId('data-mode-Transcripts').click();
  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-mode', 'Transcripts');
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });

  await openRowDetailFromFirstCell(page);

  await expect(page.getByTestId('data-row-detail-delete')).toHaveCount(0);
  await expect(page.getByTestId('data-row-detail-edit')).toHaveCount(0);
  await expect(page.getByTestId('data-row-detail-fields')).toContainText('content');
});
