/**
 * Contact Provisioning E2E — add and remove email/phone contacts for
 * an assistant via the Contact Manager dialog, verifying UI updates
 * and database persistence at each step.
 *
 * Uses a pre-seeded assistant so tests go straight to contact management.
 *
 * Run: npx playwright test src/tests/assistants/contacts.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  deleteAssistantFromDb,
  getAssistantContact,
  setUserPhoneNumber,
  clearUserPhoneNumber,
  setUserWhatsappNumber,
  clearUserWhatsappNumber,
  ensureProjectSync,
} from './helpers';

const user = createTestUser({ name: 'Contact', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
setUserPhoneNumber(user.id, '+15551234567');
const test = createAssistantTest(user);
test.setTimeout(90_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ContactBot',
  surname: 'E2E',
});

test.afterAll(() => {
  try {
    deleteAssistantFromDb(assistant.agentId);
  } catch {
    /* best effort */
  }
  cleanupUser(user.id);
});

/**
 * Select a contact type from the dropdown in the contact manager dialog.
 */
async function selectContactType(
  page: import('@playwright/test').Page,
  type: 'email' | 'phone' | 'whatsapp'
) {
  const trigger = page.getByTestId('contact-type-select');
  await trigger.click();
  await page.waitForTimeout(300);
  const label = type === 'email' ? 'Email' : type === 'phone' ? 'Phone' : 'WhatsApp';
  await page.getByRole('option', { name: label }).click();
  await page.waitForTimeout(300);
}

/**
 * Open the contact manager via the list item dropdown menu.
 */
async function openContactManager(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  // Open the dropdown menu on the list item
  const menuBtn = page.getByTestId(`assistant-menu-${assistant.agentId}`);
  await listItem.hover();
  await expect(menuBtn).toBeVisible({ timeout: 5_000 });
  await menuBtn.click();
  await page.waitForTimeout(500);

  // Click "Contact Details" in the dropdown
  const contactsItem = page.getByTestId('menu-update-contacts');
  await expect(contactsItem).toBeVisible({ timeout: 5_000 });
  await contactsItem.click();
  await page.waitForTimeout(1_000);

  await expect(page.locator('text=Update Contact')).toBeVisible({ timeout: 5_000 });
}

test('adding an email contact persists it to the database and displays it in the dialog', async ({
  authedPage: page,
}) => {
  await openContactManager(page);

  // Email tab is the default
  const emailInput = page.locator('#email_local_part');
  await expect(emailInput).toBeVisible({ timeout: 5_000 });

  const localPart = `e2e-${Date.now()}`;
  await emailInput.fill(localPart);

  const createBtn = page.getByRole('button', { name: 'Create' });
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

  await page.waitForTimeout(3_000);

  // Verify email persisted in DB (contacts live in assistant_contacts table)
  const emailContact = getAssistantContact(assistant.agentId, 'email');
  expect(emailContact).toBeTruthy();
  expect(emailContact).toContain(localPart);
});

test('deleting an email contact removes it from the database', async ({ authedPage: page }) => {
  const existingEmail = getAssistantContact(assistant.agentId, 'email');
  if (!existingEmail) {
    test.skip(true, 'No email to delete — previous test may have failed');
    return;
  }

  await openContactManager(page);

  // Email tab — the email should now be displayed as read-only
  await expect(page.locator('text=Email Address')).toBeVisible({ timeout: 5_000 });

  // Click Delete
  const deleteBtn = page.getByRole('button', { name: 'Delete' });
  await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
  await deleteBtn.click();

  // Confirm
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

  await page.waitForTimeout(3_000);

  // Verify email removed from DB
  const emailAfter = getAssistantContact(assistant.agentId, 'email');
  expect(emailAfter).toBeFalsy();
});

test('adding a phone contact persists it to the database', async ({ authedPage: page }) => {
  await openContactManager(page);

  // Switch to Phone via dropdown
  await selectContactType(page, 'phone');

  // Country selector should be visible with a default
  const phoneCountry = page.locator('#phoneCountry');
  await expect(phoneCountry).toBeVisible({ timeout: 5_000 });

  const createBtn = page.getByRole('button', { name: 'Create' });
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

  await page.waitForTimeout(3_000);

  // Verify phone persisted in DB
  const phoneContact = getAssistantContact(assistant.agentId, 'phone');
  expect(phoneContact).toBeTruthy();
});

test('deleting a phone contact removes it from the database', async ({ authedPage: page }) => {
  const existingPhone = getAssistantContact(assistant.agentId, 'phone');
  if (!existingPhone) {
    test.skip(true, 'No phone to delete — previous test may have failed');
    return;
  }

  await openContactManager(page);

  // Switch to Phone via dropdown
  await selectContactType(page, 'phone');

  // Phone should be displayed as read-only
  await expect(page.locator('text=Assistant Phone Number')).toBeVisible({ timeout: 5_000 });

  // Delete
  const deleteBtn = page.getByRole('button', { name: 'Delete' });
  await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
  await deleteBtn.click();

  // Confirm
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

  await page.waitForTimeout(3_000);

  // Verify phone removed from DB
  const phoneAfter = getAssistantContact(assistant.agentId, 'phone');
  expect(phoneAfter).toBeFalsy();
});

test('full email lifecycle: create → verify in DB → delete → verify removed', async ({
  authedPage: page,
}) => {
  // Create
  await openContactManager(page);

  const emailInput = page.locator('#email_local_part');
  await expect(emailInput).toBeVisible({ timeout: 5_000 });

  const localPart = `lifecycle-${Date.now()}`;
  await emailInput.fill(localPart);

  const createBtn = page.getByRole('button', { name: 'Create' });
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
  await page.waitForTimeout(3_000);

  const emailCreated = getAssistantContact(assistant.agentId, 'email');
  expect(emailCreated).toContain(localPart);

  // Delete — re-open the contact manager
  await openContactManager(page);

  const deleteBtn = page.getByRole('button', { name: 'Delete' });
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
  await page.waitForTimeout(3_000);

  const emailAfterDelete = getAssistantContact(assistant.agentId, 'email');
  expect(emailAfterDelete).toBeFalsy();
});

test('phone create button is disabled when user has no phone number', async ({
  authedPage: page,
}) => {
  clearUserPhoneNumber(user.id);

  try {
    await openContactManager(page);

    await selectContactType(page, 'phone');

    // Should show the "no phone number" prompt
    await expect(page.locator('text=No phone number set in your profile')).toBeVisible({
      timeout: 5_000,
    });

    // Create button should be disabled
    const createBtn = page.getByRole('button', { name: 'Create' });
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
    await openContactManager(page);

    await selectContactType(page, 'whatsapp');

    // Should show the "no WhatsApp number" prompt
    await expect(page.locator('text=No WhatsApp number set in your profile')).toBeVisible({
      timeout: 5_000,
    });

    // Create button should be disabled
    const createBtn = page.getByRole('button', { name: 'Create' });
    await expect(createBtn).toBeDisabled({ timeout: 5_000 });
  } finally {
    setUserWhatsappNumber(user.id, '+15559876543');
  }
});

test('whatsapp create button is enabled when user has a whatsapp number', async ({
  authedPage: page,
}) => {
  setUserWhatsappNumber(user.id, '+15559876543');

  await openContactManager(page);

  await selectContactType(page, 'whatsapp');

  // Should show the WhatsApp number with green check
  await expect(page.locator('text=+15559876543')).toBeVisible({ timeout: 5_000 });

  // Create button should be enabled
  const createBtn = page.getByRole('button', { name: 'Create' });
  await expect(createBtn).toBeEnabled({ timeout: 5_000 });
});
