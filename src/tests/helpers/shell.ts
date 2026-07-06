import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Visible assistants rail. The unified shell keeps a hidden Main-mounted rail
 * in the DOM on settings/admin routes, so plain `getByTestId('assistant-rail')`
 * can resolve to a hidden element or strict-mode duplicates.
 */
export function assistantRail(page: Page): Locator {
  return page.locator('[data-testid="assistant-rail"]:visible');
}

/** Visible account trigger in the assistants rail (hidden global rail duplicates exist). */
export function railAccountTrigger(page: Page): Locator {
  return page.locator('[data-testid="rail-account-trigger"]:visible').first();
}

/** Resolve a shell test id to its visible instance (Main + global rails duplicate many ids). */
export function visibleShellTestId(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]:visible`).first();
}

/** Wait until the assistants shell exposes an interactive rail or switcher. */
export async function waitForAssistantsRail(page: Page, timeout = 60_000): Promise<void> {
  await expect
    .poll(
      async () => {
        if (
          await assistantRail(page)
            .isVisible()
            .catch(() => false)
        )
          return 'ready';
        if (
          await page
            .getByTestId('rail-unity-switcher')
            .isVisible()
            .catch(() => false)
        ) {
          return 'ready';
        }
        return 'pending';
      },
      { timeout }
    )
    .toBe('ready');
}
