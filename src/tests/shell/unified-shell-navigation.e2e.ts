/**
 * Unified shell navigation verifies that assistants, settings, organizations,
 * and admin surfaces behave like tabs inside one mounted shell: soft client
 * navigations (no full document reload), preserved assistant chrome, and no
 * skeleton flicker on return hops.
 *
 * Cross-surface hops use `router.push` and `router.prefetch`, so RSC flight
 * requests are expected. The soft-nav contract is zero *document* requests,
 * not zero RSC.
 *
 * Run: npx playwright test src/tests/shell/unified-shell-navigation.e2e.ts
 */

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  cleanupUser,
  closeHireDialogIfOpen,
  createAssistant,
  createAssistantTest,
  createTestUser,
  ensureProjectSync,
  navigateToAssistants,
  selectAssistantInList,
} from '../assistants/helpers';
import { ensureUnifyOrg } from '../helpers/seeds/client';
import { assistantRail, railSection, visibleShellTestId } from '../helpers/shell';

const user = createTestUser({
  name: 'UnifiedShell',
  lastName: 'Navigator',
  credits: 50_000,
  email: `unified-shell-staff-${Date.now()}@unify.ai`,
});
// Admin link in settings is gated on isUnifyAdmin: Unify org owner/admin
// AND a unify.ai mailbox (the org name alone is user-choosable).
ensureUnifyOrg({ memberId: user.id, memberRole: 'Admin', credits: 50_000 });
ensureProjectSync(user.apiKey);

const test = createAssistantTest(user);
test.setTimeout(180_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ShellNav',
  surname: 'Tester',
});

test.afterAll(() => {
  cleanupUser(user.id);
});

async function navigationEntryCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => performance.getEntriesByType('navigation').length);
}

async function expectNoWorkspaceCube(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByLabel('Loading workspace')).toHaveCount(0);
}

async function expectNoSectionBodySkeleton(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('[data-testid="section-body-skeleton"]:visible')).toHaveCount(0);
}

async function expectNoAssistantTabSkeletons(page: import('@playwright/test').Page): Promise<void> {
  const skeletonTestIds = [
    'tasks-skeleton',
    'functions-skeleton',
    'contacts-skeleton',
    'doc-list-skeleton',
    'doc-reader-skeleton',
    'integration-gallery-skeleton',
    'live-actions-loading',
  ];
  for (const testId of skeletonTestIds) {
    // Unified shell keeps Main mounted (often hidden) across settings/admin, so
    // page-wide skeleton queries can hit inert copies. Only visible ones matter.
    await expect(page.locator(`[data-testid="${testId}"]:visible`)).toHaveCount(0);
  }
}

const SHELL_FLICKER_SKELETON_TEST_IDS = [
  'section-body-skeleton',
  'assistant-section-skeleton',
  'rail-unity-switcher-skeleton',
  'tasks-skeleton',
  'functions-skeleton',
  'contacts-skeleton',
  'doc-list-skeleton',
  'doc-reader-skeleton',
  'integration-gallery-skeleton',
  'live-actions-loading',
] as const;

async function observeSkeletonFlicker(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate((testIds) => {
    const w = window as typeof window & {
      __shellSkeletonFlickerObserver?: {
        observer: MutationObserver;
        seen: Set<string>;
      };
    };
    w.__shellSkeletonFlickerObserver?.observer.disconnect();
    const seen = new Set<string>();
    const selector = testIds.map((testId) => `[data-testid="${testId}"]`).join(',');
    const isVisible = (element: Element): boolean => {
      if (!(element instanceof HTMLElement)) return false;
      if (typeof element.checkVisibility === 'function') {
        return element.checkVisibility();
      }
      return element.getClientRects().length > 0;
    };
    const recordMatches = () => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!isVisible(element)) return;
        const testId = element.getAttribute('data-testid');
        if (testId) seen.add(testId);
      });
    };
    const observer = new MutationObserver(recordMatches);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid', 'class', 'style', 'hidden', 'aria-hidden'],
    });
    w.__shellSkeletonFlickerObserver = { observer, seen };
  }, SHELL_FLICKER_SKELETON_TEST_IDS);

  return async () =>
    page.evaluate(() => {
      const w = window as typeof window & {
        __shellSkeletonFlickerObserver?: {
          observer: MutationObserver;
          seen: Set<string>;
        };
      };
      const recorder = w.__shellSkeletonFlickerObserver;
      if (!recorder) return [];
      recorder.observer.disconnect();
      delete w.__shellSkeletonFlickerObserver;
      return Array.from(recorder.seen);
    });
}

test('direct assistants entry settles into the assistant shell @push @area(assistants.core)', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page, { userId: user.id, apiKey: user.apiKey });
  await closeHireDialogIfOpen(page);
  await expect(assistantRail(page)).toBeVisible({ timeout: 15_000 });
  await expectNoWorkspaceCube(page);
});

test('settings/admin/assistants switch without document reload and preserve assistant state @push @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page, { userId: user.id, apiKey: user.apiKey });
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 15_000 });
  await expectNoWorkspaceCube(page);
  await railSection(page, 'tasks').click();
  await expect(railSection(page, 'tasks')).toHaveAttribute('aria-current', 'page');
  await expectNoWorkspaceCube(page);
  await expect(page.locator('[data-testid="tasks-skeleton"]:visible')).toHaveCount(0, {
    timeout: 15_000,
  });

  let documentRequests = 0;
  page.on('request', (request) => {
    if (request.resourceType() === 'document') {
      documentRequests += 1;
    }
  });
  const initialNavigationCount = await navigationEntryCount(page);

  await visibleShellTestId(page, 'rail-nav-settings').click();
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByTestId('settings-subrail')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="section-body-skeleton"]:visible')).toHaveCount(0, {
    timeout: 15_000,
  });
  await expectNoWorkspaceCube(page);

  await page.getByTestId('settings-nav-contact-info').click();
  await expect(page).toHaveURL(/\/account\?tab=contact-info/);
  await expectNoSectionBodySkeleton(page);
  await expectNoWorkspaceCube(page);

  await page.getByTestId('settings-link-organizations').click();
  await expect(page).toHaveURL(/\/organizations/);
  await expect(page.getByTestId('settings-subrail')).toBeVisible();
  await expect(page.locator('[data-testid="section-body-skeleton"]:visible')).toHaveCount(0, {
    timeout: 15_000,
  });
  await expectNoWorkspaceCube(page);

  await page.getByTestId('settings-link-admin').click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByTestId('admin-nav-organizations')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="section-body-skeleton"]:visible')).toHaveCount(0, {
    timeout: 15_000,
  });
  await expectNoWorkspaceCube(page);

  const stopAdminToTasksObserver = await observeSkeletonFlicker(page);
  await railSection(page, 'tasks').click();
  await expect(page).toHaveURL(/\/assistants/);
  await expect(railSection(page, 'tasks')).toHaveAttribute('aria-current', 'page');
  // Unified shell keeps list + desktop chrome mounted; scope to the visible rail.
  await expect(
    assistantRail(page).getByText('ShellNav Tester', { exact: true }).first()
  ).toBeVisible();
  await expectNoWorkspaceCube(page);
  await expectNoAssistantTabSkeletons(page);
  expect(await stopAdminToTasksObserver()).toEqual([]);

  const stopTasksToAccountObserver = await observeSkeletonFlicker(page);
  await visibleShellTestId(page, 'rail-nav-settings').click();
  await expect(page).toHaveURL(/\/account/);
  await expectNoSectionBodySkeleton(page);
  expect(await stopTasksToAccountObserver()).toEqual([]);

  expect(documentRequests).toBe(0);
  await expect.poll(() => navigationEntryCount(page)).toBe(initialNavigationCount);
});
