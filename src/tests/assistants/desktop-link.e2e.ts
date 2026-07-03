/**
 * User Desktop Linking E2E.
 *
 * Exercises the per-user "link your desktop" flow reached from the
 * assistant row's "Connect your desktop" menu entry. The flow lets an
 * owner connect their own registered machine to any of their
 * assistants, and the same machine may serve several of them (N×M):
 *
 *   - A registered desktop ("Owner's MacBook") is seeded linked to one
 *     assistant (Ada) but not the other (Alan).
 *   - Opening the linker for Alan surfaces the machine as selectable and
 *     flags that it's "Also linked to 1 other assistant" — linking it
 *     creates a second row rather than moving the link.
 *   - Opening the linker for Ada shows the machine as currently linked
 *     and unlinking removes only Ada's row.
 *
 * Every UI mutation is confirmed against `assistant_user_desktops`.
 *
 * Run: npx playwright test src/tests/assistants/desktop-link.e2e.ts
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
  getLinkedDesktopIds,
  getDesktopLinkCount,
  getAssistantSecretNames,
  userDesktopExists,
  getUserDesktopName,
  setDesktopSftpTunnelId,
  getDesktopSftpTunnelId,
  ensureProjectSync,
  navigateToAssistants,
  openUnitySwitcher,
  openDesktopLinkerFromList,
} from './helpers';

const user = createTestUser({ name: 'Desktop', lastName: 'Linker', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const ada = createAssistant({ userId: user.id, firstName: 'Ada', surname: 'Lovelace' });
const alan = createAssistant({ userId: user.id, firstName: 'Alan', surname: 'Turing' });

const macbook = createUserDesktop({ userId: user.id, name: "Owner's MacBook", os: 'macos' });
linkUserDesktop({ assistantId: ada.agentId, desktopId: macbook.id, ownerUserId: user.id });

test.afterAll(() => {
  deleteUserDesktopsForUser(user.id);
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

async function navigateForLinker(page: Page) {
  await navigateToAssistants(page);
}

/**
 * Open the desktop linker from the assistant row's overflow ("⋯") menu via
 * the "Connect your desktop" entry. The kebab is owner-only and revealed on
 * row hover.
 */
async function openDesktopLinker(page: Page, agentId: number) {
  await openUnitySwitcher(page);
  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(listItem).toBeVisible({ timeout: 20_000 });
  await openDesktopLinkerFromList(page, agentId);
  await expect(page.getByRole('dialog')).toContainText(/see and control that machine/i);
}

test('links one machine to a second assistant (N×M), keeping the first link', async ({
  authedPage: page,
}) => {
  // Precondition: Ada already owns the only link to the MacBook.
  expect(getLinkedDesktopIds(ada.agentId, user.id)).toEqual([macbook.id]);
  expect(getLinkedDesktopIds(alan.agentId, user.id)).toEqual([]);

  await navigateForLinker(page);
  await openDesktopLinker(page, alan.agentId);

  // The machine is selectable here (not blocked) and flags its other link.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText("Owner's MacBook");
  await expect(dialog).toContainText(/Also linked to 1 other assistant/i);

  // Click the desktop row to link it to Alan as well.
  await dialog.getByText("Owner's MacBook").click();

  await expect(page.getByText('Desktop linked successfully')).toBeVisible({ timeout: 10_000 });

  // DB: both assistants now reference the same machine.
  await expect
    .poll(() => getLinkedDesktopIds(alan.agentId, user.id), { timeout: 10_000 })
    .toEqual([macbook.id]);
  expect(getLinkedDesktopIds(ada.agentId, user.id)).toEqual([macbook.id]);
  expect(getDesktopLinkCount(macbook.id)).toBe(2);
});

test('shows the currently-linked machine and unlinks only that assistant', async ({
  authedPage: page,
}) => {
  await navigateForLinker(page);
  await openDesktopLinker(page, ada.agentId);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(/Linked desktop/i);
  await expect(dialog).toContainText("Owner's MacBook");

  await dialog.getByRole('button', { name: /unlink/i }).click();

  await expect(page.getByText('Desktop unlinked')).toBeVisible({ timeout: 10_000 });

  // DB: Ada's link is gone; Alan's (from the previous test) survives.
  await expect
    .poll(() => getLinkedDesktopIds(ada.agentId, user.id), { timeout: 10_000 })
    .toEqual([]);
  expect(getLinkedDesktopIds(alan.agentId, user.id)).toEqual([macbook.id]);
  expect(getDesktopLinkCount(macbook.id)).toBe(1);
});

test('renames a registered desktop from the linker row', async ({ authedPage: page }) => {
  const newName = "Owner's MacBook Pro";

  await navigateForLinker(page);
  await openDesktopLinker(page, alan.agentId);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText("Owner's MacBook");

  // Open the rename popover for this desktop and submit a new name.
  await page.getByTestId(`desktop-rename-${macbook.id}`).click();
  const input = page.getByTestId('desktop-rename-input');
  await expect(input).toBeVisible();
  await input.fill(newName);
  await page.getByTestId('desktop-rename-save').click();

  await expect(page.getByText('Desktop renamed')).toBeVisible({ timeout: 10_000 });

  // DB: the friendly name is persisted.
  await expect.poll(() => getUserDesktopName(macbook.id), { timeout: 10_000 }).toBe(newName);
});

test('saves the macOS user password as a per-assistant secret', async ({ authedPage: page }) => {
  // Precondition: the assistant has no macOS password secret yet.
  expect(await getAssistantSecretNames(user.apiKey, user.id, alan.agentId)).not.toContain(
    'MACOS_USER_DESKTOP_PASSWORD'
  );

  await navigateForLinker(page);
  await openDesktopLinker(page, alan.agentId);

  const dialog = page.getByRole('dialog');

  // "Save User Password" is macOS-only: hidden until macOS is selected.
  await expect(dialog.getByRole('button', { name: /save user password/i })).toHaveCount(0);

  await dialog.getByRole('button', { name: 'macOS', exact: true }).click();

  const saveTrigger = dialog.getByRole('button', { name: /save user password/i });
  await expect(saveTrigger).toBeVisible();
  await saveTrigger.click();

  // Enter the password into the popover and submit.
  await page.getByPlaceholder('Your Mac login password').fill('hunter2-secret');
  await page.getByRole('button', { name: /save securely/i }).click();

  await expect(page.getByText('Password saved')).toBeVisible({ timeout: 10_000 });

  // Backend: the secret now exists under the assistant's Secrets context.
  await expect
    .poll(() => getAssistantSecretNames(user.apiKey, user.id, alan.agentId), { timeout: 10_000 })
    .toContain('MACOS_USER_DESKTOP_PASSWORD');
});

test('deletes a registered desktop and clears its links', async ({ authedPage: page }) => {
  // Precondition: the machine still exists and is linked to Alan. Give it an
  // SFTP tunnel id so deletion exercises the dual-tunnel teardown path (the
  // desktop carries both an HTTP tunnel in `url` and a raw-TCP SFTP tunnel).
  // The relay-side deregistration is best-effort and not observable from the
  // DB, so we assert the desktop tears down cleanly while carrying the id.
  expect(userDesktopExists(macbook.id)).toBe(true);
  expect(getLinkedDesktopIds(alan.agentId, user.id)).toEqual([macbook.id]);
  setDesktopSftpTunnelId(macbook.id, 'sftptun1');
  expect(getDesktopSftpTunnelId(macbook.id)).toBe('sftptun1');

  await navigateForLinker(page);
  await openDesktopLinker(page, alan.agentId);

  await page.getByTestId(`desktop-delete-${macbook.id}`).click();

  // Confirm in the AlertDialog.
  const confirm = page.getByTestId('desktop-delete-confirm');
  await expect(confirm).toBeVisible();
  await confirm.click();

  await expect(page.getByText('Desktop deleted')).toBeVisible({ timeout: 10_000 });

  // DB: the desktop row and every assignment are gone (FK cascade).
  await expect.poll(() => userDesktopExists(macbook.id), { timeout: 10_000 }).toBe(false);
  expect(getLinkedDesktopIds(alan.agentId, user.id)).toEqual([]);
  expect(getDesktopLinkCount(macbook.id)).toBe(0);
});
