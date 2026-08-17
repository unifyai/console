import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Visible assistants rail. The unified shell keeps a hidden Main-mounted rail
 * in the DOM on settings/admin routes, so plain `getByTestId('assistant-rail')`
 * can resolve to a hidden element or strict-mode duplicates. Prefer the last
 * visible rail — on `/assistants` that is the live Main surface, not the
 * global shell rail when both are mounted.
 */
export function assistantRail(page: Page): Locator {
  return page.locator('[data-testid="assistant-rail"]:visible').last();
}

/** Visible unity switcher on the active assistants rail. */
export function railUnitySwitcher(page: Page): Locator {
  return assistantRail(page).getByTestId('rail-unity-switcher');
}

/** Visible account trigger in the assistants rail (hidden global rail duplicates exist). */
export function railAccountTrigger(page: Page): Locator {
  return page.locator('[data-testid="rail-account-trigger"]:visible').first();
}

/** Resolve a shell test id to its visible instance on the active assistants rail. */
export function visibleShellTestId(page: Page, testId: string): Locator {
  return assistantRail(page).getByTestId(testId);
}

/** Workspace/Brain section nav button on the active assistants rail. */
export function railSection(page: Page, sectionId: string): Locator {
  // Chat has no nav button — it opens from the switcher's face.
  if (sectionId === 'chat') {
    return assistantRail(page).getByTestId('rail-chat-home');
  }
  return assistantRail(page).getByTestId(`rail-section-${sectionId}`);
}

/**
 * Reveal the assistant list's create actions. Workspaces offering more than
 * onboarding (org rosters: Group / Team / Teammate) nest them behind the
 * header's "+" menu; personal workspaces expose onboarding directly, so there
 * is no menu to open.
 */
export async function openAssistantCreateMenu(page: Page): Promise<void> {
  const trigger = page.getByTestId('assistant-create-menu');
  if (await trigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await trigger.click();
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 5_000 });
  }
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
          await railUnitySwitcher(page)
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
