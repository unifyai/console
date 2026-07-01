/**
 * Contact Provisioning E2E — add and remove phone / WhatsApp contacts and
 * exercise the BYOD email connect flow via the Contact Manager dialog,
 * verifying UI updates and database persistence at each step.
 *
 * Platform-issued mailbox provisioning (`@unify.ai` / MS365 tenant) was
 * retired, so the email tab now only offers the BYOD OAuth flow — there
 * is no Create button or `#email_local_part` input on the email tab.
 *
 * Run: npx playwright test src/tests/assistants/contacts.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  createPersonalCoordinator,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openUnitySwitcher,
  deleteAssistantFromDb,
  getAssistantContact,
  setUserPhoneNumber,
  clearUserPhoneNumber,
  setUserWhatsappNumber,
  clearUserWhatsappNumber,
  ensureProjectSync,
  dbExec,
  dbExecBlock,
  openContactManagerFromList,
  openWorkspaceManagerFromList,
} from './helpers';

const user = createTestUser({ name: 'Contact', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const userPhoneSuffix = user.id.replace(/\D/g, '').slice(-7).padStart(7, '0');
const userPhone = `+1555${userPhoneSuffix}`;
const userWhatsapp = `+1556${userPhoneSuffix}`;
setUserPhoneNumber(user.id, userPhone);
setUserWhatsappNumber(user.id, userWhatsapp);
const test = createAssistantTest(user);
test.setTimeout(90_000);

const phoneAssistant = createAssistant({
  userId: user.id,
  firstName: 'PhoneBot',
  surname: 'E2E',
});

const emailUiAssistant = createAssistant({
  userId: user.id,
  firstName: 'EmailUi',
  surname: 'E2E',
});

const coordinator = createPersonalCoordinator(user.id);
dbExecBlock(`
DELETE FROM assistant_contacts
WHERE assistant_id = ${coordinator.agentId}
  AND contact_type IN ('email', 'phone');

INSERT INTO assistant_contacts (
  assistant_id,
  contact_type,
  contact_value,
  provider,
  provisioned_by,
  status,
  metadata
)
VALUES (
  ${coordinator.agentId},
  'email',
  'twin@unify.ai',
  'google_workspace',
  'platform',
  'active',
  '{"universal_unity": true}'::jsonb
),
(
  ${coordinator.agentId},
  'phone',
  '+14155552671',
  'twilio',
  'platform',
  'active',
  '{"universal_unity": true, "country": "US"}'::jsonb
);
`);

function clearAssistantContact(agentId: number, contactType: 'email' | 'phone' | 'whatsapp') {
  dbExec(
    `DELETE FROM assistant_contacts WHERE assistant_id = ${agentId} AND contact_type = '${contactType}'`
  );
}

test.beforeEach(() => {
  clearAssistantContact(phoneAssistant.agentId, 'phone');
  clearAssistantContact(phoneAssistant.agentId, 'whatsapp');
  clearAssistantContact(emailUiAssistant.agentId, 'email');
});

test.afterAll(() => {
  try {
    deleteAssistantFromDb(phoneAssistant.agentId);
    deleteAssistantFromDb(emailUiAssistant.agentId);
    deleteAssistantFromDb(coordinator.agentId);
  } catch {
    /* best effort */
  }
  cleanupUser(user.id);
});

/**
 * Locate a contact channel's section in the contact manager dialog. Every
 * channel renders as a stacked section (no dropdown), so tests scope their
 * assertions and buttons to the relevant section.
 */
function contactSection(
  page: import('@playwright/test').Page,
  type: 'email' | 'phone' | 'whatsapp' | 'discord' | 'slack'
) {
  return page.locator(`[data-contact-section="${type}"]`);
}

async function openContactManager(
  page: import('@playwright/test').Page,
  targetAssistant: { agentId: number }
) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  await openContactManagerFromList(page, targetAssistant.agentId);
}

async function openWorkspaceManager(
  page: import('@playwright/test').Page,
  targetAssistant: { agentId: number }
) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  await openWorkspaceManagerFromList(page, targetAssistant.agentId);
}

test('adding and deleting a phone contact persists to the database', async ({
  authedPage: page,
}) => {
  await openContactManager(page, phoneAssistant);

  const phone = contactSection(page, 'phone');
  await expect(phone.locator('#phoneCountry')).toBeVisible({ timeout: 5_000 });

  const createBtn = phone.getByRole('button', { name: 'Create' });
  await expect(createBtn).toBeVisible({ timeout: 5_000 });

  await Promise.all([
    page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/contact') && (resp.status() === 200 || resp.status() === 201),
        { timeout: 30_000 }
      )
      .catch(() => {}),
    createBtn.click(),
  ]);

  await expect
    .poll(() => getAssistantContact(phoneAssistant.agentId, 'phone'), { timeout: 15_000 })
    .toBeTruthy();

  await openContactManager(page, phoneAssistant);

  await expect(phone.getByText('Assistant phone contact is active.')).toBeVisible({
    timeout: 5_000,
  });

  const deleteBtn = phone.getByRole('button', { name: 'Delete' });
  await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
  await deleteBtn.click();

  await expect(page.locator('text=Are you sure?')).toBeVisible({ timeout: 5_000 });
  const proceedBtn = page.getByRole('button', { name: 'Proceed' });

  await Promise.all([
    page
      .waitForResponse((resp) => resp.url().includes('/contact') && resp.status() === 200, {
        timeout: 30_000,
      })
      .catch(() => {}),
    proceedBtn.click(),
  ]);

  await expect
    .poll(() => getAssistantContact(phoneAssistant.agentId, 'phone'), { timeout: 15_000 })
    .toBeFalsy();
});

test('phone create button is disabled when user has no phone number', async ({
  authedPage: page,
}) => {
  clearUserPhoneNumber(user.id);

  try {
    await openContactManager(page, phoneAssistant);

    const phone = contactSection(page, 'phone');
    await expect(phone.getByText('No phone number set in your profile')).toBeVisible({
      timeout: 5_000,
    });

    const createBtn = phone.getByRole('button', { name: 'Create' });
    await expect(createBtn).toBeDisabled({ timeout: 5_000 });
  } finally {
    setUserPhoneNumber(user.id, '+15551234567');
  }
});

test('whatsapp create button is disabled when user has no whatsapp number', async ({
  authedPage: page,
}) => {
  clearUserWhatsappNumber(user.id);

  try {
    await openContactManager(page, phoneAssistant);

    const whatsapp = contactSection(page, 'whatsapp');
    await expect(whatsapp.getByText('No WhatsApp number set in your profile')).toBeVisible({
      timeout: 5_000,
    });

    const createBtn = whatsapp.getByRole('button', { name: 'Create' });
    await expect(createBtn).toBeDisabled({ timeout: 5_000 });
  } finally {
    setUserWhatsappNumber(user.id, '+15559876543');
  }
});

test('whatsapp create button is enabled when user has a whatsapp number', async ({
  authedPage: page,
}) => {
  await openContactManager(page, phoneAssistant);

  const whatsapp = contactSection(page, 'whatsapp');
  await expect(
    whatsapp.getByText(
      'Create a WhatsApp contact to enable WhatsApp messaging with your assistant.'
    )
  ).toBeVisible({ timeout: 5_000 });

  const createBtn = whatsapp.getByRole('button', { name: 'Create' });
  await expect(createBtn).toBeEnabled({ timeout: 5_000 });
});

test('email tab shows BYOD-only provisioning when no email exists', async ({
  authedPage: page,
}) => {
  await openContactManager(page, emailUiAssistant);

  await expect(page.locator('text=Provision a platform email')).toHaveCount(0);
  await expect(page.locator('text=@unify.ai')).toHaveCount(0);
  await expect(page.locator('text=@tenant.onmicrosoft.com')).toHaveCount(0);
  await expect(page.locator('text=Connect your own account')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('button:has-text("Google")')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('button:has-text("Microsoft 365")')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: 'Create' })).toHaveCount(0);
});

test('T-W1N email tab shows shared T-W1N address as managed routing', async ({
  authedPage: page,
}) => {
  await openContactManager(page, coordinator);

  const email = contactSection(page, 'email');
  await expect(email.getByText('T-W1N email is configured.')).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.locator('input[value="twin@unify.ai"]')).toHaveCount(0);
  await expect(
    email.getByText('Messages to this shared address are routed by verified sender identity')
  ).toBeVisible({ timeout: 5_000 });
  await expect(email.getByRole('button', { name: 'Configure' })).toHaveCount(0);
  await expect(email.getByRole('button', { name: 'Delete' })).toHaveCount(0);
});

test('T-W1N workspace modal shows BYOD providers despite shared routing email', async ({
  authedPage: page,
}) => {
  await openWorkspaceManager(page, coordinator);

  await expect(page.getByRole('button', { name: 'Google Workspace' })).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByRole('button', { name: 'Microsoft 365' })).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.locator('input[value="twin@unify.ai"]')).toHaveCount(0);
  await expect(page.locator('text=Platform-managed email')).toHaveCount(0);
});

test('T-W1N phone tab shows shared T-W1N number as managed routing', async ({
  authedPage: page,
}) => {
  await openContactManager(page, coordinator);

  const phone = contactSection(page, 'phone');
  await expect(phone.getByText('T-W1N phone is configured.', { exact: true })).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.locator('input[value="+14155552671"]')).toHaveCount(0);
  await expect(
    phone
      .getByText(
        'T-W1N phone is managed automatically. SMS messages and calls to this shared number are routed by verified sender identity.',
        { exact: true }
      )
      .first()
  ).toBeVisible({ timeout: 5_000 });
  await expect(phone.getByRole('button', { name: 'Create' })).toHaveCount(0);
  await expect(phone.getByRole('button', { name: 'Delete' })).toHaveCount(0);
});

test('selecting a BYOD provider shows feature checkboxes and Connect button', async ({
  authedPage: page,
}) => {
  await openContactManager(page, emailUiAssistant);

  const googleCard = page.locator('button:has-text("Google")').last();
  await googleCard.click();

  await expect(page.locator('text=Email')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('text=Calendar')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('text=Required').first()).toBeVisible({ timeout: 5_000 });

  const connectBtn = page.getByRole('button', { name: 'Connect' });
  await expect(connectBtn).toBeVisible({ timeout: 5_000 });
  await expect(connectBtn).toBeEnabled();
});

test('selecting Microsoft BYOD provider shows Teams as a required feature', async ({
  authedPage: page,
}) => {
  await openContactManager(page, emailUiAssistant);

  const msCard = page.locator('button:has-text("Microsoft 365")').last();
  await msCard.click();

  const requiredLabels = page.locator('text=Required');
  await expect(requiredLabels.first()).toBeVisible({ timeout: 5_000 });
  expect(await requiredLabels.count()).toBeGreaterThanOrEqual(2);
});

test('deselecting a BYOD provider hides the feature list and Connect button', async ({
  authedPage: page,
}) => {
  await openContactManager(page, emailUiAssistant);

  const googleCard = page.locator('button:has-text("Google")').last();
  await googleCard.click();

  const connectBtn = page.getByRole('button', { name: 'Connect' });
  await expect(connectBtn).toBeVisible({ timeout: 5_000 });

  await googleCard.click();
  await expect(connectBtn).not.toBeVisible({ timeout: 3_000 });
});

test('email tab never shows a Create button after selecting a BYOD provider', async ({
  authedPage: page,
}) => {
  await openContactManager(page, emailUiAssistant);

  await expect(page.getByRole('button', { name: 'Create' })).toHaveCount(0);

  const googleCard = page.locator('button:has-text("Google")').last();
  await googleCard.click();

  await expect(page.getByRole('button', { name: 'Create' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible({ timeout: 5_000 });
});
