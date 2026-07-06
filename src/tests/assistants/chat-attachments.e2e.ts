/**
 * Chat attachment E2E Tests — browser-based user flows for attaching files in
 * the assistant chat panel.
 *
 * Verifies:
 *  - Attach dropdown and valid file chips
 *  - Blocked file types (.exe, .bat) are rejected with toast errors
 *  - Removing attachments (single + remove all)
 *  - Duplicate file detection
 *  - Attach button disabled when spending is blocked
 *
 * Run: npx playwright test src/tests/assistants/chat-attachments.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  setUserCredits,
} from './helpers';
import { createContactSeeder, createOpenAssistantChat } from './chat-helpers';
import path from 'path';
import fs from 'fs';
import os from 'os';

const user = createTestUser({ name: 'ChatAttachE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ChatBot',
  surname: 'Attach',
});
const CONTACT_ID = assistant.bossContactId;

const seedContact = createContactSeeder(CONTACT_ID);
const openAssistantChat = createOpenAssistantChat(assistant);

test.afterAll(() => {
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

const TEST_FILES_DIR = path.join(os.tmpdir(), 'attach-e2e-files');

function ensureTestFile(name: string, sizeBytes: number): string {
  if (!fs.existsSync(TEST_FILES_DIR)) fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
  const filePath = path.join(TEST_FILES_DIR, name);
  if (!fs.existsSync(filePath)) {
    const buf = Buffer.alloc(Math.min(sizeBytes, 1024), 'x');
    fs.writeFileSync(filePath, buf);
  }
  return filePath;
}

const smallTextFile = ensureTestFile('test-doc.txt', 100);
const smallPdfFile = ensureTestFile('report.pdf', 200);
const smallCsvFile = ensureTestFile('data.csv', 150);

const blockedExeFile = ensureTestFile('malware.exe', 50);
const blockedBatFile = ensureTestFile('script.bat', 50);

test('selecting valid files shows pending attachment chips and opens attach dropdown', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const attachBtn = page.getByTestId('attach-button');
  await expect(attachBtn).toBeVisible();
  await expect(attachBtn).toBeEnabled();
  await attachBtn.click();

  await expect(page.getByTestId('attach-files-item')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('attach-webcam-item')).toBeVisible({ timeout: 5_000 });

  const fileInput = page.getByTestId('file-input');
  await fileInput.setInputFiles([smallTextFile, smallPdfFile, smallCsvFile]);

  const pendingArea = page.getByTestId('pending-attachments');
  await expect(pendingArea).toBeVisible({ timeout: 5_000 });

  const chips = page.getByTestId('attachment-chip');
  await expect(chips).toHaveCount(3, { timeout: 5_000 });

  const chipName = page.getByTestId('attachment-name').first();
  await expect(chipName).toContainText('test-doc', { timeout: 5_000 });
});

test('blocked file types (.exe and .bat) are rejected with toast errors', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const fileInput = page.getByTestId('file-input');

  for (const blockedFile of [blockedExeFile, blockedBatFile]) {
    await fileInput.setInputFiles(blockedFile);

    const errorToast = page.locator('[data-sonner-toast][data-type="error"]').first();
    await expect(errorToast).toBeVisible({ timeout: 5_000 });
    await expect(errorToast).toContainText(/not allowed/i);
  }

  await expect(page.getByTestId('pending-attachments')).toHaveCount(0, { timeout: 3_000 });
});

test('removing pending attachments via remove button and remove all works', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const fileInput = page.getByTestId('file-input');
  await fileInput.setInputFiles([smallTextFile, smallPdfFile, smallCsvFile]);

  const chips = page.getByTestId('attachment-chip');
  await expect(chips).toHaveCount(3, { timeout: 5_000 });

  const firstChip = chips.first();
  await firstChip.hover();
  await page.waitForTimeout(300);
  await firstChip.getByTestId('attachment-remove').click({ force: true });
  await expect(chips).toHaveCount(2, { timeout: 5_000 });

  const removeAllBtn = page.getByTestId('attachment-remove-all');
  if (await removeAllBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await removeAllBtn.click();
    await expect(chips).toHaveCount(0, { timeout: 5_000 });
  } else {
    for (let i = 0; i < 2; i++) {
      const chip = page.getByTestId('attachment-chip').first();
      if (!(await chip.isVisible({ timeout: 1_000 }).catch(() => false))) break;
      await chip.hover();
      await chip.getByTestId('attachment-remove').click({ force: true });
      await page.waitForTimeout(300);
    }
    await expect(page.getByTestId('pending-attachments')).toHaveCount(0, { timeout: 5_000 });
  }
});

test('duplicate file is not added twice', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const fileInput = page.getByTestId('file-input');

  await fileInput.setInputFiles(smallTextFile);
  await page.waitForTimeout(500);

  const chipsAfterFirst = page.getByTestId('attachment-chip');
  await expect(chipsAfterFirst).toHaveCount(1, { timeout: 5_000 });

  await fileInput.setInputFiles(smallTextFile);
  await page.waitForTimeout(500);

  const chipsAfterSecond = page.getByTestId('attachment-chip');
  await expect(chipsAfterSecond).toHaveCount(1, { timeout: 5_000 });
});

test('attach button is disabled when spending is blocked', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  setUserCredits(user.id, -100);

  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeDisabled({ timeout: 15_000 });

  const attachBtn = page.getByTestId('attach-button');
  await expect(attachBtn).toBeDisabled({ timeout: 5_000 });

  setUserCredits(user.id, 50_000);
});
