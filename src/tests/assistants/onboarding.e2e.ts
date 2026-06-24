/**
 * Assistant Setup Roadmap E2E.
 *
 * The roadmap lives in the "Onboarding" tab of the assistant info
 * side panel — NOT in a modal. After a fresh hire, the panel
 * auto-opens and the Onboarding tab presents accordion groups
 * (Break the ice, Exchange emails, Get on a call, optionally Install,
 * and Integrations) with atomic sub-steps tracked by a progress bar.
 *
 * As steps resolve, sub-steps tick off and groups auto-collapse with
 * a checkmark. Once everything is resolved the Onboarding tab
 * disappears entirely and the panel falls back to a single Contact
 * Info layout.
 *
 * Asserts:
 *   - the Onboarding tab + roadmap appear in the auto-opened info
 *     panel after hire
 *   - the "Say hi" sub-step seeds the chat composer
 *   - per-step skip removes a sub-step from its group and advances
 *     the progress counter
 *   - the integrations group exposes platform launcher buttons + a
 *     "Mark all set" affordance
 *
 * Run: npx playwright test src/tests/assistants/onboarding.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  openHireDialog,
  fillProfileFields,
  selectVoice,
  clickHireButton,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  setUserCredits,
  openDroidSwitcher,
} from './helpers';

const user = createTestUser({ name: 'Roadmap', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

test.afterAll(() => {
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

/**
 * Local navigation that does NOT set the global "onboarding disabled"
 * flag — we want the roadmap to actually render in this file. Most
 * other suites suppress it via `navigateToAssistants`.
 */
async function navigateForRoadmapTests(page: Page) {
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

async function hireBareAssistant(page: Page, firstName: string, lastName = 'Bot') {
  await navigateForRoadmapTests(page);

  const dialogVisible = await page
    .getByRole('heading', { name: 'Onboard Droid' })
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (!dialogVisible) {
    await openHireDialog(page);
  }

  await fillProfileFields(page, {
    firstName,
    lastName,
    about: 'Setup roadmap test assistant.',
  });
  await selectVoice(page);
  await clickHireButton(page);

  // Confirm hire success: assistant lands in the list (inside the switcher).
  await openDroidSwitcher(page);
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', {
    hasText: firstName,
  });
  await expect(listItem).toBeVisible({ timeout: 60_000 });
}

/**
 * Opens the info side panel via the chat sub-header button if the
 * post-hire auto-open didn't fire (slow CI timing).
 */
async function ensureInfoPanelOpen(page: Page) {
  const infoSheet = page.getByTestId('assistant-info-sheet');
  if (!(await infoSheet.isVisible({ timeout: 3_000 }).catch(() => false))) {
    await page.getByTestId('assistant-info-button').click();
  }
  await expect(infoSheet).toBeVisible({ timeout: 5_000 });
}

test('post-hire roadmap renders Onboarding + Contact tabs, groups accordion, and progress', async ({
  authedPage: page,
}) => {
  const firstName = `Road${Date.now()}`;
  await hireBareAssistant(page, firstName);

  // ── 1. Auto-opened info panel surfaces Onboarding + Contact tabs ──
  await ensureInfoPanelOpen(page);

  const onboardingTab = page.getByTestId('assistant-info-tab-onboarding');
  const contactTab = page.getByTestId('assistant-info-tab-contact');
  await expect(onboardingTab).toBeVisible({ timeout: 5_000 });
  await expect(contactTab).toBeVisible();

  // Active tab on first render should be Onboarding (no progress yet).
  const roadmap = page.getByTestId('assistant-setup-roadmap');
  await expect(roadmap).toBeVisible();

  // Progress bar starts at "1 of N done" — the always-resolved Hire
  // step is the visible momentum we hand the user before they've
  // done anything else in the panel.
  await expect(page.getByTestId('assistant-setup-roadmap-progress-text')).toContainText(
    /1 of \d+ done/
  );

  // ── 2. Groups accordion: all expected groups present ──
  // `started` is always-resolved (acknowledges the hire); `install`
  // only renders for desktop hires which this isn't.
  for (const group of [
    'started',
    'breakIce',
    'exchangeEmails',
    'getOnCall',
    'integrations',
  ] as const) {
    await expect(page.getByTestId(`assistant-setup-roadmap-group-${group}`)).toBeVisible();
  }

  // First incomplete group ("breakIce") is expanded by default;
  // others start collapsed.
  await expect(page.getByTestId('assistant-setup-roadmap-step-sayHi')).toBeVisible();
  await expect(page.getByTestId('assistant-setup-roadmap-step-email')).toBeHidden();

  // ── 3. Expanding another group reveals its steps ──
  await page.getByTestId('assistant-setup-roadmap-group-exchangeEmails-toggle').click();
  await expect(page.getByTestId('assistant-setup-roadmap-step-email')).toBeVisible();
  await expect(page.getByTestId('assistant-setup-roadmap-step-emailAsk')).toBeVisible();
});

test('roadmap "Say hi" seeds chat composer with friendly draft', async ({ authedPage: page }) => {
  const firstName = `Hi${Date.now()}`;
  await hireBareAssistant(page, firstName);
  await ensureInfoPanelOpen(page);

  await page.getByTestId('assistant-setup-roadmap-step-sayHi-action').click();

  const composer = page.locator('textarea').first();
  // Seed effect uses requestAnimationFrame, so allow a tick.
  await expect(composer).toHaveValue(/^Hi /, { timeout: 5_000 });
});

test('roadmap step row is itself the action button (no separate CTA)', async ({
  authedPage: page,
}) => {
  // The whole row is the click target now — there's no longer a
  // standalone "Say hi" button alongside the row label. This test
  // guards the affordance: clicking the row data-testid (= the
  // <button>) should still trigger the prefill seed.
  const firstName = `Row${Date.now()}`;
  await hireBareAssistant(page, firstName);
  await ensureInfoPanelOpen(page);

  // Action testid == row testid + '-action' lives on the inner
  // button; tagName must be BUTTON (the whole row is interactive).
  const actionButton = page.getByTestId('assistant-setup-roadmap-step-sayHi-action');
  await expect(actionButton).toBeVisible();
  expect(await actionButton.evaluate((el) => el.tagName)).toBe('BUTTON');

  await actionButton.click();
  const composer = page.locator('textarea').first();
  await expect(composer).toHaveValue(/^Hi /, { timeout: 5_000 });
});

test('integrations launcher seeds chat draft but does not auto-resolve the group', async ({
  authedPage: page,
}) => {
  const firstName = `Int${Date.now()}`;
  await hireBareAssistant(page, firstName);
  await ensureInfoPanelOpen(page);

  // Open the integrations group — it starts incomplete.
  await page.getByTestId('assistant-setup-roadmap-group-integrations-toggle').click();
  await expect(page.getByTestId('assistant-setup-roadmap-group-integrations')).toHaveAttribute(
    'data-status',
    'incomplete'
  );

  for (const platform of ['google', 'teams', 'azure', 'other'] as const) {
    await expect(page.getByTestId(`assistant-setup-roadmap-integration-${platform}`)).toBeVisible();
  }

  // Clicking a named platform seeds the chat composer with a
  // guided-walkthrough prompt naming the provider. Integrations is an
  // *optional* / perpetually-open launcher list, so the click must
  // NOT mark the group complete — the user might want to expand the
  // group again tomorrow to onboard another platform.
  await page.getByTestId('assistant-setup-roadmap-integration-google').click();
  const composer = page.locator('textarea').first();
  await expect(composer).toHaveValue(/guide me through giving you access to my Google account/i, {
    timeout: 5_000,
  });
  await expect(page.getByTestId('assistant-setup-roadmap-group-integrations')).toHaveAttribute(
    'data-status',
    'incomplete'
  );
});

test('integrations "Other…" prefills an open-ended platform-name prompt', async ({
  authedPage: page,
}) => {
  const firstName = `Other${Date.now()}`;
  await hireBareAssistant(page, firstName);
  await ensureInfoPanelOpen(page);

  await page.getByTestId('assistant-setup-roadmap-group-integrations-toggle').click();
  await page.getByTestId('assistant-setup-roadmap-integration-other').click();

  const composer = page.locator('textarea').first();
  // Prompt ends with "on: " so the cursor lands ready for the user
  // to type whatever platform they care about.
  await expect(composer).toHaveValue(/giving you access to my account on:\s*$/i, {
    timeout: 5_000,
  });
});

test('roadmap surfaces the Hire step as already-completed', async ({ authedPage: page }) => {
  // The first row exists purely to acknowledge progress already made
  // (the user *did* hire someone) — it must render as resolved
  // immediately, with no action button.
  const firstName = `Hired${Date.now()}`;
  await hireBareAssistant(page, firstName);
  await ensureInfoPanelOpen(page);

  const hireRow = page.getByTestId('assistant-setup-roadmap-step-hire');
  await expect(hireRow).toBeVisible();
  await expect(hireRow).toHaveAttribute('data-status', 'done');
  // Resolved rows render as a non-interactive <li> — the action
  // testid only exists on pending rows.
  await expect(page.getByTestId('assistant-setup-roadmap-step-hire-action')).toHaveCount(0);
});

test('"Ask in chat" steps disable + tooltip until their channel is set up', async ({
  authedPage: page,
}) => {
  // A bare-hired assistant has no email or phone, so the "Ask the
  // assistant to email you" / "...call you" rows are dependent on
  // first configuring a channel. They render visible (so the user
  // sees the full picture) but non-interactive, with a tooltip
  // explaining the prerequisite.
  const firstName = `Dep${Date.now()}`;
  await hireBareAssistant(page, firstName);
  await ensureInfoPanelOpen(page);

  // Expand the email group and confirm the dependent row is blocked.
  await page.getByTestId('assistant-setup-roadmap-group-exchangeEmails-toggle').click();
  const emailAskRow = page.getByTestId('assistant-setup-roadmap-step-emailAsk');
  await expect(emailAskRow).toBeVisible();
  await expect(emailAskRow).toHaveAttribute('data-status', 'pending-blocked');
  await expect(page.getByTestId('assistant-setup-roadmap-step-emailAsk-action')).toBeDisabled();

  // Expand phone group and confirm the same dependency contract.
  await page.getByTestId('assistant-setup-roadmap-group-getOnCall-toggle').click();
  const phoneAskRow = page.getByTestId('assistant-setup-roadmap-step-phoneAsk');
  await expect(phoneAskRow).toBeVisible();
  await expect(phoneAskRow).toHaveAttribute('data-status', 'pending-blocked');
  await expect(page.getByTestId('assistant-setup-roadmap-step-phoneAsk-action')).toBeDisabled();
});

test('chat header info button shows a "needs attention" dot while onboarding has outstanding work', async ({
  authedPage: page,
}) => {
  // The dot is anchored to the info-button rather than the list row
  // so it points directly at the panel that holds the work — without
  // it, a user who dismissed the auto-opened panel has no nudge
  // pointing back to the outstanding setup. Visibility alone is
  // asserted (not color/position) so the test stays robust to
  // styling tweaks.
  const firstName = `Dot${Date.now()}`;
  await hireBareAssistant(page, firstName);

  const dot = page.getByTestId('assistant-info-button-onboarding-dot');
  await expect(dot).toBeVisible({ timeout: 30_000 });

  // The button's accessible name should also reflect the state so
  // screen-reader users get the same hint as sighted users.
  await expect(page.getByTestId('assistant-info-button')).toHaveAttribute(
    'aria-label',
    /setup incomplete/i
  );
});
