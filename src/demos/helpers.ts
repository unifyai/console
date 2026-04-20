/**
 * Shared helpers for case-study workflow recordings.
 *
 * Key design principles:
 * - NEVER seed messages to DB during a recording (causes polling duplicates)
 * - NEVER click send in the chat (causes optimistic update duplicates)
 * - All real-time messages are DOM-injected only
 * - Polling is blocked after initial load to prevent React re-renders
 * - Photos are embedded as data URIs (static serving is unreliable)
 */

import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { orchestraFetch } from '../tests/helpers/seeds/client';

const CONSOLE_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const PHOTO_PATH = path.join(__dirname, '..', 'public', 'demos', 'aria-sterling.jpg');
const PROFILE_PHOTO_DATA_URI = fs.existsSync(PHOTO_PATH)
  ? `data:image/jpeg;base64,${fs.readFileSync(PHOTO_PATH).toString('base64')}`
  : '';

// =============================================================================
// Login & page setup
// =============================================================================

export async function loginAndNavigate(
  page: Page,
  email: string,
  _password: string,
  targetUrl: string
) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  const quickLoginPanel = page.getByTestId('dev-quick-login');
  await quickLoginPanel.waitFor({ state: 'visible', timeout: 20000 });

  const userBtn = quickLoginPanel.getByRole('button', { name: new RegExp(email) });
  await userBtn.waitFor({ state: 'visible', timeout: 10000 });
  await userBtn.click();

  await page.waitForURL((url) => url.pathname !== '/login' && !url.pathname.startsWith('/login?'), {
    timeout: 30000,
    waitUntil: 'domcontentloaded',
  });

  if (page.url().includes('/login/onboarding')) {
    const personalBtn = page.getByTestId('workspace-personal');
    if (await personalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await personalBtn.click();
      await page.getByTestId('workspace-continue').click();
      await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 15000,
        waitUntil: 'domcontentloaded',
      });
    }
  }

  await page.goto(targetUrl);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
}

export async function waitForChatReady(page: Page) {
  for (let pass = 0; pass < 3; pass++) {
    await page
      .waitForFunction(
        () => document.querySelectorAll('[data-testid="chat-skeleton"]').length === 0,
        { timeout: 10000 }
      )
      .catch(() => {});
    await page.waitForTimeout(1000);
  }
  await page
    .locator('textarea')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(1000);
}

export async function blockChatPolling(page: Page) {
  await page.route('**/api/logs**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ logs: [], count: 0 }),
      });
    } else {
      route.continue();
    }
  });
}

// =============================================================================
// Visual setup
// =============================================================================

export async function injectCursorOverlay(page: Page) {
  await page.addStyleTag({
    content: `
      #workflow-cursor {
        position: fixed; z-index: 999999;
        width: 24px; height: 24px;
        pointer-events: none;
        transition: left 0.3s cubic-bezier(0.25,0.1,0.25,1),
                    top 0.3s cubic-bezier(0.25,0.1,0.25,1);
      }
    `,
  });
  await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = 'workflow-cursor';
    cursor.style.left = '-100px';
    cursor.style.top = '-100px';
    cursor.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" fill="#000" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
    document.body.appendChild(cursor);
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    });
  });
}

export async function hideRecordingNoise(page: Page) {
  await page.addStyleTag({
    content: `.animate-pulse:has(svg) { display: none !important; }`,
  });
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      document.querySelectorAll('textarea').forEach((el) => {
        if (
          el.placeholder?.includes('unavailable') ||
          el.placeholder?.includes('Connection failed')
        ) {
          el.placeholder = 'Send a message...';
          el.disabled = false;
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
}

/**
 * Replace broken assistant avatar images with the data URI.
 * Handles both React-rendered (pre-seeded) and DOM-injected avatars.
 */
export async function fixAvatarPhotos(page: Page) {
  if (!PROFILE_PHOTO_DATA_URI) return;
  await page.evaluate((dataUri) => {
    function fix() {
      document.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src') || '';
        if (src.includes('aria-sterling')) {
          if (!src.startsWith('data:')) {
            img.src = dataUri;
          }
        }
        if ((img.alt === 'Aria Sterling' || img.alt === 'AS') && !img.src.startsWith('data:')) {
          img.src = dataUri;
        }
      });
    }
    fix();
    const obs = new MutationObserver(fix);
    obs.observe(document.body, { childList: true, subtree: true });
  }, PROFILE_PHOTO_DATA_URI);
}

/**
 * Zoom in on the chat area by hiding sidebar, top nav, and tab bar.
 */
export async function zoomOnChat(page: Page) {
  await page.addStyleTag({
    content: `
      /* Hide the fixed top navigation bar */
      div.fixed.left-0.right-0.top-0.z-50.h-10,
      div.fixed.left-0.right-0.top-0.z-40.h-10 {
        display: none !important;
      }
      /* Reclaim the top offset on main */
      main.relative.top-10 {
        top: 0 !important;
        height: 100vh !important;
      }
      main[class*="top-10"] {
        top: 0 !important;
        height: 100vh !important;
      }
      /* Hide the sidebar (1st child) and resize handle (2nd child) */
      main .flex.min-h-0.flex-1.overflow-hidden.bg-background > div:nth-child(1),
      main .flex.min-h-0.flex-1.overflow-hidden.bg-background > div:nth-child(2) {
        display: none !important;
      }
      /* Hide the tab bar (Chat/Actions/etc.) */
      [role="tablist"]:has([data-testid="right-pane-tab-chat"]) {
        display: none !important;
      }
      /* Hide the "Chat with..." header and its surrounding border-b container */
      div.flex.items-center.justify-between.border-b:has([data-testid="chat-search-trigger"]) {
        display: none !important;
      }
      /* Ensure chat / actions panel fills viewport */
      [data-testid="chat-scroll-area"],
      [data-testid="live-actions-viewer"],
      [data-testid="live-actions-scroll-container"] {
        width: 100% !important;
        max-width: 100% !important;
      }
    `,
  });
}

export async function setupRecordingRoutes(page: Page) {
  await page.route('**/api/storage/signed-url', async (route) => {
    try {
      const body = JSON.parse(route.request().postData() || '{}');
      const gsUrl: string = body.gs_url || '';
      const filename = gsUrl.split('/').pop() || '';
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        body: JSON.stringify({ signed_url: `http://localhost:3000/demos/${filename}` }),
      });
    } catch {
      route.continue();
    }
  });

  await page.route('**/api/storage/content**', async (route) => {
    try {
      const body = JSON.parse(route.request().postData() || '{}');
      const gsUrl: string = body.gs_url || '';
      const filename = gsUrl.split('/').pop() || '';
      const filePath = `/tmp/orchestra-media/${filename}`;
      if (fs.existsSync(filePath)) {
        route.fulfill({
          status: 200,
          contentType: 'application/octet-stream',
          body: fs.readFileSync(filePath),
        });
      } else {
        route.continue();
      }
    } catch {
      route.continue();
    }
  });
}

export async function moveTo(page: Page, selector: string, opts?: { click?: boolean }) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 10000 });
  const box = await el.boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 20 });
  await page.waitForTimeout(300);
  if (opts?.click) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(200);
  }
}

// =============================================================================
// Data seeding (ONLY for pre-loading BEFORE page load)
// =============================================================================

interface SeedLogOpts {
  apiKey: string;
  userId: string;
  assistantId: number;
}

export async function seedLogEntry(
  opts: SeedLogOpts,
  context: string,
  entry: Record<string, unknown>
): Promise<void> {
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        project_name: 'Assistants',
        context: `${opts.userId}/${opts.assistantId}/${context}`,
        entries: [entry],
      }),
    },
    opts.apiKey
  );
  if (!res.ok) throw new Error(`Failed to seed ${context}: ${res.status}`);
}

export async function pushActionEvent(
  assistantId: number,
  type: 'ManagerMethod' | 'ToolLoop',
  entries: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${CONSOLE_BASE_URL}/api/assistant/${assistantId}/actions/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      data: { id: Date.now(), ts: new Date().toISOString(), entries },
    }),
  });
  if (!res.ok) throw new Error(`Failed to push ${type} event: ${res.status}`);
}

export async function preseedMessage(
  opts: SeedLogOpts,
  message: Record<string, unknown>
): Promise<void> {
  await seedLogEntry(opts, 'Transcripts', message);
}

// =============================================================================
// DOM injection
// =============================================================================

function mdToHtml(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n- /g, '\n<br/>• ')
    .replace(/\n/g, '<br/>');
}

export interface AttachmentData {
  id: string;
  filename: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  content_type: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  size_bytes: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  gs_url: string;
}

export async function injectAssistantBubble(
  page: Page,
  content: string,
  attachments?: AttachmentData[]
): Promise<void> {
  const assistantName = 'Aria Sterling';
  const photoDataUri = PROFILE_PHOTO_DATA_URI;

  const attachmentHtml = (attachments || [])
    .map(
      (att) =>
        `<div data-testid="attachment-chip" style="display:inline-flex;align-items:center;gap:6px;border-radius:6px;border:1px solid hsl(var(--border));padding:6px 10px;font-size:13px;cursor:pointer;transition:all 0.15s;background:transparent;color:inherit;"
      onmouseover="this.style.background='hsl(142,72%,29%)';this.style.color='white';this.style.borderColor='hsl(142,72%,29%)';"
      onmouseout="this.style.background='transparent';this.style.color='inherit';this.style.borderColor='hsl(var(--border))';">
      <svg style="width:16px;height:16px;flex-shrink:0;opacity:0.7" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${att.filename}</span>
    </div>`
    )
    .join('');

  const attachmentBlock = attachmentHtml
    ? `<div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;">${attachmentHtml}</div>`
    : '';

  await page.evaluate(
    ({ html, name, photo, attBlock }) => {
      const scrollArea = document.querySelector('[data-testid="chat-scroll-area"]');
      if (!scrollArea) return;
      const container =
        scrollArea.querySelector('.space-y-6') ||
        scrollArea.querySelector('[class*="space-y"]') ||
        scrollArea;

      const bubble = document.createElement('div');
      bubble.setAttribute('data-testid', 'message-bubble');
      bubble.setAttribute('data-role', 'assistant');
      bubble.className = 'min-w-0';
      bubble.innerHTML = `
      <div class="mb-2.5 flex items-center gap-2">
        <span class="relative flex shrink-0 overflow-hidden rounded-full h-6 w-6 border">
          ${photo ? `<img class="aspect-square h-full w-full object-cover" src="${photo}" alt="${name}" />` : `<span class="flex h-full w-full items-center justify-center text-[10px] font-medium bg-muted text-muted-foreground">AS</span>`}
        </span>
        <span class="text-sm font-medium text-muted-foreground">${name}</span>
      </div>
      ${attBlock}
      <div class="min-w-0 break-words font-sans text-sm leading-relaxed">
        <div class="prose prose-sm max-w-none dark:prose-invert">${html}</div>
      </div>
    `;
      container.appendChild(bubble);
      bubble.scrollIntoView({ behavior: 'smooth' });
    },
    { html: mdToHtml(content), name: assistantName, photo: photoDataUri, attBlock: attachmentBlock }
  );
}

export async function injectUserBubble(page: Page, content: string): Promise<void> {
  await page.evaluate((text) => {
    const scrollArea = document.querySelector('[data-testid="chat-scroll-area"]');
    if (!scrollArea) return;
    const container =
      scrollArea.querySelector('.space-y-6') ||
      scrollArea.querySelector('[class*="space-y"]') ||
      scrollArea;

    const bubble = document.createElement('div');
    bubble.setAttribute('data-testid', 'message-bubble');
    bubble.setAttribute('data-role', 'user');
    bubble.className = 'flex min-w-0 justify-end';
    bubble.innerHTML = `
      <div class="flex min-w-0 flex-col gap-2 max-w-[75%]">
        <div class="break-words rounded-lg p-2.5 font-sans text-sm leading-snug bg-primary text-primary-foreground">
          <div class="whitespace-pre-wrap">${text}</div>
        </div>
      </div>
    `;
    container.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth' });
  }, content);
}

// =============================================================================
// Recording interaction helpers
// =============================================================================

export async function typeAndSendMessage(
  page: Page,
  text: string,
  charDelayMs = 30
): Promise<void> {
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 10000 });

  await moveTo(page, 'textarea', { click: true });
  await page.waitForTimeout(300);

  await textarea.pressSequentially(text, { delay: charDelayMs });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const ta = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!ta) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    nativeSetter?.call(ta, '');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(100);

  await injectUserBubble(page, text);
  await page.waitForTimeout(500);
}

export async function showTypingThenReply(
  page: Page,
  content: string,
  typingDurationMs = 3000,
  attachments?: AttachmentData[]
): Promise<void> {
  const assistantName = 'Aria Sterling';
  const photoDataUri = PROFILE_PHOTO_DATA_URI;

  await page.evaluate(
    ({ name, photo }) => {
      const scrollArea = document.querySelector('[data-testid="chat-scroll-area"]');
      if (!scrollArea) return;
      const container =
        scrollArea.querySelector('.space-y-6') ||
        scrollArea.querySelector('[class*="space-y"]') ||
        scrollArea;

      const bubble = document.createElement('div');
      bubble.id = 'workflow-typing-indicator';
      bubble.setAttribute('data-testid', 'message-bubble');
      bubble.setAttribute('data-role', 'assistant');
      bubble.className = 'min-w-0';
      bubble.innerHTML = `
      <div class="mb-2.5 flex items-center gap-2">
        <span class="relative flex shrink-0 overflow-hidden rounded-full h-6 w-6 border">
          ${photo ? `<img class="aspect-square h-full w-full object-cover" src="${photo}" alt="${name}" />` : `<span class="flex h-full w-full items-center justify-center text-[10px] font-medium bg-muted text-muted-foreground">AS</span>`}
        </span>
        <span class="text-sm font-medium text-muted-foreground">${name}</span>
      </div>
      <div class="min-w-0 break-words font-sans text-sm leading-relaxed">
        <div class="text-muted-foreground flex items-center gap-1.5">
          <span class="text-xs">Typing</span>
          <span class="flex items-center gap-0.5">
            <span class="h-1 w-1 animate-bounce rounded-full bg-current opacity-60" style="animation-delay:-0.3s"></span>
            <span class="h-1 w-1 animate-bounce rounded-full bg-current opacity-60" style="animation-delay:-0.15s"></span>
            <span class="h-1 w-1 animate-bounce rounded-full bg-current opacity-60"></span>
          </span>
        </div>
      </div>
    `;
      container.appendChild(bubble);
      bubble.scrollIntoView({ behavior: 'smooth' });
    },
    { name: assistantName, photo: photoDataUri }
  );

  await page.waitForTimeout(typingDurationMs);

  await page.evaluate(() => {
    document.getElementById('workflow-typing-indicator')?.remove();
  });

  await injectAssistantBubble(page, content, attachments);
  await page.waitForTimeout(800);
}

// =============================================================================
// File helpers
// =============================================================================

export function createLocalAttachment(
  filename: string,
  content: string | Buffer
): { gsUrl: string } {
  const mediaDir = '/tmp/orchestra-media';
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.writeFileSync(path.join(mediaDir, filename), content);

  const publicDir = path.join(__dirname, '..', 'public', 'demos');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, filename), content);

  return { gsUrl: `gs://bucket/${filename}` };
}

export async function showFilePreview(
  page: Page,
  htmlContent: string,
  scrollDurationMs = 6000
): Promise<void> {
  await page.evaluate((html) => {
    const overlay = document.createElement('div');
    overlay.id = 'workflow-file-preview';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s;';
    const frame = document.createElement('div');
    frame.style.cssText =
      'width:75%;height:82%;background:white;border-radius:12px;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,0.3);display:flex;flex-direction:column;';
    const titleBar = document.createElement('div');
    titleBar.style.cssText =
      'height:40px;background:#f5f5f5;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;padding:0 16px;flex-shrink:0;';
    titleBar.innerHTML =
      '<span style="font-size:13px;color:#666;font-family:system-ui">Sterling_Valuation_45Moorgate_Draft.html</span>';
    const iframe = document.createElement('iframe');
    iframe.id = 'workflow-preview-iframe';
    iframe.srcdoc = html;
    iframe.style.cssText = 'width:100%;flex:1;border:none;';
    frame.appendChild(titleBar);
    frame.appendChild(iframe);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });
  }, htmlContent);

  await page.waitForTimeout(1500);

  const scrollSteps = 8;
  const stepDelay = scrollDurationMs / scrollSteps;
  for (let i = 0; i < scrollSteps; i++) {
    await page.evaluate((step) => {
      const iframe = document.getElementById('workflow-preview-iframe') as HTMLIFrameElement;
      if (!iframe?.contentDocument) return;
      const docEl = iframe.contentDocument.documentElement;
      const maxScroll = docEl.scrollHeight - docEl.clientHeight;
      const target = (maxScroll * (step + 1)) / 8;
      docEl.scrollTo({ top: target, behavior: 'smooth' });
    }, i);
    await page.waitForTimeout(stepDelay);
  }

  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const overlay = document.getElementById('workflow-file-preview');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }
  });
  await page.waitForTimeout(500);
}

// =============================================================================
// Action tree
// =============================================================================

/**
 * Click "Expand All" if the button currently says "Expand".
 * Bails immediately (no cursor movement) if already collapsed/expanded.
 */
export async function clickExpandAll(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="live-actions-expand-collapse"]');
  if (!(await btn.isVisible({ timeout: 2000 }).catch(() => false))) return;

  const text = await btn.textContent();
  if (!text?.includes('Expand')) return;

  const box = await btn.boundingBox();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(600);
}

/**
 * Remove all injected workflow content from the action tree and scroll
 * the tree back to top so all headers are visible.
 */
export async function clearInjectedContent(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('.workflow-injected-content').forEach((el) => el.remove());
    const sc = document.querySelector('[data-testid="live-actions-scroll-container"]');
    if (sc) sc.scrollTop = 0;
  });
}

/**
 * Scroll the action tree so that the node matching `labelSubstring`
 * is visible. Works with both nest nodes and root action nodes.
 */
export async function scrollActionHeaderIntoView(
  page: Page,
  labelSubstring: string
): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const found = await page.evaluate((label) => {
      const sc = document.querySelector(
        '[data-testid="live-actions-scroll-container"]'
      ) as HTMLElement | null;

      const doScroll = (el: HTMLElement) => {
        if (!sc) {
          el.scrollIntoView({ block: 'start' });
          return;
        }
        const headerTop = el.getBoundingClientRect().top;
        const scTop = sc.getBoundingClientRect().top;
        const target = sc.scrollTop + (headerTop - scTop) - 12;
        sc.scrollTop = target;
        // Lock: snap back every time React auto-scrolls for 2 seconds
        const handler = () => {
          sc.scrollTop = target;
        };
        sc.addEventListener('scroll', handler);
        setTimeout(() => sc.removeEventListener('scroll', handler), 2000);
      };

      const nestNodes = Array.from(document.querySelectorAll('[data-tc-role="nest"]'));
      for (const nest of nestNodes) {
        const headerRow = nest.querySelector('.flex.items-center') as HTMLElement | null;
        if (!headerRow) continue;
        if (!(headerRow.textContent || '').includes(label)) continue;
        doScroll(headerRow);
        return true;
      }

      const nodes = Array.from(document.querySelectorAll('[data-testid="action-node"]'));
      for (const node of nodes) {
        const header = (node.querySelector('[data-testid="expand-button"]') ||
          node.children[0]) as HTMLElement | null;
        if (!header) continue;
        if (!(header.textContent || '').includes(label)) continue;
        doScroll(header);
        return true;
      }
      return false;
    }, labelSubstring);

    if (found) return;
    await page.waitForTimeout(500);
  }
}

/**
 * Inject visual content (images, text) below a specific action node header.
 *
 * Child action nodes are rendered as inline synthetic entries inside the
 * parent's timeline with `data-tc-role="nest"`, NOT as separate
 * `[data-testid="action-node"]` elements. This function handles both:
 *   1. Root-level nodes (`[data-testid="action-node"]`) — matches header row
 *   2. Inline child nodes (`[data-tc-role="nest"]`) — matches label span
 */
export async function injectActionContent(
  page: Page,
  labelSubstring: string,
  contentHtml: string
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const found = await page.evaluate(
      ({ label, html }) => {
        if (!document.getElementById('workflow-inject-style')) {
          const s = document.createElement('style');
          s.id = 'workflow-inject-style';
          s.textContent =
            '@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }';
          document.head.appendChild(s);
        }

        // Remove ALL previous injected content so only the active step shows
        document.querySelectorAll('.workflow-injected-content').forEach((el) => el.remove());

        const makeContainer = () => {
          const c = document.createElement('div');
          c.className = 'workflow-injected-content';
          c.style.cssText =
            'padding: 16px 0 12px 16px; overflow: visible; animation: fadeIn 0.4s ease;';
          c.innerHTML = html;
          return c;
        };

        const sc = document.querySelector(
          '[data-testid="live-actions-scroll-container"]'
        ) as HTMLElement | null;

        // After appending, scroll the header into view and lock position
        const scrollAndLock = (headerEl: HTMLElement) => {
          if (!sc) return;
          const headerTop = headerEl.getBoundingClientRect().top;
          const scTop = sc.getBoundingClientRect().top;
          const target = sc.scrollTop + (headerTop - scTop) - 12;
          sc.scrollTop = target;
          const handler = () => {
            sc.scrollTop = target;
          };
          sc.addEventListener('scroll', handler);
          setTimeout(() => sc.removeEventListener('scroll', handler), 2000);
        };

        // Strategy 1: inline child nodes (data-tc-role="nest")
        const nestNodes = Array.from(document.querySelectorAll('[data-tc-role="nest"]'));
        for (const nest of nestNodes) {
          const headerRow = nest.querySelector('.flex.items-center') as HTMLElement | null;
          if (!headerRow) continue;
          const rowText = headerRow.textContent || '';
          if (!rowText.includes(label)) continue;

          nest.appendChild(makeContainer());
          scrollAndLock(headerRow);
          return true;
        }

        // Strategy 2: root-level action nodes
        const nodes = Array.from(document.querySelectorAll('[data-testid="action-node"]'));
        for (const node of nodes) {
          const header = (node.querySelector('[data-testid="expand-button"]') ||
            node.children[0]) as HTMLElement | null;
          if (!header) continue;
          const headerText = header.textContent || '';
          if (!headerText.includes(label)) continue;

          const container = makeContainer();
          if (header.nextSibling) {
            node.insertBefore(container, header.nextSibling);
          } else {
            node.appendChild(container);
          }
          scrollAndLock(header);
          return true;
        }

        return false;
      },
      { label: labelSubstring, html: contentHtml }
    );

    if (found) return;
    await page.waitForTimeout(500);
  }
}

// =============================================================================
// Video post-processing
// =============================================================================

/**
 * Write timing markers for post-processing (trimming) by globalTeardown.
 * Call this near the end of each test with the wall-clock timestamps
 * for the start and end of the "interesting" part of the recording.
 */
export function writeMarkers(
  outputDir: string,
  testStartMs: number,
  contentStartMs: number,
  contentEndMs: number
): void {
  fs.mkdirSync(outputDir, { recursive: true });
  const markersPath = path.join(outputDir, 'markers.json');
  fs.writeFileSync(
    markersPath,
    JSON.stringify({
      startSec: (contentStartMs - testStartMs) / 1000,
      endSec: (contentEndMs - testStartMs) / 1000,
    })
  );
}
