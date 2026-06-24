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
import { login, loginAndWaitForRedirect, switchToEmailTab } from '../auth/helpers';
import { orchestraFetch as _orchestraFetch } from '../helpers/seeds/client';

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
} from '../helpers/seeds/client';
export type {
  SeededOrg,
  SeededAssistant,
  SeededTeam,
  SeededUserDesktop,
} from '../helpers/seeds/types';

export { login, switchToEmailTab };

// =============================================================================
// Shared Auth — storageState
// =============================================================================

/**
 * Authenticate a seeded user via the dev quick-login panel.
 *
 * The local dev login page defaults to the OAuth tab (Google is configured),
 * so the password form is one tab-switch away and racier than the dev panel.
 * The dev panel mints a session with a single click, so it is the primary path;
 * we avoid `waitForURL` (which hangs the full timeout on any redirect race) and
 * force-navigate to `/assistants` instead, then confirm we left `/login`.
 */
async function tryDevQuickLogin(page: Page, email: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
    }
    const quickLoginButton = page
      .getByTestId('dev-quick-login')
      .locator('button', { hasText: email })
      .first();
    if (!(await quickLoginButton.isVisible({ timeout: 10_000 }).catch(() => false))) continue;

    await quickLoginButton.click();
    await page.waitForTimeout(800);
    if (new URL(page.url()).pathname === '/login') {
      await page.goto('/assistants');
      await page.waitForLoadState('domcontentloaded');
    }
    if (new URL(page.url()).pathname !== '/login') return true;
  }
  return false;
}

/**
 * Authenticate a seeded user.
 *
 * Email+password is the primary path: it is deterministic and does not depend
 * on the dev quick-login panel (which queries Postgres for every `seed-%` user
 * and can be slow). The credentials submit occasionally bounces back to
 * `/login` locally, so we fall back to the dev panel. Throws if neither path
 * leaves `/login`.
 */
export async function authenticate(page: Page, email: string, password: string): Promise<void> {
  // The dev server compiles routes on first hit and the seed-user lookup can be
  // slow under load, so a cold first attempt occasionally times out or bounces
  // back to /login. Retry the whole goto+login flow a few times with a bounded
  // navigation timeout so a single cold start doesn't fail the run.
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.goto('/login', { timeout: 45_000 });
      try {
        await loginAndWaitForRedirect(page, email, password, 30_000);
      } catch {
        /* fall back to the dev quick-login panel below */
      }
      if (new URL(page.url()).pathname !== '/login') return;
      if (await tryDevQuickLogin(page, email)) return;
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

  if (page.url().includes('/login/onboarding')) {
    const personalBtn = page.getByTestId('workspace-personal');
    if (await personalBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await personalBtn.click();
      await page.getByTestId('workspace-continue').click();
      await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 15_000,
      });
    } else {
      await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 15_000,
      });
    }
  }

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

  if (page.url().includes('/login/onboarding')) {
    await page
      .waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 20_000,
      })
      .catch(async () => {
        const personalBtn = page.getByTestId('workspace-personal');
        if (await personalBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await personalBtn.click();
          await page.getByTestId('workspace-continue').click();
          await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
            timeout: 15_000,
          });
        }
      });
  }

  await page.evaluate(async (workspaceId) => {
    await fetch('/api/session/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: String(workspaceId) }),
    });
  }, orgId);

  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);

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
        const coordinatorId = getCoordinatorAgentId(user.id);
        if (coordinatorId) {
          await deferCoordinatorOnboarding(user.apiKey, coordinatorId);
        }
        authFile = await loginAndSaveState(browser, user.email, user.password);
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
export async function navigateToAssistants(page: Page) {
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
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
}

/**
 * Close the auto-opened hire dialog if it's visible.
 * Uses Escape key as primary close mechanism (works with Radix Dialog).
 */
export async function closeHireDialogIfOpen(page: Page) {
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    // If still open (e.g. busy state prevented close), try the close button
    if (await dialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
      const closeBtn = page.getByRole('button', { name: /close/i }).first();
      if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }
}

/**
 * Open the rail's droid switcher popover (which hosts the assistant list,
 * search and the Onboard button). Idempotent — returns early if already open.
 */
export async function openDroidSwitcher(page: Page) {
  const popover = page.getByTestId('rail-droid-switcher-popover');
  if (await popover.isVisible({ timeout: 500 }).catch(() => false)) return;
  await page.getByTestId('rail-droid-switcher').click();
  await expect(popover).toBeVisible({ timeout: 5_000 });
}

/**
 * Switch the active section via the rail's Workspace/Brain nav (replaces the
 * old in-pane `right-pane-tab-*` strip).
 */
export async function openRailSection(page: Page, sectionId: string) {
  await page.getByTestId(`rail-section-${sectionId}`).click();
  await page.waitForTimeout(300);
}

/**
 * Open the hire dialog via the "Onboard" button, which now lives inside the
 * rail's droid switcher popover. If the dialog is already open (e.g.
 * auto-opened on empty state), skip.
 */
export async function openHireDialog(page: Page) {
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
    return;
  }
  await openDroidSwitcher(page);
  const onboardBtn = page.getByTestId('assistant-onboard-button');
  await expect(onboardBtn).toBeEnabled({ timeout: 15_000 });
  await onboardBtn.click();
  await page.waitForTimeout(1_000);
}

/**
 * Select an assistant from the rail's droid switcher. Opens the switcher
 * popover (where the list now lives), clicks the row, and lets the popover
 * dismiss — leaving the chosen droid active in the section host.
 */
export async function selectAssistantInList(page: Page, agentId: number) {
  await openDroidSwitcher(page);
  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await listItem.click();
  await page.waitForTimeout(500);
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
    // Fall back to accordion trigger containing the section text
    trigger = page.locator(`button[data-state]:has-text("${labels[section]}")`).first();
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

  // The hire form auto-applies a randomized droid profile once presets load
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
  await openAccordionSection(page, 'voice');
  await page.waitForTimeout(1_000);

  if (voiceNameSubstring) {
    const voiceOption = page
      .getByRole('option', { name: new RegExp(voiceNameSubstring, 'i') })
      .first();
    await voiceOption.scrollIntoViewIfNeeded();
    await voiceOption.click();
  } else {
    const firstVoice = page.getByRole('option').first();
    await firstVoice.scrollIntoViewIfNeeded();
    await firstVoice.click();
  }
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
 * Click the "Onboard Droid" button in the hire dialog.
 * Scrolls the button into view first since the dialog content may be tall, and
 * ticks the workspace "Skip" first so the flow isn't blocked on workspace setup.
 */
export async function clickHireButton(page: Page) {
  await skipWorkspaceSetupIfPrompted(page);
  const hireBtn = page.getByRole('button', { name: 'Onboard Droid', exact: true });
  await hireBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await hireBtn.click();
}

// =============================================================================
// Contact Manager Helpers
// =============================================================================

/**
 * Open the contact manager for an assistant via the hover card "Add Email" or "Add Phone" link.
 * Requires the assistant list item to be visible.
 */
export async function openContactManagerFromList(
  page: Page,
  agentId: number,
  tab: 'email' | 'phone' | 'whatsapp' | 'discord'
) {
  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await listItem.hover();
  await page.waitForTimeout(500);

  const labelMap = {
    email: 'Add Email',
    phone: 'Add Phone',
    whatsapp: 'Add WhatsApp',
    discord: 'Add Discord',
  };
  const label = labelMap[tab];
  await page.getByRole('button', { name: label }).click();
  await page.waitForTimeout(500);
}

// =============================================================================
// DB Query Helpers
// =============================================================================

import { dbExec } from '../helpers/seeds/client';

export function getAssistantFromDb(agentId: number) {
  const row = dbExec(
    `SELECT first_name, surname, voice_id, voice_provider, profile_photo, age, nationality, timezone, about, organization_id, COALESCE(job_title, '') FROM assistants WHERE agent_id = ${agentId}`
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

/** Agent ID of a user's personal (non-org) Coordinator, or null if none. */
export function getCoordinatorAgentId(userId: string): number | null {
  const result = dbExec(
    `SELECT agent_id FROM assistants WHERE user_id = '${userId}' AND is_coordinator = TRUE AND organization_id IS NULL ORDER BY agent_id LIMIT 1`
  );
  const parsed = parseInt(result, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Dismiss the Coordinator onboarding gate for a workspace.
 *
 * A freshly provisioned Coordinator resolves to ``mode: onboarding`` with
 * ``intro_watched: false``, so the assistants page renders the full-screen
 * onboarding intro overlay (``data-testid="coordinator-onboarding"``,
 * ``absolute inset-0 z-50``) that intercepts every pointer event. Legacy
 * assistant flows (list, chat, profile, hire, …) assume the standard shell,
 * so they defer onboarding up front. Setting ``onboarding_deferred`` clears
 * both the intro overlay and the coordinator focus layout in one shot,
 * leaving the regular two-pane list. Idempotent and one-way sticky for
 * ``intro_watched`` server-side.
 */
export async function deferCoordinatorOnboarding(
  apiKey: string,
  coordinatorId: number
): Promise<void> {
  const res = await _orchestraFetch(
    `/v0/assistant/${coordinatorId}/state`,
    {
      method: 'PATCH',
      body: JSON.stringify({ intro_watched: true, onboarding_deferred: true }),
    },
    apiKey
  );
  if (!res.ok) {
    throw new Error(`Failed to defer coordinator onboarding: ${res.status}`);
  }
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
