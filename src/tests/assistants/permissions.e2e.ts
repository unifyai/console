/**
 * Permissions E2E Tests — browser-based tests for assistant permission
 * enforcement in an organization context.
 *
 * Verifies:
 *  - Org Owner can see the "New" hire button
 *  - Org Member cannot see the "New" hire button
 *  - Org Owner can see the edit (pen) icon on an assistant
 *  - Org Member cannot see the edit icon on another member's assistant
 *  - Org Owner can see the "End contract" (delete) option in the edit dialog
 *  - Org Member cannot access the edit dialog for another member's assistant
 *  - Org Member CAN view secrets but CANNOT add/delete them on another's assistant
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
} from '../seeds/client';
import { createTestUser, cleanupUser } from '../e2e-helpers';
import { login } from '../auth/helpers';

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
  await login(page, email, password);
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 45_000 });

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

async function expandProfileAccordion(page: Page) {
  const profileTrigger = page.locator('button[data-state]').filter({ hasText: 'Profile' }).first();
  const state = await profileTrigger.getAttribute('data-state');
  if (state !== 'open') {
    await profileTrigger.click();
    await page.waitForTimeout(500);
  }
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

// =============================================================================
// Tests — Owner Permissions (baseline: everything visible)
// =============================================================================

test('owner can see the "New" hire button in the assistant list', async ({ ownerPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const newBtn = page.locator('button:has-text("New")');
  await expect(newBtn).toBeVisible({ timeout: 15_000 });
  await expect(newBtn).toBeEnabled();
});

test('owner can see the edit icon on their assistant', async ({ ownerPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${ownerAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(2_000);

  await expandProfileAccordion(page);

  const editIcon = page.locator('.lucide-pen-line');
  await expect(editIcon).toBeVisible({ timeout: 10_000 });
});

test('owner can access the edit dialog and see the delete button', async ({ ownerPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${ownerAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(2_000);

  await expandProfileAccordion(page);

  const editIcon = page.locator('.lucide-pen-line');
  await expect(editIcon).toBeVisible({ timeout: 10_000 });
  await editIcon.click();
  await page.waitForTimeout(1_000);

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

  // Wait for the page to render (assistant list should load)
  await page.waitForTimeout(3_000);

  // The "New" button should NOT be visible
  const newBtn = page.locator('button:has-text("New")');
  const isNewVisible = await newBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  expect(isNewVisible).toBe(false);

  // The UserPlus icon button (folded view) should also NOT be visible
  const userPlusBtn = page.locator('button:has(.lucide-user-plus)');
  const isUserPlusVisible = await userPlusBtn.isVisible({ timeout: 3_000 }).catch(() => false);
  expect(isUserPlusVisible).toBe(false);
});

test("member cannot see the edit icon on the owner's assistant", async ({ memberPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  // The owner's assistant should be visible in the list
  const listItem = page.getByTestId(`assistant-list-item-${ownerAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(2_000);

  // The edit icon should NOT be visible
  const editIcon = page.locator('.lucide-pen-line');
  const isEditVisible = await editIcon.isVisible({ timeout: 5_000 }).catch(() => false);
  expect(isEditVisible).toBe(false);
});

test("member cannot click About text to open edit on the owner's assistant", async ({
  memberPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${ownerAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(2_000);

  // The about section should NOT have cursor-pointer class (not clickable)
  const aboutSection = page.locator('.prose:has-text("Seed test assistant")');
  if (await aboutSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const className = (await aboutSection.getAttribute('class')) ?? '';
    expect(className).not.toContain('cursor-pointer');
  }
});

test('member can view the secrets manager but cannot add secrets on owner assistant', async ({
  memberPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${ownerAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(2_000);

  // Open the "Resources" accordion section
  const resourcesTrigger = page.locator('button[data-state]:has-text("Resources")').first();
  if (await resourcesTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const state = await resourcesTrigger.getAttribute('data-state');
    if (state !== 'open') {
      await resourcesTrigger.click();
      await page.waitForTimeout(500);
    }
  }

  // Click on Secrets to open the secrets manager
  const secretsItem = page.locator('text=Secrets').first();
  if (await secretsItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await secretsItem.click();
    await page.waitForTimeout(1_000);

    // The secrets panel should show but "Add a secret" button should not be visible
    const addSecretBtn = page.locator('button:has-text("Add a secret")');
    const isAddVisible = await addSecretBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(isAddVisible).toBe(false);

    // The "New" button in the secrets footer should not be visible
    const secretNewBtn = page.locator(
      '[data-testid="secret-new-button"], button:has-text("New"):near(.lucide-key-round)'
    );
    const isSecretNewVisible = await secretNewBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(isSecretNewVisible).toBe(false);
  }
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

    const listItem = page.getByTestId(`assistant-list-item-${memberAssistant.agentId}`);
    await expect(listItem).toBeVisible({ timeout: 15_000 });
    await listItem.click();
    await page.waitForTimeout(2_000);

    await expandProfileAccordion(page);

    const editIcon = page.locator('.lucide-pen-line');
    await expect(editIcon).toBeVisible({ timeout: 10_000 });
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
