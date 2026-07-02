/**
 * Permissions E2E Tests — browser-based tests for assistant permission
 * enforcement in an organization context.
 *
 * Verifies:
 *  - Org Owner can see the "New" hire button
 *  - Org Member cannot see the "New" hire button
 *  - Org Owner can open the edit dialog via the info panel and see "End contract"
 *  - Org Member can open the edit dialog on another's assistant but it
 *    does not show "End contract"
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

import { test as base, expect, type Page, type Browser } from '@playwright/test';
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
import { loginAndWaitForRedirect } from '../auth/helpers';
import { openUnitySwitcher, openRailSection, openEditDialogFromList } from './helpers';

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

  // Handle onboarding
  if (page.url().includes('/login/onboarding')) {
    // For org members, autoComplete might kick in. Wait for redirect.
    await page
      .waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 20_000,
      })
      .catch(async () => {
        // If not auto-completed, try clicking personal
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

  // Switch to the org workspace
  await page.evaluate(async (oid) => {
    await fetch('/api/session/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: String(oid) }),
    });
  }, orgId);

  // Reload to pick up the workspace switch
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);

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

async function navigateToAssistants(page: Page) {
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
}

async function closeHireDialogIfOpen(page: Page) {
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
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
 * Open the edit dialog from a list row via the info panel.
 */
async function openEditViaInfoPanel(page: Page, agentId: number) {
  await openUnitySwitcher(page);
  await openEditDialogFromList(page, agentId);
  await page.waitForTimeout(500);
}

/**
 * Navigate to an assistant's profile and open the Secrets tab in the right-hand pane.
 */
async function openSecretsTab(page: Page, agentId: number) {
  await page.goto(`/assistants?profile=${agentId}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await closeHireDialogIfOpen(page);
  await page.waitForTimeout(1_500);

  await openRailSection(page, 'integrations');
  await page.waitForTimeout(1_000);

  await expect(page.getByTestId('integrations-pane')).toBeVisible({ timeout: 5_000 });
}

// =============================================================================
// Tests — Owner Permissions (baseline: everything visible)
// =============================================================================

test('owner can see the "New" hire button in the assistant list', async ({ ownerPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const newBtn = page.getByTestId('assistant-onboard-button');
  await expect(newBtn).toBeVisible({ timeout: 15_000 });
  await expect(newBtn).toBeEnabled();
});

test('owner can open the edit dialog via info panel', async ({ ownerPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await openEditViaInfoPanel(page, ownerAssistant.agentId);

  const editDialog = page.locator('[role="dialog"]');
  await expect(editDialog).toBeVisible({ timeout: 10_000 });

  await page.keyboard.press('Escape');
});

test('owner can access the edit dialog and see the delete button', async ({ ownerPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await openEditViaInfoPanel(page, ownerAssistant.agentId);

  const editDialog = page.locator('[role="dialog"]');
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

  // Wait for the page to render (assistant list should load)
  await page.waitForTimeout(3_000);

  // The hire ("Onboard") affordance is permission-gated and must NOT render
  // for members — neither the labelled button nor its folded icon variant.
  await expect(page.getByTestId('assistant-onboard-button')).toHaveCount(0);
});

test("member can open edit dialog on owner's assistant but cannot see delete button", async ({
  memberPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await openEditViaInfoPanel(page, ownerAssistant.agentId);

  const editDialog = page.locator('[role="dialog"]');
  await expect(editDialog).toBeVisible({ timeout: 10_000 });

  // The "End contract" button should NOT be visible for members on others' assistants
  const endContractBtn = page.getByRole('button', { name: /end contract/i });
  const isDeleteVisible = await endContractBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  expect(isDeleteVisible).toBe(false);

  await page.keyboard.press('Escape');
});

test('member can view the secrets tab but cannot add secrets on owner assistant', async ({
  memberPage: page,
}) => {
  await openSecretsTab(page, ownerAssistant.agentId);

  // The read-only primitives are present…
  await expect(page.getByTestId('secrets-search')).toBeVisible({ timeout: 5_000 });

  // …but the write-action affordances must NOT be. The "Add new" dropdown
  // and "Upload" button are gated on `canWrite`, and every row/folder
  // 3-dots menu is too.
  await expect(page.getByTestId('secrets-new-button')).toHaveCount(0);
  await expect(page.getByTestId('secrets-upload-button')).toHaveCount(0);
  await expect(page.locator('[data-testid^="secrets-row-menu-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="secrets-folder-menu-"]')).toHaveCount(0);
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

    // Open edit via info panel on their own assistant
    await openEditViaInfoPanel(page, memberAssistant.agentId);

    const editDialog = page.locator('[role="dialog"]');
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
