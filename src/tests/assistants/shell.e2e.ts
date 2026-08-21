/**
 * Rail shell E2E — verifies the /assistants rail shell: the unity switcher
 * popover, Workspace/Brain section navigation, the account menu, and
 * collapse-to-dock persistence.
 *
 * Run: npx playwright test src/tests/assistants/shell.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openUnitySwitcher,
  openRailSection,
  getCoordinatorAgentId,
  deferCoordinatorOnboarding,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';
import { assistantRail, railSection, railUnitySwitcher } from '../helpers/shell';

const user = createTestUser({ name: 'ShellE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

const shellOpts = { userId: user.id, apiKey: user.apiKey };

test.beforeAll(async () => {
  const coordinatorId = getCoordinatorAgentId(user.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(user.apiKey, coordinatorId);
  }
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('the rail renders with the brand and unity switcher', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);
  createAssistant({ userId: user.id, firstName: 'Rail', surname: 'Resident' });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const rail = assistantRail(page);
  await expect(rail).toBeVisible({ timeout: 15_000 });
  await expect(rail.getByText('Unify', { exact: true })).toBeVisible();
  await expect(railUnitySwitcher(page)).toBeVisible();
});

test('the unity switcher opens and selecting a unity drives the section host @push @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  const unity = createAssistant({ userId: user.id, firstName: 'Switchy', surname: 'Pick' });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);

  await openUnitySwitcher(page, shellOpts);
  const row = page.getByTestId(`assistant-list-item-${unity.agentId}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText('Switchy');
  await row.click();

  // Picking dismisses the list; the rail's face carries the answer out.
  await expect(page.getByTestId('rail-unity-switcher-popover')).toHaveCount(0, { timeout: 5_000 });
  await expect(railSection(page, 'chat')).toContainText('Switchy');
  // Default section is Chat.
  await expect(railSection(page, 'chat')).toHaveAttribute('aria-current', 'page');
});

test('the face opens its own teammate, then their profile, while the chevron reaches another', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  const facey = createAssistant({ userId: user.id, firstName: 'Facey', surname: 'Fallthrough' });
  const chevvy = createAssistant({ userId: user.id, firstName: 'Chevvy', surname: 'Elsewhere' });

  // The profile panel remembers whether it was last open, so seed it shut to
  // give the face's toggle a known starting point.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('console:assistants:info-panel-open', 'false');
    } catch {
      /* private mode — ignore */
    }
  });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);

  const face = railSection(page, 'chat');
  const picker = page.getByTestId('rail-unity-switcher-popover');
  const profile = page.getByTestId('assistant-info-sheet');

  // The chevron is the only route to a teammate, so it settles which face the
  // rest of this journey presses.
  await openUnitySwitcher(page, shellOpts);
  await page.getByTestId(`assistant-list-item-${facey.agentId}`).click();
  await expect(picker).toHaveCount(0, { timeout: 5_000 });
  await expect(face).toContainText('Facey');

  // Away from Chat the face is a nav button: it goes home, picker untouched.
  await openRailSection(page, 'tasks');
  await face.click();
  await expect(face).toHaveAttribute('aria-current', 'page');
  await expect(picker).toHaveCount(0);
  await expect(profile).toHaveCount(0);

  // Home already open, so the same press goes one depth further into the same
  // teammate and opens who they are — never out to a different one.
  await face.click();
  await expect(profile).toBeVisible({ timeout: 10_000 });
  await expect(face).toHaveAttribute('aria-expanded', 'true');
  await expect(picker).toHaveCount(0);

  // And reads as a toggle rather than reopening what the click just dismissed.
  await face.click();
  await expect(profile).toHaveCount(0, { timeout: 5_000 });
  await expect(face).toHaveAttribute('aria-expanded', 'false');

  // Reaching a different teammate stays with the chevron beside the face.
  await openUnitySwitcher(page, shellOpts);
  await page.getByTestId(`assistant-list-item-${chevvy.agentId}`).click();
  await expect(picker).toHaveCount(0, { timeout: 5_000 });
  await expect(face).toContainText('Chevvy');
});

test('Workspace and Brain section nav switches the active view', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);
  const unity = createAssistant({ userId: user.id, firstName: 'Navvy', surname: 'Sections' });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page, shellOpts);
  await page.getByTestId(`assistant-list-item-${unity.agentId}`).click();
  await expect(railSection(page, 'chat')).toContainText('Navvy');

  await openRailSection(page, 'tasks');
  await expect(railSection(page, 'tasks')).toHaveAttribute('aria-current', 'page');

  await openRailSection(page, 'data');
  await expect(railSection(page, 'data')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 30_000 });
});

test('mobile viewport exposes rail navigation via the menu toggle', async ({
  authedPage: page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });

  deleteAllAssistantsForUser(user.id);
  createAssistant({ userId: user.id, firstName: 'Mobile', surname: 'Shell' });

  await navigateToAssistants(page, { ...shellOpts, skipRailCheck: true });
  await closeHireDialogIfOpen(page);

  // A hidden duplicate shell surface can mount its own toggle; assert and
  // click the visible instance only.
  const mobileToggle = page.locator('[data-testid="rail-mobile-toggle"]:visible').first();
  await expect(mobileToggle).toBeVisible({ timeout: 15_000 });
  await expect(assistantRail(page)).toHaveCount(0);

  await mobileToggle.click();
  const rail = assistantRail(page);
  await expect(rail).toBeVisible({ timeout: 5_000 });
  await expect(railSection(page, 'chat')).toBeVisible();
  await expect(page.getByTestId('chat-search-trigger')).toBeVisible();
});

test('the folded rail sizes its pickers to the nav column without covering the face', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  createAssistant({ userId: user.id, firstName: 'Docky', surname: 'Fold' });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);

  const rail = assistantRail(page);
  const collapseToggle = rail.getByTestId('rail-collapse-toggle');
  await collapseToggle.click();

  const picker = railUnitySwitcher(page);
  await expect(picker).toBeVisible({ timeout: 5_000 });

  // Folded, a picker is a tile in the nav column, so it carries a nav tile's
  // box. The rail's width animates as it folds, so compare the two boxes only
  // once the fold has settled.
  await expect
    .poll(
      async () => {
        const pickerBox = await picker.boundingBox();
        const navBox = await collapseToggle.boundingBox();
        if (!pickerBox || !navBox) return 'a box is missing';
        const size = (box: { width: number; height: number }) =>
          `${Math.round(box.width)}x${Math.round(box.height)}`;
        return size(pickerBox) === size(navBox)
          ? "the picker takes a nav tile's box"
          : `picker ${size(pickerBox)}, nav tile ${size(navBox)}`;
      },
      { timeout: 10_000 }
    )
    .toBe("the picker takes a nav tile's box");

  // At that height the picker's target must not reach over the face above it:
  // the face owns every point in its own box, including the edge they share.
  const face = railSection(page, 'chat');
  const faceBox = await face.boundingBox();
  expect(faceBox).not.toBeNull();
  const ownerAt = (offsetFromBottom: number) =>
    page.evaluate(
      ({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        if (hit?.closest('[data-testid="rail-chat-home"]')) return 'rail-chat-home';
        return hit?.closest('[data-testid]')?.getAttribute('data-testid') ?? null;
      },
      {
        x: faceBox!.x + faceBox!.width / 2,
        y: faceBox!.y + faceBox!.height - offsetFromBottom,
      }
    );
  expect(await ownerAt(faceBox!.height / 2)).toBe('rail-chat-home');
  expect(await ownerAt(1)).toBe('rail-chat-home');

  // And the picker itself still opens from its own box.
  await picker.click();
  await expect(page.getByTestId('rail-unity-switcher-popover')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('rail-unity-switcher-popover')).toHaveCount(0, { timeout: 5_000 });

  // Leave the rail as it was found, so dock state does not leak onward. Folded,
  // the toggle sits under the dev overlay's own bottom-left badge, which would
  // swallow a real click, so unfold through the DOM rather than the pointer.
  await collapseToggle.evaluate((el: HTMLElement) => el.click());
  await expect(rail.getByText('Unify', { exact: true })).toBeVisible({ timeout: 5_000 });
});
