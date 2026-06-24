/**
 * User Desktop Filesystem-Access Consent E2E.
 *
 * Exercises the "Filesystem access" toggle inside the per-user desktop linker.
 * The toggle is the user's standing consent for an assistant to read from /
 * write versioned copies back to their home folder over SFTP. It only appears
 * once a machine is currently linked to the assistant.
 *
 * Enabling consent must, server-side, both flip `filesys_sync` AND mint the
 * per-link SFTP key (`filesync_sshkey`); disabling must clear both (key +
 * tunnel coordinates). We therefore assert the full reconciliation against
 * `assistant_user_desktops`, not just the visible toggle.
 *
 *   - A registered desktop ("Owner's MacBook") is seeded linked to Ada with
 *     consent OFF (the seed default).
 *   - Opening Ada's linker surfaces the toggle (off) with its disclosure copy.
 *   - Turning it ON enables sync and mints the key.
 *   - Turning it OFF disables sync and clears the key.
 *
 * Run: npx playwright test src/tests/assistants/desktop-filesys.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  createUserDesktop,
  linkUserDesktop,
  deleteAllAssistantsForUser,
  deleteUserDesktopsForUser,
  getLinkFilesysState,
  ensureProjectSync,
} from './helpers';

const user = createTestUser({ name: 'Filesys', lastName: 'Consent', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const ada = createAssistant({ userId: user.id, firstName: 'Ada', surname: 'Lovelace' });

const macbook = createUserDesktop({ userId: user.id, name: "Owner's MacBook", os: 'macos' });
linkUserDesktop({ assistantId: ada.agentId, desktopId: macbook.id, ownerUserId: user.id });

test.afterAll(() => {
  deleteUserDesktopsForUser(user.id);
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

async function navigateForLinker(page: Page) {
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
}

/** Open the desktop linker from the assistant row's overflow ("⋯") menu. */
async function openDesktopLinker(page: Page, agentId: number) {
  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(listItem).toBeVisible({ timeout: 20_000 });
  await listItem.hover();

  await page.getByTestId(`assistant-menu-${agentId}`).click();
  await page.getByTestId('menu-connect-desktop').click();

  await expect(page.getByRole('dialog')).toContainText('Link User Desktop', { timeout: 5_000 });
}

test('toggling filesystem access drives consent flag and per-link SFTP key', async ({
  authedPage: page,
}) => {
  // Precondition: linked with consent off, so no key has been minted yet.
  expect(getLinkFilesysState(ada.agentId, macbook.id)).toEqual({
    filesysSync: false,
    hasKey: false,
  });

  await navigateForLinker(page);
  await openDesktopLinker(page, ada.agentId);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(/Currently linked to Owner's MacBook/i);

  // The consent toggle is present, off, and carries its full disclosure copy.
  const toggle = dialog.getByRole('switch', { name: /filesystem access/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await expect(dialog).toContainText(/read files from your home folder/i);
  await expect(dialog).toContainText(/originals are never overwritten/i);
  await expect(dialog).toContainText(/turn it off any time to revoke access/i);

  // Enable: flips the flag and mints the per-link key.
  await toggle.click();
  await expect(page.getByText('Filesystem access enabled')).toBeVisible({ timeout: 10_000 });
  await expect(toggle).toBeChecked();
  await expect
    .poll(() => getLinkFilesysState(ada.agentId, macbook.id), { timeout: 10_000 })
    .toEqual({ filesysSync: true, hasKey: true });

  // Disable: clears the flag and the key (revocation).
  await toggle.click();
  await expect(page.getByText('Filesystem access disabled')).toBeVisible({ timeout: 10_000 });
  await expect(toggle).not.toBeChecked();
  await expect
    .poll(() => getLinkFilesysState(ada.agentId, macbook.id), { timeout: 10_000 })
    .toEqual({ filesysSync: false, hasKey: false });
});
