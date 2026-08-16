/**
 * Shared Playwright helpers for assistant E2E tests.
 *
 * Same pattern as billing/helpers.ts and account/helpers.ts:
 * one seeded user per file, `createAssistantTest(user)` gives
 * an `authedPage` fixture that logs in once and reuses the session.
 */

import { test as base, expect, type Page, type Browser } from '@playwright/test';
import path from 'path';
import os from 'os';
import {
  login,
  loginAndWaitForRedirect,
  loginWithPreAuthApi,
  switchToEmailTab,
  waitForLoginSurface,
  completeAccountOnboardingIfPresent,
} from '../auth/helpers';
import { orchestraFetch as _orchestraFetch } from '../helpers/seeds/client';
import {
  deferCoordinatorAfterAssistantsLoad,
  deferCoordinatorForUser,
  deferCoordinatorOnboarding,
  dismissCoordinatorOnboardingIfOpen,
  ensureShellReady,
  getCoordinatorAgentId,
} from '../helpers/coordinator';
import {
  assistantRail,
  railSection,
  railUnitySwitcher,
  waitForAssistantsRail,
} from '../helpers/shell';

export { createTestUser, cleanupUser, setUserCredits } from '../helpers/e2e-helpers';
export type { TestUser } from '../helpers/e2e-helpers';

export {
  uniqueEmail,
  dbExec,
  dbExecBlock,
  createUser,
  createOrg,
  deleteOrg,
  addMember,
  orchestraFetch,
  createAssistant,
  createPersonalCoordinator,
  connectWorkspaceEmail,
  createUserDesktop,
  linkUserDesktop,
  createTeamForAssistant,
  addAssistantToTeam,
  ensureVoicePreset,
  ensureProjectSync,
  createMsTeamsBotInstall,
  getMsTeamsBotInstallState,
  deleteMsTeamsBotInstall,
  seedChatInfrastructure,
} from '../helpers/seeds/client';
export {
  deferCoordinatorAfterAssistantsLoad,
  deferCoordinatorForUser,
  deferCoordinatorOnboarding,
  dismissCoordinatorOnboardingIfOpen,
  ensureShellReady,
  getCoordinatorAgentId,
} from '../helpers/coordinator';
export type {
  SeededOrg,
  SeededAssistant,
  SeededTeam,
  SeededUserDesktop,
  SeededMsTeamsBotInstall,
} from '../helpers/seeds/types';

export { login, switchToEmailTab };

// =============================================================================
// Shared Auth — storageState
// =============================================================================

async function tryDevQuickLogin(page: Page, email: string): Promise<boolean> {
  const quickLoginButton = page
    .getByTestId('dev-quick-login')
    .getByRole('button', { name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
    .first();
  if (!(await quickLoginButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return false;
  }

  await quickLoginButton.scrollIntoViewIfNeeded();
  await quickLoginButton.click();
  await page.waitForTimeout(800);
  if (new URL(page.url()).pathname === '/login') {
    await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  }
  return new URL(page.url()).pathname !== '/login';
}

/**
 * Authenticate a seeded user.
 *
 * Prefers the pre-auth API (fast, works for users not yet listed in dev
 * quick-login). Falls back to the dev panel, then the email form.
 */
export async function authenticate(page: Page, email: string, password: string): Promise<void> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const loginPath = attempt === 1 ? '/login' : '/login?signout=true';
      await page.goto(loginPath, { timeout: 45_000, waitUntil: 'domcontentloaded' });
      if (attempt > 1) {
        await waitForLoginSurface(page, 30_000);
      }

      if (await loginWithPreAuthApi(page, email, password, 30_000)) return;

      await waitForLoginSurface(page, 15_000);
      if (await tryDevQuickLogin(page, email)) return;

      await loginAndWaitForRedirect(page, email, password, 30_000);
      if (new URL(page.url()).pathname !== '/login') return;
    } catch {
      /* navigation or login error — retry below */
    }
    if (attempt < maxAttempts) await page.waitForTimeout(1_500);
  }

  throw new Error(`Unable to authenticate test user ${email}`);
}

export async function loginAndSaveState(
  browser: Browser,
  email: string,
  password: string
): Promise<string> {
  const stateFile = path.join(
    os.tmpdir(),
    `pw-assistant-${email.replace(/[^a-z0-9]/gi, '-')}.json`
  );

  const ctx = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();

  await authenticate(page, email, password);

  await completeAccountOnboardingIfPresent(page);

  await page.close();
  await ctx.storageState({ path: stateFile });
  await ctx.close();
  return stateFile;
}

export async function loginAndSaveOrgState(
  browser: Browser,
  email: string,
  password: string,
  orgId: number
): Promise<string> {
  const stateFile = path.join(
    os.tmpdir(),
    `pw-assistant-org-${orgId}-${email.replace(/[^a-z0-9]/gi, '-')}.json`
  );

  const ctx = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();

  await authenticate(page, email, password);

  await completeAccountOnboardingIfPresent(page);

  await page.evaluate(async (workspaceId) => {
    await fetch('/api/session/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: String(workspaceId) }),
    });
  }, orgId);

  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await dismissCoordinatorOnboardingIfOpen(page);

  await page.close();
  await ctx.storageState({ path: stateFile });
  await ctx.close();
  return stateFile;
}

// =============================================================================
// Fixture: createAssistantTest
// =============================================================================

export function createAssistantTest(user: {
  id: string;
  email: string;
  password: string;
  apiKey: string;
}) {
  let authFile: string | undefined;

  return base.extend<{ authedPage: Page }>({
    authedPage: async ({ browser }, use, testInfo) => {
      if (!authFile) {
        testInfo.setTimeout(testInfo.timeout + 30_000);
        // A freshly provisioned Coordinator resolves to onboarding mode and
        // renders the full-screen intro overlay (``coordinator-onboarding``,
        // ``absolute inset-0 z-50``) that intercepts every pointer event. The
        // legacy two-pane assistant flows assume the standard shell, so defer
        // onboarding once up front before the first authenticated page loads.
        await deferCoordinatorForUser(user.id, user.apiKey);
        authFile = await loginAndSaveState(browser, user.email, user.password);
        const warmCtx = await browser.newContext({
          storageState: authFile,
          permissions: ['clipboard-read', 'clipboard-write'],
        });
        const warmPage = await warmCtx.newPage();
        await warmPage.goto('/assistants', { waitUntil: 'domcontentloaded' });
        await deferCoordinatorAfterAssistantsLoad(warmPage, user.id, user.apiKey);
        await dismissCoordinatorOnboardingIfOpen(warmPage);
        await waitForAssistantsRail(warmPage);
        await warmCtx.storageState({ path: authFile });
        await warmCtx.close();
      }
      const ctx = await browser.newContext({
        storageState: authFile,
        permissions: ['clipboard-read', 'clipboard-write'],
      });
      const page = await ctx.newPage();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      await use(page);
      await ctx.close();
    },
  });
}

// =============================================================================
// Navigation Helpers
// =============================================================================

/**
 * Navigate to the assistants page and wait for the page to settle.
 * Waits a beat after networkidle so React effects (auto-open dialog etc.) fire.
 */
export async function navigateToAssistants(
  page: Page,
  opts?: { skipRailCheck?: boolean; userId?: string; apiKey?: string }
) {
  // Suppress the post-hire onboarding wizard for every test that
  // doesn't explicitly opt into it. The wizard is an optional UX step
  // (the user can always skip it), and existing assistant flows assume
  // they land directly in the chat after hire — having the dialog pop
  // on top would force every legacy test to add a dismissal step.
  // Onboarding-specific tests can override by clearing the flag before
  // their hire flow.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
    } catch {
      /* private mode — ignore */
    }
  });
  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  if (opts?.userId && opts?.apiKey) {
    await deferCoordinatorAfterAssistantsLoad(page, opts.userId, opts.apiKey);
  } else {
    await dismissCoordinatorOnboardingIfOpen(page);
  }
  if (!opts?.skipRailCheck) {
    await waitForAssistantsRail(page);
  }
}

/**
 * Switch the active workspace via the session API.
 *
 * Uses `page.request` (context-scoped cookies + the configured baseURL) rather
 * than `page.evaluate(fetch(...))`: a relative fetch evaluated on an
 * `about:blank` page (e.g. a freshly opened authed context that hasn't
 * navigated yet) throws "Failed to parse URL". `page.request` resolves against
 * baseURL and shares the context cookie jar, so it works from any page state.
 * Navigate (or reload) afterwards to load the app in the selected workspace.
 */
export async function switchWorkspace(page: Page, workspaceId: string | number): Promise<void> {
  const res = await page.request.post('/api/session/workspace', {
    data: { workspaceId: String(workspaceId) },
  });
  if (!res.ok()) {
    throw new Error(`Failed to switch workspace to ${workspaceId}: ${res.status()}`);
  }
}

/**
 * The hire dialog title. Prefer this over a bare `[role="dialog"]` locator —
 * the unity switcher is a dialog too and may stay open underneath.
 */
export const HIRE_DIALOG_NAME = 'Onboard Teammate';

/** Locator for the hire dialog (not the unity switcher). */
export function hireDialog(page: Page) {
  return page.getByRole('dialog', { name: HIRE_DIALOG_NAME });
}

/**
 * Close the hire dialog if it's visible.
 * Uses Escape key as primary close mechanism (works with Radix Dialog).
 * Targets the hire dialog by name so an open unity switcher is ignored.
 */
export async function closeHireDialogIfOpen(page: Page) {
  const dialog = hireDialog(page);
  if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    // If still open (e.g. busy state prevented close), try the close button
    if (await dialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
      const closeBtn = dialog.getByRole('button', { name: /close/i }).first();
      if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }
}

/**
 * Open the rail's unity switcher page (which hosts the assistant list and
 * search). Idempotent — returns early if already open.
 */
export async function openUnitySwitcher(page: Page, opts?: { userId?: string; apiKey?: string }) {
  const picker = page.getByTestId('rail-unity-switcher-dialog');
  if (await picker.isVisible({ timeout: 500 }).catch(() => false)) return;
  if (opts?.userId && opts?.apiKey) {
    await ensureShellReady(page, opts.userId, opts.apiKey);
  } else {
    await dismissCoordinatorOnboardingIfOpen(page);
  }
  const switcher = railUnitySwitcher(page);
  await expect(switcher).toBeVisible({ timeout: 10_000 });
  await switcher.click();
  await expect(picker).toBeVisible({ timeout: 5_000 });
  await waitForAssistantListReady(page);
}

/** Dismiss the rail unity switcher page (Escape). No-op if already closed. */
export async function closeUnitySwitcher(page: Page) {
  const picker = page.getByTestId('rail-unity-switcher-dialog');
  if (await picker.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0, { timeout: 5_000 });
  }
}

/** Wait until the switcher's list finished loading assistants. */
export async function waitForAssistantListReady(page: Page, timeout = 45_000): Promise<void> {
  await expect
    .poll(
      async () => {
        const search = page.getByPlaceholder(/^Search\.\.\.$/i);
        if (await search.isEnabled().catch(() => false)) return 'ready';
        if ((await page.locator('[data-testid^="assistant-list-item-"]').count()) > 0) {
          return 'ready';
        }
        return 'pending';
      },
      { timeout }
    )
    .toBe('ready');
}

/**
 * Switch the active section via the rail's Workspace/Brain nav (replaces the
 * old in-pane `right-pane-tab-*` strip).
 */
export async function openRailSection(page: Page, sectionId: string) {
  await railSection(page, sectionId).click();
  await page.waitForTimeout(300);
}

/**
 * Open the hire dialog via the "Onboard" button in the unity switcher list.
 * In org workspaces the button lives under Org or Colleagues creation actions;
 * in personal workspaces it sits at the bottom of the assistant list. If the
 * dialog is already open (e.g. auto-opened on empty state), skip.
 */
export async function openHireDialog(page: Page, opts?: { userId?: string; apiKey?: string }) {
  const dialog = hireDialog(page);
  if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
    return;
  }
  await openUnitySwitcher(page, opts);
  const onboardBtn = page.getByTestId('assistant-onboard-button');
  if (!(await onboardBtn.isVisible({ timeout: 2_000 }).catch(() => false))) {
    const colleagues = page.getByTestId('assistant-list-section-people');
    if (await colleagues.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await colleagues.getByRole('button').first().click();
    }
  }
  await expect(onboardBtn).toBeEnabled({ timeout: 30_000 });
  await onboardBtn.click();
  // Switcher may remain open under the hire dialog; assert the hire dialog
  // specifically rather than any [role="dialog"].
  await expect(dialog).toBeVisible({ timeout: 10_000 });
}

/**
 * Select an assistant from the rail's unity switcher. Opens the switcher page
 * (where the list now lives), clicks the row, then dismisses the page so rail
 * navigation is clickable again.
 */
export async function selectAssistantInList(page: Page, agentId: number) {
  await openUnitySwitcher(page);
  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await closeUnitySwitcher(page);
}

// =============================================================================
// Hire Form Helpers
// =============================================================================

/**
 * Open a specific accordion section in the hire/edit form.
 * Tries aria-label first, then falls back to text content match.
 */
export async function openAccordionSection(
  page: Page,
  section: 'profile' | 'photo' | 'voice' | 'advanced'
) {
  const labels: Record<string, string> = {
    profile: 'Profile',
    photo: 'Photo',
    voice: 'Voice',
    advanced: 'Advanced',
  };

  // Try aria-label trigger first (hire/edit forms use these)
  let trigger = page.locator(`[aria-label="${section} trigger"]`);
  if (!(await trigger.isVisible({ timeout: 1_000 }).catch(() => false))) {
    const formRoot = page
      .getByRole('dialog')
      .filter({ has: page.getByText(/Hire|Edit|Profile|Photo|Voice/) })
      .last();
    // Fall back to an exact section heading inside the form so shell buttons
    // like the account/workspace trigger are never treated as accordion rows.
    trigger = formRoot
      .locator('button[data-state]')
      .filter({ has: page.getByRole('heading', { name: labels[section], exact: true }) })
      .first();
  }
  if (!(await trigger.isVisible({ timeout: 1_000 }).catch(() => false))) {
    return;
  }

  const state = await trigger.getAttribute('data-state').catch(() => null);
  if (state !== 'open') {
    await trigger.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Fill a controlled input and confirm the value held.
 *
 * The hire form can re-apply a randomized profile asynchronously, so a single
 * fill may be overwritten. Re-fill until the value sticks (or attempts run out).
 */
async function fillStable(locator: ReturnType<Page['locator']>, value: string, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    await locator.fill(value);
    await locator.page().waitForTimeout(400);
    if ((await locator.inputValue().catch(() => '')) === value) return;
  }
  await locator.fill(value);
}

/**
 * Fill the basic profile fields in the hire form.
 */
export async function fillProfileFields(
  page: Page,
  opts: {
    firstName: string;
    lastName: string;
    /** Optional free-text job title / specialization. Pass `''` to explicitly clear. */
    jobTitle?: string;
    about?: string;
  }
) {
  await openAccordionSection(page, 'profile');

  // The hire form auto-applies a randomized unity profile once presets load
  // (name/role/about), and that effect can land — sometimes more than once —
  // *after* the dialog first renders. A programmatic fill doesn't set the
  // "user changed preset" flag, so an early fill gets clobbered by the late
  // randomize. Wait for the auto-randomized name to settle, then fill with a
  // short retry so the value sticks once the randomize effect quiesces.
  const firstNameInput = page.locator('#firstName');
  await expect(firstNameInput)
    .not.toHaveValue('', { timeout: 15_000 })
    .catch(() => {});
  await fillStable(firstNameInput, opts.firstName);

  const surnameInput = page.locator('#surname');
  await fillStable(surnameInput, opts.lastName);

  if (opts.jobTitle !== undefined) {
    const jobTitleInput = page.locator('#jobTitle');
    await jobTitleInput.fill(opts.jobTitle);
  }

  if (opts.about) {
    const aboutInput = page.locator('#about');
    await aboutInput.fill(opts.about);
  }
}

/**
 * Select a voice from the voice list in the hire form.
 * The first voice is auto-selected by default; this explicitly clicks one.
 */
export async function selectVoice(page: Page, voiceNameSubstring?: string) {
  await expect(page.getByRole('heading', { name: 'Onboard Teammate' })).toBeVisible({
    timeout: 10_000,
  });
  await openAccordionSection(page, 'voice');

  const voiceOption = voiceNameSubstring
    ? page.getByRole('option', { name: new RegExp(voiceNameSubstring, 'i') }).first()
    : page.getByRole('option').first();
  await expect(voiceOption).toBeVisible({ timeout: 15_000 });
  await voiceOption.click();
  await page.waitForTimeout(300);
}

/**
 * Ensure the workspace step won't block submit.
 *
 * When a workspace OAuth client is configured on the deployment, the hire flow
 * requires either selecting a provider or ticking "Skip" before it will submit
 * (otherwise it surfaces a warning and returns). Connecting a provider triggers
 * real OAuth, so tests tick Skip. When no provider is configured the checkbox is
 * disabled and pre-checked, so this is a no-op.
 */
export async function skipWorkspaceSetupIfPrompted(page: Page) {
  const skip = page.locator('label:has-text("Skip") [role="checkbox"]').first();
  if (!(await skip.isVisible({ timeout: 1_000 }).catch(() => false))) return;
  if (await skip.isDisabled().catch(() => true)) return;
  if ((await skip.getAttribute('data-state').catch(() => null)) === 'checked') return;
  await skip.click();
  await page.waitForTimeout(200);
}

/**
 * Click the "Onboard Teammate" button in the hire dialog.
 * Scrolls the button into view first since the dialog content may be tall, and
 * ticks the workspace "Skip" first so the flow isn't blocked on workspace setup.
 */
export async function clickHireButton(page: Page) {
  await skipWorkspaceSetupIfPrompted(page);
  const hireBtn = page.getByRole('button', { name: 'Onboard Teammate', exact: true });
  await expect(hireBtn).toBeVisible({ timeout: 10_000 });
  await expect(hireBtn).toBeEnabled({ timeout: 10_000 });
  await hireBtn.click();
}

/** Open the assistant info side panel from the top navbar. */
export async function openAssistantInfoPanel(page: Page) {
  const btn = page.getByTestId('assistant-info-button');
  await expect(btn).toBeVisible({ timeout: 20_000 });
  await btn.click();
}

/** Open the assistant info side panel from a list row's unfold control. */
export async function openAssistantInfoToggleFromList(page: Page, agentId: number | string) {
  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await listItem.click();
  // Picking a teammate that was not already current dismisses the picker, and
  // the info toggle only renders on the selected row — reopen to reach it.
  await openUnitySwitcher(page);
  const toggle = page.getByTestId(`assistant-info-toggle-${agentId}`);
  await expect(toggle).toBeVisible({ timeout: 5_000 });
  // Selecting the row can already have opened the panel, so drive the control
  // to "showing" rather than toggling it blindly back shut.
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') {
    await toggle.click();
  }
  // Showing the panel dismisses the picker on its own; when the panel was
  // already up there was nothing to dismiss, and the picker's page would sit
  // over the panel this helper exists to hand back.
  await closeUnitySwitcher(page);
}

export async function openAssistantInfoPanelFromList(page: Page, agentId: number | string) {
  await openAssistantInfoToggleFromList(page, agentId);
  await expect(page.getByTestId('assistant-info-sheet')).toBeVisible({ timeout: 10_000 });
}

/** Select the info panel's Profile tab; the panel can land on Onboarding instead. */
export async function openAssistantInfoProfileTab(page: Page) {
  const profileTab = page.getByRole('tab', { name: 'Profile' });
  if (await profileTab.isVisible().catch(() => false)) {
    await profileTab.click();
  }
}

/** Open the edit dialog from a list row via the info panel Profile section edit control. */
export async function openEditDialogFromList(page: Page, agentId: number | string) {
  await openAssistantInfoPanelFromList(page, agentId);
  await openAssistantInfoProfileTab(page);
  await page.getByTestId('assistant-info-edit-profile-section').click();
  await expect(page.locator('[role="dialog"]').filter({ hasText: /^Edit / })).toBeVisible({
    timeout: 10_000,
  });
}

export async function openContactManagerFromList(page: Page, agentId: number | string) {
  await openAssistantInfoPanelFromList(page, agentId);
  await openAssistantInfoProfileTab(page);
  await page.getByTestId('assistant-info-edit-contact-section').click();
  await expect(page.locator('text=Update Contact')).toBeVisible({ timeout: 5_000 });
}

export async function openWorkspaceManagerFromList(page: Page, agentId: number | string) {
  await openAssistantInfoPanelFromList(page, agentId);
  await openAssistantInfoProfileTab(page);
  await page.getByTestId('assistant-info-edit-workspace-section').click();
  await expect(page.getByRole('dialog').getByText('Workspace', { exact: true })).toBeVisible({
    timeout: 5_000,
  });
}

export async function openDesktopLinkerFromList(page: Page, agentId: number | string) {
  await openAssistantInfoPanelFromList(page, agentId);
  await openAssistantInfoProfileTab(page);
  await page.getByTestId('assistant-info-edit-desktop-section').click();
  await expect(page.getByRole('dialog')).toContainText('Link User Desktop', { timeout: 5_000 });
}

// =============================================================================
// DB Query Helpers
// =============================================================================

import { dbExec } from '../helpers/seeds/client';

export function getAssistantFromDb(agentId: number) {
  const row = dbExec(
    `SELECT first_name, surname, voice_id, voice_provider, profile_photo, age, nationality, timezone, about, organization_id, COALESCE(job_title, ''), COALESCE(desktop_mode, ''), COALESCE(managed_desktop_status, '') FROM assistants WHERE agent_id = ${agentId}`
  );
  const [
    firstName,
    surname,
    voiceId,
    voiceProvider,
    profilePhoto,
    age,
    nationality,
    timezone,
    about,
    organizationId,
    jobTitleRaw,
    desktopModeRaw,
    managedDesktopStatusRaw,
  ] = row.split('|');
  return {
    firstName,
    surname,
    voiceId,
    voiceProvider,
    profilePhoto,
    age,
    nationality,
    timezone,
    about,
    organizationId,
    // Empty string sentinel means NULL in the database (we COALESCE so the
    // pipe-split yields a stable column count). Map back to null so tests can
    // explicitly assert "cleared" vs "set" without worrying about psql output.
    jobTitle: jobTitleRaw === '' ? null : jobTitleRaw,
    desktopMode: desktopModeRaw === '' ? null : desktopModeRaw,
    managedDesktopStatus: managedDesktopStatusRaw === '' ? null : managedDesktopStatusRaw,
  };
}

export function getAssistantCount(userId: string): number {
  return parseInt(dbExec(`SELECT count(*) FROM assistants WHERE user_id = '${userId}'`), 10);
}

/**
 * Agent IDs of a user's regular (non-coordinator) assistants.
 *
 * Every user has an always-present personal Coordinator that the app
 * auto-provisions; it carries the lowest `agent_id` and is not a hireable
 * assistant. Excluding it keeps `agentIds[0]` pointed at the assistants a test
 * actually created/hired and keeps {@link deleteAllAssistantsForUser} from
 * deleting the Coordinator (which the app would just recreate).
 */
export function getAssistantAgentIds(userId: string): number[] {
  const result = dbExec(
    `SELECT agent_id FROM assistants WHERE user_id = '${userId}' AND is_coordinator IS NOT TRUE ORDER BY agent_id`
  );
  if (!result) return [];
  return result.split('\n').map((id) => parseInt(id, 10));
}

export function deleteAssistantFromDb(agentId: number): void {
  dbExec(`DELETE FROM assistant_contacts WHERE assistant_id = ${agentId}`);
  dbExec(`DELETE FROM assistants WHERE agent_id = ${agentId}`);
}

export function deleteAllAssistantsForUser(userId: string): void {
  const ids = getAssistantAgentIds(userId);
  ids.forEach((id) => {
    try {
      deleteAssistantFromDb(id);
    } catch {
      /* best effort */
    }
  });
}

export function assistantExistsInDb(agentId: number): boolean {
  try {
    const result = dbExec(`SELECT count(*) FROM assistants WHERE agent_id = ${agentId}`);
    return parseInt(result, 10) > 0;
  } catch {
    return false;
  }
}

export function setUserPhoneNumber(userId: string, phone: string): void {
  dbExec(`UPDATE "user" SET phone_number = '${phone}' WHERE id = '${userId}'`);
}

export function clearUserPhoneNumber(userId: string): void {
  dbExec(`UPDATE "user" SET phone_number = NULL WHERE id = '${userId}'`);
}

export function setUserWhatsappNumber(userId: string, whatsapp: string): void {
  dbExec(`UPDATE "user" SET whatsapp_number = '${whatsapp}' WHERE id = '${userId}'`);
}

export function clearUserWhatsappNumber(userId: string): void {
  dbExec(`UPDATE "user" SET whatsapp_number = NULL WHERE id = '${userId}'`);
}

export function getAssistantContact(
  agentId: number,
  contactType: 'email' | 'phone' | 'whatsapp' | 'discord'
): string | null {
  try {
    const result = dbExec(
      `SELECT contact_value FROM assistant_contacts WHERE assistant_id = ${agentId} AND contact_type = '${contactType}' AND status = 'active'`
    );
    return result || null;
  } catch {
    return null;
  }
}

export function getAssistantContactProvider(
  agentId: number,
  contactType: 'email' | 'phone' | 'whatsapp' | 'discord'
): string | null {
  try {
    const result = dbExec(
      `SELECT provider FROM assistant_contacts WHERE assistant_id = ${agentId} AND contact_type = '${contactType}' AND status = 'active'`
    );
    return result || null;
  } catch {
    return null;
  }
}

export function getAssistantContactProvisionedBy(
  agentId: number,
  contactType: 'email' | 'phone' | 'whatsapp' | 'discord'
): string | null {
  try {
    const result = dbExec(
      `SELECT provisioned_by FROM assistant_contacts WHERE assistant_id = ${agentId} AND contact_type = '${contactType}' AND status = 'active'`
    );
    return result || null;
  } catch {
    return null;
  }
}

// =============================================================================
// User Desktop Link Helpers
// =============================================================================

/** Desktop ids linked to an assistant for a given owner (usually 0 or 1). */
export function getLinkedDesktopIds(agentId: number, ownerUserId: string): number[] {
  const result = dbExec(
    `SELECT user_desktop_id FROM assistant_user_desktops WHERE assistant_id = ${agentId} AND owner_user_id = '${ownerUserId}' ORDER BY user_desktop_id`
  );
  if (!result) return [];
  return result.split('\n').map((id) => parseInt(id, 10));
}

/** Count of assistants a desktop is linked to (across the owner's assistants). */
export function getDesktopLinkCount(desktopId: number): number {
  return parseInt(
    dbExec(`SELECT count(*) FROM assistant_user_desktops WHERE user_desktop_id = ${desktopId}`),
    10
  );
}

/**
 * The filesystem-access state of a single (assistant, desktop) link row.
 *
 * `filesysSync` is the user's standing consent flag; `hasKey` reflects whether
 * Orchestra has minted the per-link SFTP private key. The two move together —
 * enabling consent mints the key, disabling clears it — so the e2e asserts both
 * to prove the toggle drove the full server-side reconciliation, not just the
 * boolean.
 */
export function getLinkFilesysState(
  agentId: number,
  desktopId: number
): { filesysSync: boolean; hasKey: boolean } {
  const result = dbExec(
    `SELECT filesys_sync, (filesync_sshkey IS NOT NULL) FROM assistant_user_desktops WHERE assistant_id = ${agentId} AND user_desktop_id = ${desktopId}`
  );
  const [sync, key] = result.split('|');
  return { filesysSync: sync === 't', hasKey: key === 't' };
}

export function deleteUserDesktopsForUser(userId: string): void {
  try {
    dbExec(`DELETE FROM user_desktops WHERE user_id = '${userId}'`);
  } catch {
    /* best effort — cascade also removes assistant_user_desktops */
  }
}

/** Whether a registered desktop row still exists. */
export function userDesktopExists(desktopId: number): boolean {
  return parseInt(dbExec(`SELECT count(*) FROM user_desktops WHERE id = ${desktopId}`), 10) > 0;
}

/**
 * Record the relay id of a desktop's raw-TCP SFTP tunnel, mirroring the device
 * agent's `POST /v0/desktop/{id}/sftp-tunnel`. Lets a delete test assert that a
 * desktop carrying an SFTP tunnel id tears down cleanly through the UI.
 */
export function setDesktopSftpTunnelId(desktopId: number, tunnelId: string): void {
  dbExec(`UPDATE user_desktops SET sftp_tunnel_id = '${tunnelId}' WHERE id = ${desktopId}`);
}

/** The relay id of a desktop's SFTP tunnel, or null if unset / gone. */
export function getDesktopSftpTunnelId(desktopId: number): string | null {
  const result = dbExec(`SELECT sftp_tunnel_id FROM user_desktops WHERE id = ${desktopId}`);
  return result ? result.trim() : null;
}

/** The friendly name of a registered desktop, or null if it no longer exists. */
export function getUserDesktopName(desktopId: number): string | null {
  const result = dbExec(`SELECT name FROM user_desktops WHERE id = ${desktopId}`);
  return result ? result.trim() : null;
}

// =============================================================================
// Assistant Secret Helpers
// =============================================================================

/**
 * Names of the secrets persisted for an assistant, read back through
 * Orchestra's logs API (the same store the Console secrets UI writes to).
 * Secrets live as logs in the "Assistants" project under the per-assistant
 * `{userId}/{assistantId}/Secrets` context.
 */
export async function getAssistantSecretNames(
  apiKey: string,
  userId: string,
  assistantId: number
): Promise<string[]> {
  const context = `${userId}/${assistantId}/Secrets`;
  const params = new URLSearchParams({ project_name: 'Assistants', context });
  const res = await _orchestraFetch(`/v0/logs?${params.toString()}`, { method: 'GET' }, apiKey);
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const logs = (data?.logs ?? []) as Array<{ entries?: { name?: string } }>;
  return logs.map((log) => log.entries?.name).filter((name): name is string => Boolean(name));
}
