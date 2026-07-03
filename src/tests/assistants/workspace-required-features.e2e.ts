/**
 * Workspace Required Features E2E — the feature checklist in the Workspace modal
 * must surface the non-negotiable grants (Drive + SharePoint for Microsoft) as
 * badged, disabled, and listed *before* the optional ones.
 *
 * A Microsoft workspace grant is seeded directly (BYOD email contact + granted
 * scopes) so the modal opens straight into the connected view — this avoids the
 * pre-connect provider cards, which are gated behind the deployment's OAuth
 * client IDs and stay disabled in the local stub. The connected checklist reads
 * the same `requiredFeatures` / ordering code path as the pre-connect one.
 *
 * Run: npx playwright test src/tests/assistants/workspace-required-features.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  createAssistant,
  createAssistantTest,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openUnitySwitcher,
  openWorkspaceManagerFromList,
  ensureProjectSync,
  cleanupUser,
  dbExecBlock,
} from './helpers';

const user = createTestUser({ name: 'Required', lastName: 'Features', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'RequiredBot',
  surname: 'E2E',
});

// Seed a connected Microsoft workspace with email + calendar granted (so
// `selected` mixes a required and an optional feature) but NOT drive/sharepoint
// — those stay required-but-unchecked, and no file tree renders to interfere.
// The granted-features endpoint returns the full Microsoft required set for any
// connected Microsoft account, so the checklist still badges all four.
const MS = 'https://graph.microsoft.com';
const grantedScopes = [
  `${MS}/User.Read`,
  'offline_access',
  `${MS}/Mail.Read`,
  `${MS}/Mail.Send`,
  `${MS}/Mail.ReadWrite`,
  `${MS}/Calendars.Read`,
  `${MS}/Calendars.ReadWrite`,
].join(' ');

dbExecBlock(`
INSERT INTO assistant_contacts (assistant_id, contact_type, contact_value, provider, provisioned_by, status)
VALUES (${assistant.agentId}, 'email', 'requiredbot-${user.id}@example.com', 'microsoft_workspace', 'user', 'active');
INSERT INTO assistant_secrets (user_id, agent_id, secret_name, secret_value)
VALUES
  ('${user.id}', ${assistant.agentId}, 'MICROSOFT_GRANTED_SCOPES', '${grantedScopes}')
ON CONFLICT (agent_id, secret_name) DO UPDATE SET secret_value = EXCLUDED.secret_value;
`);

test.afterAll(() => {
  cleanupUser(user.id);
});

test('required workspace features are badged, disabled, and listed first', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  await openWorkspaceManagerFromList(page, assistant.agentId);

  const dialog = page.getByRole('dialog');
  // Feature rows are the labels wrapping a checkbox (the "Connected Email"
  // label has no checkbox, so it's excluded).
  const rows = dialog.locator('label:has([role="checkbox"])');
  await expect(rows).toHaveCount(7, { timeout: 15_000 });

  const rowTexts = await rows.allInnerTexts();
  const order = rowTexts.map((t) => t.split('\n')[0].trim());
  expect(order).toEqual(['Email', 'Teams', 'Drive', 'SharePoint', 'Calendar', 'Contacts', 'Tasks']);

  // The four required features carry the badge; the optional ones do not.
  for (const name of ['Email', 'Teams', 'Drive', 'SharePoint']) {
    await expect(rows.filter({ hasText: name }).first()).toContainText('Required');
  }
  for (const name of ['Calendar', 'Contacts', 'Tasks']) {
    await expect(rows.filter({ hasText: name }).first()).not.toContainText('Required');
  }

  // Required checkboxes can't be toggled off.
  await expect(
    rows.filter({ hasText: 'Drive' }).first().locator('[role="checkbox"]')
  ).toBeDisabled();
  await expect(
    rows.filter({ hasText: 'SharePoint' }).first().locator('[role="checkbox"]')
  ).toBeDisabled();
});
