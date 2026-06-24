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

async function loginViaDevQuickLogin(page: Page, email: string, timeout: number): Promise<void> {
  const quickLoginPanel = page.getByTestId('dev-quick-login');
  await expect(quickLoginPanel).toBeVisible({ timeout: 15_000 });

  const quickLoginButton = quickLoginPanel.locator('button', { hasText: email }).first();
  await expect(quickLoginButton).toBeVisible({ timeout: 15_000 });

  await Promise.all([
    page.waitForURL((url) => url.pathname !== '/login', {
      timeout,
      waitUntil: 'domcontentloaded',
    }),
    quickLoginButton.click(),
  ]);
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

  await page.goto('/login?signout=true');
  await page
    .waitForURL((url) => url.pathname === '/login' && !url.searchParams.has('signout'), {
      timeout: 15_000,
      waitUntil: 'domcontentloaded',
    })
    .catch(() => {});

  try {
    await loginAndWaitForRedirect(page, email, password, 45_000);
  } catch (error) {
    if (!page.url().includes('/login')) {
      // A pre-existing local auth session can redirect /login straight into
      // the app before the email-login controls render. That is already the
      // desired authenticated state for these fixtures.
    } else {
      const hasQuickLoginPanel = await page
        .getByTestId('dev-quick-login')
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (!hasQuickLoginPanel) {
        throw error;
      }
      // Local dev login occasionally lands back on /login after credentials submit.
      // Retry once via the dev quick-login panel to keep assistant e2e fixtures stable.
      await page.goto('/login');
      await loginViaDevQuickLogin(page, email, 45_000);
    }
  }

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

  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 45_000);

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

export function createAssistantTest(user: { email: string; password: string }) {
  let authFile: string | undefined;

  return base.extend<{ authedPage: Page }>({
    authedPage: async ({ browser }, use, testInfo) => {
      if (!authFile) {
        testInfo.setTimeout(testInfo.timeout + 30_000);
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
 * Open the hire dialog via the "New" button in the assistant list.
 * If the dialog is already open (e.g. auto-opened on empty state), skip clicking.
 */
export async function openHireDialog(page: Page) {
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
    return;
  }
  const newBtn = page.locator('button:has-text("New")');
  await expect(newBtn).toBeEnabled({ timeout: 15_000 });
  await newBtn.click();
  await page.waitForTimeout(1_000);
}

/**
 * Click on an assistant in the list to select it and show its details
 * in the right pane (Chat tab by default).
 */
export async function selectAssistantInList(page: Page, agentId: number) {
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
 * Fill the basic profile fields in the hire form.
 */
export async function fillProfileFields(
  page: Page,
  opts: {
    firstName: string;
    lastName: string;
    /** Optional free-text job title / specialization. Pass `''` to explicitly clear. */
    jobTitle?: string;
    age?: number;
    nationality?: string;
    about?: string;
  }
) {
  await openAccordionSection(page, 'profile');

  const firstNameInput = page.locator('#firstName');
  await firstNameInput.fill(opts.firstName);

  const surnameInput = page.locator('#surname');
  await surnameInput.fill(opts.lastName);

  if (opts.jobTitle !== undefined) {
    const jobTitleInput = page.locator('#jobTitle');
    await jobTitleInput.fill(opts.jobTitle);
  }

  if (opts.age) {
    const ageInput = page.locator('#age');
    await ageInput.fill(String(opts.age));
  }

  if (opts.nationality) {
    const nationalityTrigger = page.locator('#nationality');
    await nationalityTrigger.click();
    await page.locator(`[role="option"]:has-text("${opts.nationality}")`).click();
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
 * Click the "Hire Assistant" button in the hire dialog.
 * Scrolls the button into view first since the dialog content may be tall.
 */
export async function clickHireButton(page: Page) {
  const hireBtn = page.getByRole('button', { name: 'Hire Assistant' });
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

export function getAssistantAgentIds(userId: string): number[] {
  const result = dbExec(
    `SELECT agent_id FROM assistants WHERE user_id = '${userId}' ORDER BY agent_id`
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
