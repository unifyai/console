/**
 * Permissions E2E Tests — browser-based tests for assistant permission
 * enforcement in an organization context.
 *
 * Verifies:
 *  - Org Owner can see the "New" hire button
 *  - Org Member cannot see the "New" hire button
 *  - Org Owner can open the edit dialog via the info panel and see "End contract"
 *  - Org Member cannot open the edit dialog on another member's assistant
 *  - Org Member CAN view secrets but CANNOT add/delete them on another's assistant
 *  - Org Member CAN see and edit their own assistant in the org
 *
 * Setup:
 *  - Creates an org with an Owner and a Member
 *  - Owner creates an assistant in the org
 *  - Tests run as both Owner and Member to verify permission boundaries
 *
 * Run: npx playwright test src/tests/assistants/permissions.e2e.ts
 */

import { test as base, expect, type Page, type Browser, type Locator } from '@playwright/test';
import path from 'path';
import os from 'os';
import {
  createOrg,
  addMember,
  createAssistant,
  deleteOrg,
  ensureProjectSync,
  dbExec,
} from '../helpers/seeds/client';
import { createTestUser, cleanupUser } from '../helpers/e2e-helpers';
import { loginAndWaitForRedirect, completeAccountOnboardingIfPresent } from '../auth/helpers';
import {
  deferCoordinatorForUser,
  deferCoordinatorAfterAssistantsLoad,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';
import { assistantRail, openAssistantCreateMenu } from '../helpers/shell';
import {
  navigateToAssistants,
  openUnitySwitcher,
  openRailSection,
  closeHireDialogIfOpen,
  openEditDialogFromList,
  openAssistantInfoPanelFromList,
} from './helpers';

// =============================================================================
// Test Users & Org Setup
// =============================================================================

const owner = createTestUser({ name: 'PermOwner', lastName: 'E2E', credits: 50_000 });
const member = createTestUser({ name: 'PermMember', lastName: 'E2E', credits: 50_000 });

const org = createOrg({ name: `PermTestOrg_${Date.now()}`, ownerId: owner.id });
const memberOrgKey = addMember({ orgId: org.id, userId: member.id, role: 'Member' });

ensureProjectSync(org.ownerOrgApiKey);

const ownerAssistant = createAssistant({
  userId: owner.id,
  orgId: org.id,
  firstName: 'OwnerBot',
  surname: 'Perm',
});

// =============================================================================
// Custom Login Helpers — login and switch to org workspace
// =============================================================================

async function loginAndSaveOrgState(
  browser: Browser,
  email: string,
  password: string,
  orgId: number
): Promise<string> {
  const stateFile = path.join(os.tmpdir(), `pw-perm-${email.replace(/[^a-z0-9]/gi, '-')}.json`);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 45_000);

  await deferCoordinatorForUser(
    email === owner.email ? owner.id : member.id,
    email === owner.email ? owner.apiKey : member.apiKey
  );

  // Handle onboarding
  await completeAccountOnboardingIfPresent(page);

  // Switch to the org workspace
  await page.request.post('/api/session/workspace', {
    data: { workspaceId: String(orgId) },
  });
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
      window.localStorage.setItem('referral-banner-dismissed', '1');
    } catch {
      /* private mode — ignore */
    }
  });
  await page.goto('/assistants', { waitUntil: 'domcontentloaded' });
  const userId = email === owner.email ? owner.id : member.id;
  const apiKey = email === owner.email ? owner.apiKey : member.apiKey;
  await deferCoordinatorAfterAssistantsLoad(page, userId, apiKey);
  await dismissCoordinatorOnboardingIfOpen(page);
  await expect(assistantRail(page)).toBeVisible({ timeout: 20_000 });

  await ctx.storageState({ path: stateFile });
  await ctx.close();
  return stateFile;
}

// =============================================================================
// Fixtures
// =============================================================================

let ownerAuthFile: string | undefined;
let memberAuthFile: string | undefined;

const test = base.extend<{ ownerPage: Page; memberPage: Page }>({
  ownerPage: async ({ browser }, use, testInfo) => {
    if (!ownerAuthFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      ownerAuthFile = await loginAndSaveOrgState(browser, owner.email, owner.password, org.id);
    }
    const ctx = await browser.newContext({ storageState: ownerAuthFile });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
  memberPage: async ({ browser }, use, testInfo) => {
    if (!memberAuthFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      memberAuthFile = await loginAndSaveOrgState(browser, member.email, member.password, org.id);
    }
    const ctx = await browser.newContext({ storageState: memberAuthFile });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
});

test.setTimeout(90_000);

test.afterAll(() => {
  try {
    dbExec(`DELETE FROM assistant_contacts WHERE assistant_id = ${ownerAssistant.agentId}`);
  } catch {
    /* */
  }
  try {
    dbExec(`DELETE FROM assistants WHERE agent_id = ${ownerAssistant.agentId}`);
  } catch {
    /* */
  }
  try {
    deleteOrg(org.id);
  } catch {
    /* */
  }
  cleanupUser(owner.id);
  cleanupUser(member.id);
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Open the edit dialog from a list row via the info panel.
 */
async function openEditViaInfoPanel(page: Page, agentId: number): Promise<Locator> {
  await openUnitySwitcher(page);
  await openEditDialogFromList(page, agentId);
  const editDialog = page.getByRole('dialog', { name: /^Edit / });
  await expect(editDialog).toBeVisible({ timeout: 10_000 });
  return editDialog;
}

/**
 * Navigate to an assistant's profile and open the Secrets tab in the right-hand pane.
 */
async function openSecretsTab(page: Page, agentId: number) {
  await page.goto(`/assistants?profile=${agentId}`);
  await closeHireDialogIfOpen(page);

  await openRailSection(page, 'integrations');

  await expect(page.getByTestId('integrations-pane')).toBeVisible({ timeout: 10_000 });
}

// =============================================================================
// Tests — Owner Permissions (baseline: everything visible)
// =============================================================================

test('owner can see the "New" hire button in the assistant list', async ({ ownerPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  await openAssistantCreateMenu(page);

  const newBtn = page.getByTestId('assistant-onboard-button');
  await expect(newBtn).toBeVisible({ timeout: 15_000 });
  await expect(newBtn).toBeEnabled();
});

test('owner can open the edit dialog via info panel', async ({ ownerPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const editDialog = await openEditViaInfoPanel(page, ownerAssistant.agentId);
  await expect(editDialog).toBeVisible({ timeout: 10_000 });

  await page.keyboard.press('Escape');
});

test('owner can access the edit dialog and see the delete button', async ({ ownerPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const editDialog = await openEditViaInfoPanel(page, ownerAssistant.agentId);
  await expect(editDialog).toBeVisible({ timeout: 10_000 });

  const endContractBtn = page.getByRole('button', { name: /end contract/i });
  await expect(endContractBtn).toBeVisible({ timeout: 5_000 });

  await page.keyboard.press('Escape');
});

// =============================================================================
// Tests — Member Permissions (restricted: no hire/edit/delete on others' assistants)
// =============================================================================

test('member cannot see the "New" hire button in the assistant list', async ({
  memberPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  await expect(page.getByTestId(`assistant-list-item-${ownerAssistant.agentId}`)).toBeVisible({
    timeout: 15_000,
  });

  // The hire ("Teammate") affordance is permission-gated and must NOT render
  // for members — the create menu still opens for Group / Team, but carries no
  // onboard entry, and no standalone onboard control exists either.
  await openAssistantCreateMenu(page);
  await expect(page.getByTestId('assistant-onboard-button')).toHaveCount(0);
});

test("member cannot open edit dialog on owner's assistant", async ({ memberPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  await openAssistantInfoPanelFromList(page, ownerAssistant.agentId);
  const profileTab = page.getByRole('tab', { name: 'Profile' });
  if (await profileTab.isVisible().catch(() => false)) {
    await profileTab.click();
  }

  const editSection = page.getByTestId('assistant-info-edit-profile-section');
  await expect(editSection).toBeVisible({ timeout: 10_000 });
  await expect(editSection).not.toHaveAttribute('role', 'button');
  await editSection.click();
  await expect(page.locator('[role="dialog"]').filter({ hasText: /^Edit / })).toHaveCount(0);
});

test('member can view the integrations tab but cannot add secrets on owner assistant', async ({
  memberPage: page,
}) => {
  await openSecretsTab(page, ownerAssistant.agentId);

  await expect(page.getByTestId('integrations-pane')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('integration-gallery-search')).toBeVisible({ timeout: 5_000 });

  // Write affordances are gated on `canWrite` for the selected assistant.
  await expect(page.getByTestId('integrations-add-new-trigger')).toHaveCount(0);
});

test('member CAN see and edit their own assistant in the org', async ({ memberPage: page }) => {
  const memberAssistant = createAssistant({
    userId: member.id,
    orgId: org.id,
    firstName: 'MemberBot',
    surname: 'Own',
  });

  try {
    await navigateToAssistants(page);
    await closeHireDialogIfOpen(page);

    const editDialog = await openEditViaInfoPanel(page, memberAssistant.agentId);
    await expect(editDialog).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape');
  } finally {
    try {
      dbExec(`DELETE FROM assistant_contacts WHERE assistant_id = ${memberAssistant.agentId}`);
    } catch {
      /* */
    }
    try {
      dbExec(`DELETE FROM assistants WHERE agent_id = ${memberAssistant.agentId}`);
    } catch {
      /* */
    }
  }
});
