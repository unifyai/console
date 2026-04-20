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
  ensureVoicePreset,
  ensureProjectSync,
} from '../helpers/seeds/client';
export type { SeededOrg, SeededAssistant } from '../helpers/seeds/types';

export { login, switchToEmailTab };

// =============================================================================
// Shared Auth — storageState
// =============================================================================

export async function loginAndSaveState(
  browser: Browser,
  email: string,
  password: string
): Promise<string> {
  const stateFile = path.join(
    os.tmpdir(),
    `pw-assistant-${email.replace(/[^a-z0-9]/gi, '-')}.json`
  );

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 45_000);

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
      const ctx = await browser.newContext({ storageState: authFile });
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
