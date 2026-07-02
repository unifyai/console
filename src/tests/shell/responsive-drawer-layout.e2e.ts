/**
 * Responsive drawer layout + background-fetch quiescence E2E.
 *
 * Verifies narrow-viewport usability for assistant/admin panes and ensures
 * hidden assistant surfaces do not keep refetching while admin routes are
 * active.
 *
 * Run: npx playwright test src/tests/shell/responsive-drawer-layout.e2e.ts
 */

import { expect, test as base, type Page, type Request } from '@playwright/test';
import path from 'path';
import os from 'os';
import {
  createTestUser,
  cleanupUser,
  createOrg,
  deleteOrg,
  createAssistant,
  createAssistantTest,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  orchestraFetch,
  closeHireDialogIfOpen,
  openRailSection,
  selectAssistantInList,
} from '../assistants/helpers';
import { loginAndWaitForRedirect } from '../auth/helpers';

const NARROW_VIEWPORT = { width: 820, height: 900 };

const shellUser = createTestUser({ name: 'ShellLayout', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(shellUser.apiKey);
const shellTest = createAssistantTest(shellUser);

const adminUser = createTestUser({ name: 'ShellAdmin', lastName: 'Operator' });
const unifyOrg = createOrg({ name: 'Unify', ownerId: adminUser.id });

let adminAuthFile: string | undefined;

const adminTest = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use, testInfo) => {
    if (!adminAuthFile) {
      testInfo.setTimeout(testInfo.timeout + 30_000);
      adminAuthFile = path.join(
        os.tmpdir(),
        `pw-shell-admin-${adminUser.email.replace(/[^a-z0-9]/gi, '-')}.json`
      );
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.goto('/login');
      await loginAndWaitForRedirect(p, adminUser.email, adminUser.password, 30_000);
      if (p.url().includes('/login/onboarding')) {
        const personalBtn = p.getByTestId('workspace-personal');
        if (await personalBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await personalBtn.click();
          await p.getByTestId('workspace-continue').click();
          await p.waitForURL((u) => !u.pathname.includes('onboarding'), { timeout: 15_000 });
        }
      }
      await ctx.storageState({ path: adminAuthFile });
      await ctx.close();
    }
    const ctx = await browser.newContext({ storageState: adminAuthFile });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
});

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function isGetSecretsPost(postData: string | null): boolean {
  if (!postData) return false;
  return postData.includes('"ascending"') && postData.includes('"$undefined"');
}

function isListInvoicesPost(postData: string | null): boolean {
  if (!postData) return false;
  return (
    postData.includes('"limit"') &&
    postData.includes('"offset"') &&
    !postData.includes('"ascending"')
  );
}

function isListTemplatesPost(postData: string | null): boolean {
  if (!postData) return false;
  return postData.includes('"includeInactive"') || postData.includes('"includeCustom"');
}

async function countMatchingPosts(
  page: Page,
  urlIncludes: string,
  matcher: (postData: string | null) => boolean,
  durationMs: number
): Promise<number> {
  let count = 0;
  const onRequest = (request: Request) => {
    if (request.method() !== 'POST') return;
    if (!request.url().includes(urlIncludes)) return;
    if (matcher(request.postData())) count += 1;
  };
  page.on('request', onRequest);
  await page.waitForTimeout(durationMs);
  page.off('request', onRequest);
  return count;
}

async function seedFunctions(apiKey: string, userId: string, assistantId: number) {
  const entries = [
    {
      name: 'layout_fn_alpha',
      language: 'python',
      argspec: '() -> None',
      docstring: 'Alpha function for responsive layout coverage.',
      implementation: 'def layout_fn_alpha():\n    return None',
    },
    {
      name: 'layout_fn_beta',
      language: 'python',
      argspec: '() -> None',
      docstring: 'Beta function for responsive layout coverage.',
      implementation: 'def layout_fn_beta():\n    return None',
    },
    {
      name: 'layout_fn_gamma',
      language: 'python',
      argspec: '() -> None',
      docstring: 'Gamma function for responsive layout coverage.',
      implementation: 'def layout_fn_gamma():\n    return None',
    },
  ];
  for (const entry of entries) {
    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context: `${userId}/${assistantId}/Functions/Compositional`,
          entries: [entry],
        }),
      },
      apiKey
    );
    if (!res.ok) {
      throw new Error(`Failed to seed function ${entry.name}: ${res.status} ${await res.text()}`);
    }
  }
}

shellTest.afterAll(() => {
  deleteAllAssistantsForUser(shellUser.id);
  cleanupUser(shellUser.id);
});

adminTest.afterAll(() => {
  try {
    deleteOrg(unifyOrg.id);
  } catch {
    /* best effort */
  }
  cleanupUser(adminUser.id);
});

shellTest(
  'Functions grid cards do not overlap at a constrained viewport',
  async ({ authedPage: page }) => {
    deleteAllAssistantsForUser(shellUser.id);
    const assistant = createAssistant({
      userId: shellUser.id,
      firstName: 'Grid',
      surname: 'Layout',
    });
    await seedFunctions(shellUser.apiKey, shellUser.id, assistant.agentId);

    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto(`/assistants?profile=${assistant.agentId}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await closeHireDialogIfOpen(page);

    await openRailSection(page, 'functions');
    await expect(page.getByTestId('functions-pane')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('function-card-layout_fn_alpha')).toBeVisible({
      timeout: 15_000,
    });

    const cards = page.locator('[data-testid^="function-card-"]');
    await expect(cards).toHaveCount(3, { timeout: 15_000 });

    const alphaBox = await cards.nth(0).boundingBox();
    const betaBox = await cards.nth(1).boundingBox();
    expect(alphaBox).not.toBeNull();
    expect(betaBox).not.toBeNull();
    expect(boxesOverlap(alphaBox!, betaBox!)).toBe(false);
  }
);

shellTest(
  'Transcripts channel select is visible in stacked layout',
  async ({ authedPage: page }) => {
    deleteAllAssistantsForUser(shellUser.id);
    const assistant = createAssistant({
      userId: shellUser.id,
      firstName: 'Transcript',
      surname: 'Layout',
    });

    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto(`/assistants?profile=${assistant.agentId}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await closeHireDialogIfOpen(page);

    await openRailSection(page, 'transcripts');
    await expect(page.getByTestId('transcripts-pane')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('transcripts-channel-select')).toBeVisible({ timeout: 10_000 });
  }
);

shellTest(
  'Integration status badges stay inside card bounds at narrow width',
  async ({ authedPage: page }) => {
    deleteAllAssistantsForUser(shellUser.id);
    const assistant = createAssistant({
      userId: shellUser.id,
      firstName: 'Integrations',
      surname: 'Layout',
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('console:integrations:mock', 'true');
      window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
    });

    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto(`/assistants?profile=${assistant.agentId}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await closeHireDialogIfOpen(page);

    await openRailSection(page, 'integrations');
    const card = page.getByTestId('provider-integration-card-slack');
    await expect(card).toBeVisible({ timeout: 15_000 });

    const cardBox = await card.boundingBox();
    const badge = card.locator('[data-testid^="integration-status-"]').first();
    await expect(badge).toBeVisible();
    const badgeBox = await badge.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    expect(badgeBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
    expect(badgeBox!.y).toBeGreaterThanOrEqual(cardBox!.y);
    expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
    expect(badgeBox!.y + badgeBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 1);
  }
);

adminTest(
  'admin invoices stay network-quiet while a hidden assistant remains selected',
  async ({ adminPage: page }) => {
    deleteAllAssistantsForUser(adminUser.id);
    const assistant = createAssistant({
      userId: adminUser.id,
      firstName: 'Hidden',
      surname: 'Surface',
    });

    await page.goto('/assistants');
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
    await closeHireDialogIfOpen(page);
    await selectAssistantInList(page, assistant.agentId);
    await expect(page.getByTestId('assistant-rail')).toBeVisible({ timeout: 15_000 });

    await page.goto('/admin/invoices');
    await expect(page.getByPlaceholder('Search by org, email, billing account id')).toBeVisible({
      timeout: 20_000,
    });

    await page.waitForTimeout(5_000);

    const listInvoicePosts = await countMatchingPosts(
      page,
      '/admin/invoices',
      isListInvoicesPost,
      12_000
    );
    const listTemplatePosts = await countMatchingPosts(
      page,
      '/admin/invoices',
      isListTemplatesPost,
      12_000
    );
    const getSecretsPosts = await countMatchingPosts(
      page,
      '/admin/invoices',
      isGetSecretsPost,
      12_000
    );

    expect(listInvoicePosts).toBe(0);
    expect(listTemplatePosts).toBe(0);
    expect(getSecretsPosts).toBe(0);

    deleteAllAssistantsForUser(adminUser.id);
  }
);
