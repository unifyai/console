/**
 * Workspace Provider Card E2E — the profile side panel's Workspace section must
 * report the OAuth-connected workspace provider, not the mailbox tenant.
 *
 * A Coordinator (and any platform-mailbox assistant) keeps a Google mailbox
 * while the owner can OAuth-connect a Microsoft workspace. The card reads the
 * backend-computed `workspace_provider` (derived from the granted-scopes
 * secret), so it must show "Microsoft 365 connected" here even though the email
 * contact's provider is `google_workspace`.
 *
 * Run: npx playwright test src/tests/assistants/workspace-provider-card.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  createAssistant,
  createAssistantTest,
  openAssistantInfoPanelFromList,
  ensureProjectSync,
  cleanupUser,
  dbExecBlock,
} from './helpers';

const user = createTestUser({ name: 'Workspace', lastName: 'Provider', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ProviderBot',
  surname: 'E2E',
});

// Google mailbox (platform tenant) + a Microsoft OAuth grant. The card must
// follow the grant, not the mailbox.
dbExecBlock(`
INSERT INTO assistant_contacts (assistant_id, contact_type, contact_value, provider, provisioned_by, status)
VALUES (${assistant.agentId}, 'email', 'providerbot-${user.id}@unify.ai', 'google_workspace', 'platform', 'active');
INSERT INTO assistant_secrets (user_id, agent_id, secret_name, secret_value)
VALUES
  ('${user.id}', ${assistant.agentId}, 'MICROSOFT_GRANTED_SCOPES', 'Files.Read.All ChannelMessage.Read.All')
ON CONFLICT (agent_id, secret_name) DO UPDATE SET secret_value = EXCLUDED.secret_value;
`);

test.afterAll(() => {
  cleanupUser(user.id);
});

test('workspace card shows the connected Microsoft provider, not the Google mailbox', async ({
  authedPage: page,
}) => {
  await openAssistantInfoPanelFromList(page, assistant.agentId);

  const profileTab = page.getByTestId('assistant-info-tab-profile');
  if (await profileTab.isVisible().catch(() => false)) {
    await profileTab.click();
  }

  const sections = page.getByTestId('assistant-info-profile-sections');
  await expect(sections).toBeVisible({ timeout: 15_000 });

  // The connected provider follows the OAuth grant (Microsoft), never the
  // mailbox tenant (Google).
  await expect(sections.getByText('Microsoft 365 connected')).toBeVisible({ timeout: 10_000 });
  await expect(sections.getByText('Google Workspace connected')).toHaveCount(0);
});
