/**
 * Provider Integrations E2E — smoke test for the unified connected-apps page.
 * The local mock catalog keeps this independent of third-party provider
 * credentials; policy calls still exercise the browser flow through the
 * Console integration client shape.
 *
 * Run: npx playwright test src/tests/assistants/provider-integrations.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  closeHireDialogIfOpen,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  openRailSection,
} from './helpers';

type PolicyLevel = 'auto' | 'specific_approval' | 'forbidden';

interface PolicyPatchCall {
  connectionId: string;
  body: Record<string, unknown>;
}

const user = createTestUser({ name: 'ProviderIntegration', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ProviderBot',
  surname: 'E2E',
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

async function installMockPolicyRoutes(page: Page): Promise<PolicyPatchCall[]> {
  const policyByConnection: Record<string, Record<string, PolicyLevel>> = {
    'mock-hubspot-work-connection': {
      'hubspot.search_contacts': 'auto',
      'hubspot.update_contact': 'specific_approval',
    },
    'mock-hubspot-personal-connection': {
      'hubspot.search_contacts': 'forbidden',
      'hubspot.update_contact': 'specific_approval',
    },
  };
  const accountLabelByConnection: Record<string, string> = {
    'mock-hubspot-work-connection': 'Work HubSpot',
    'mock-hubspot-personal-connection': 'Personal HubSpot',
  };
  const patchCalls: PolicyPatchCall[] = [];

  await page.route('**/api/integrations/provider/connections/*/tool-policy**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const parts = url.pathname.split('/');
    const connectionId = parts[parts.indexOf('connections') + 1] ?? '';
    const currentPolicy = policyByConnection[connectionId] ?? {};

    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as {
        tool_policies?: Record<string, PolicyLevel>;
        bulk_approval_level?: PolicyLevel;
        reset_to_defaults?: boolean;
      };
      patchCalls.push({ connectionId, body });
      if (body.reset_to_defaults) {
        policyByConnection[connectionId] = {
          'hubspot.search_contacts': 'auto',
          'hubspot.update_contact': 'specific_approval',
        };
      } else if (body.tool_policies) {
        policyByConnection[connectionId] = {
          ...currentPolicy,
          ...body.tool_policies,
        };
      } else if (body.bulk_approval_level) {
        policyByConnection[connectionId] = Object.fromEntries(
          Object.keys(currentPolicy).map((toolId) => [toolId, body.bulk_approval_level])
        ) as Record<string, PolicyLevel>;
      }
    }

    const effectivePolicy = policyByConnection[connectionId] ?? {};
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connection_id: connectionId,
        canonical_app_slug: 'hubspot',
        app_display_name: 'HubSpot',
        account_label: accountLabelByConnection[connectionId] ?? 'HubSpot account',
        policies: [
          {
            tool_id: 'hubspot.search_contacts',
            provider_tool_id: 'HUBSPOT_SEARCH_CONTACTS',
            canonical_name: 'primitives.integrations.hubspot.search_contacts',
            display_name: 'Search contacts',
            action_class: 'read',
            behavior_hints: ['read_only'],
            default_approval_level: 'auto',
            approval_level: effectivePolicy['hubspot.search_contacts'] ?? 'auto',
            activation_state: 'connected_ready',
            confirmation_required: false,
          },
          {
            tool_id: 'hubspot.update_contact',
            provider_tool_id: 'HUBSPOT_UPDATE_CONTACT',
            canonical_name: 'primitives.integrations.hubspot.update_contact',
            display_name: 'Update contact',
            action_class: 'write',
            behavior_hints: ['mutates_state'],
            default_approval_level: 'specific_approval',
            approval_level: effectivePolicy['hubspot.update_contact'] ?? 'specific_approval',
            activation_state: 'connected_ready',
            confirmation_required: true,
          },
        ],
      }),
    });
  });

  return patchCalls;
}

async function openMockIntegrationsTab(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('console:integrations:mock', 'true');
    window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
  });
  await page.goto(`/assistants?profile=${assistant.agentId}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await closeHireDialogIfOpen(page);
  const hasOnboardingSkip = await page
    .waitForFunction(
      () =>
        Array.from(document.querySelectorAll('button')).some((candidate) =>
          candidate.textContent?.includes('rather text')
        ),
      undefined,
      { timeout: 10_000 }
    )
    .then(() => true)
    .catch(() => false);
  if (hasOnboardingSkip) {
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
        candidate.textContent?.includes('rather text')
      );
      button?.click();
    });
  }
  const skipChecklist = page.getByRole('button', { name: /skip onboarding/i });
  if (await skipChecklist.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await skipChecklist.click();
  }
  await page.waitForTimeout(1_500);

  await openRailSection(page, 'integrations');

  const pane = page.getByTestId('integrations-pane');
  await expect(pane).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('integration-gallery')).toBeVisible({ timeout: 10_000 });
}

test('mock connected-apps page shows dynamic apps, permissions, tools, and connect flow', async ({
  authedPage: page,
}) => {
  const policyPatchCalls = await installMockPolicyRoutes(page);
  await openMockIntegrationsTab(page);

  await expect(page.getByTestId('provider-integration-card-slack')).toBeVisible();
  await expect(page.getByTestId('provider-integration-card-clay')).toBeVisible();
  await expect(page.getByTestId('provider-integration-card-hubspot')).toBeVisible();
  await expect(page.getByTestId('integration-virtual-list')).toBeVisible();
  await page.getByTestId('integration-virtual-list').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });

  await page.getByTestId('integration-card-primary-hubspot').click();
  await expect(page.getByTestId('provider-integration-detail-sheet')).toBeVisible();
  await expect(page.getByTestId('provider-permission-review')).toBeVisible();
  await expect(page.getByText('Available tools')).toBeVisible();
  await expect(page.getByTestId('integration-policy-account-required')).toContainText(
    'Select which HubSpot account to edit'
  );
  await expect(page.getByTestId('integration-tool-policy-hubspot.search_contacts')).toHaveCount(0);
  await page.getByTestId('integration-account-select-mock-hubspot-work-connection').click();
  await expect(page.getByTestId('integration-secure-connection-summary')).toContainText(
    'Tool permissions for HubSpot · Work HubSpot'
  );
  await expect(
    page.getByTestId('integration-tool-policy-hubspot.search_contacts-auto')
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('integration-tool-policy-hubspot.search_contacts-forbidden').click();
  await expect
    .poll(() =>
      policyPatchCalls.some(
        (call) =>
          call.connectionId === 'mock-hubspot-work-connection' &&
          JSON.stringify(call.body).includes('"hubspot.search_contacts":"forbidden"')
      )
    )
    .toBe(true);
  await page.getByTestId('integration-account-select-mock-hubspot-personal-connection').click();
  await expect(page.getByTestId('integration-secure-connection-summary')).toContainText(
    'Tool permissions for HubSpot · Personal HubSpot'
  );
  await expect(
    page.getByTestId('integration-tool-policy-hubspot.search_contacts-forbidden')
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Static package')).toHaveCount(0);
  await expect(page.getByText('Overlay curated')).toHaveCount(0);
  await expect(page.getByTestId('integration-actor-visibility')).toHaveCount(0);

  await page
    .getByTestId('provider-integration-detail-sheet')
    .getByRole('button', { name: 'Close' })
    .last()
    .click();
  await expect(page.getByTestId('provider-integration-detail-sheet')).toBeHidden({
    timeout: 5_000,
  });

  await page.getByTestId('integration-gallery-search').fill('Slack');
  await page.getByTestId('integration-gallery-search-submit').click();
  await expect(page.getByTestId('provider-integration-card-slack')).toBeVisible();
  await page.getByTestId('integration-card-primary-slack').click();
  await expect(page.getByTestId('provider-integration-connect-dialog')).toBeVisible();
  await page
    .getByTestId('provider-integration-connect-dialog')
    .getByLabel('Account label')
    .fill('Work Slack');
  await page
    .getByTestId('provider-integration-connect-dialog')
    .getByRole('button', { name: 'Connect' })
    .click();
  await expect(page.getByText('Started Slack connection.')).toBeVisible({ timeout: 5_000 });
});
