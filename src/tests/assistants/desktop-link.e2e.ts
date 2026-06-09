/**
 * User Desktop Linking E2E.
 *
 * Exercises the per-user "link your desktop" flow reached from the
 * assistant setup roadmap's "Install on your machine" step. The flow
 * lets an owner connect their own registered machine to any of their
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
  ensureProjectSync,
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

/**
 * Navigate to /assistants WITHOUT setting the global onboarding-disabled
 * flag, so the setup roadmap (which hosts the desktop linker entry point)
 * actually renders.
 */
async function navigateForLinker(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem('console:assistants:onboarding:disabled');
    } catch {
      /* private mode — ignore */
    }
  });
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
}

/**
 * Select an assistant, open its info side panel, switch to the Onboarding
 * tab, expand the "Install on your machine" group, and click the step to
 * open the desktop linker dialog.
 */
async function openDesktopLinker(page: Page, agentId: number) {
  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(listItem).toBeVisible({ timeout: 20_000 });
  await listItem.click();
  await page.waitForTimeout(1_000);

  const infoSheet = page.getByTestId('assistant-info-sheet');
  if (!(await infoSheet.isVisible({ timeout: 3_000 }).catch(() => false))) {
    await page.getByTestId('assistant-info-button').click();
  }
  await expect(infoSheet).toBeVisible({ timeout: 5_000 });

  await page.getByTestId('assistant-info-tab-onboarding').click();

  // The install group is not the first incomplete group, so it starts
  // collapsed — expand it to reveal the step row.
  await page.getByTestId('assistant-setup-roadmap-group-install-toggle').click();
  await page.getByTestId('assistant-setup-roadmap-step-install-action').click();

  await expect(page.getByRole('dialog')).toContainText('Link User Desktop', { timeout: 5_000 });
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
  await expect(dialog).toContainText(/Currently linked to Owner's MacBook/i);

  await dialog.getByRole('button', { name: /unlink/i }).click();

  await expect(page.getByText('Desktop unlinked')).toBeVisible({ timeout: 10_000 });

  // DB: Ada's link is gone; Alan's (from the previous test) survives.
  await expect
    .poll(() => getLinkedDesktopIds(ada.agentId, user.id), { timeout: 10_000 })
    .toEqual([]);
  expect(getLinkedDesktopIds(alan.agentId, user.id)).toEqual([macbook.id]);
  expect(getDesktopLinkCount(macbook.id)).toBe(1);
});
