/**
 * Desktop rail section — when Computer Use is not enabled, show an upgrade
 * empty state instead of waiting for a session that will never arrive.
 *
 * Run: npx playwright test src/tests/assistants/desktop-upgrade.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  selectAssistantInList,
  openRailSection,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';

const user = createTestUser({ name: 'DesktopUpgrade', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'NoComputer',
  surname: 'Bot',
  desktopMode: null,
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('Desktop rail shows Enable Computer when managed desktop is off', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await openRailSection(page, 'desktop');

  const upgrade = page.getByTestId('desktop-computer-upgrade');
  await expect(upgrade).toBeVisible({ timeout: 10_000 });
  await expect(upgrade.getByText('Computer not enabled')).toBeVisible();
  await expect(page.getByTestId('desktop-enable-computer')).toBeVisible();

  // Must not sit in the endless starting/connecting loader.
  await expect(page.getByText(/Starting .* session/i)).not.toBeVisible();
  await expect(page.getByText(/Connecting to .* desktop/i)).not.toBeVisible();

  await page.getByTestId('desktop-enable-computer').click();
  await expect(page.getByRole('dialog').getByText('Computer Use')).toBeVisible({
    timeout: 10_000,
  });
});
