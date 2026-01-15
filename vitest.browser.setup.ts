import { setupWorker } from 'msw/browser';
import { handlers } from '@/tests/handlers';
import { beforeAll, beforeEach, afterEach, vi } from 'vitest';
// ⚠️ DO NOT CHANGE THIS IMPORT TO 'vitest/browser' ⚠️
// The new import path breaks CI - see commit 5719e842 which reverted it.
// The deprecation warning is harmless; the import itself causes test failures.
import { page } from '@vitest/browser/context';
import { UserEvent } from '@testing-library/user-event';
import { http, passthrough } from 'msw';
import '@/styles/globals.css';

export const worker = setupWorker(...handlers);

// ════════════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER FOR PLAYWRIGHT ROUTE RACE CONDITION
// ════════════════════════════════════════════════════════════════════════════════
// This suppresses the "route.fulfill: The object has been collected" error that
// occurs when MSW tries to fulfill a route after Playwright has garbage collected
// the route object during test teardown. This is a known issue:
// https://github.com/vitest-dev/vitest/issues/7290
//
// The error is harmless - it just means a network response wasn't delivered to a
// page that was already being destroyed. Suppressing it prevents CI failures.
// ════════════════════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason?.message?.includes('The object has been collected') ||
      event.reason?.message?.includes('route.fulfill')
    ) {
      event.preventDefault();
      // Silently suppress - this is expected during test teardown
    }
  });
}

// === Event-based screenshot logic ===
let currentTestName = '';
let actionCounter = 0;

const slugify = (text: string): string => {
  return text
    .replace(/\s*>\s*/g, '-')
    .replace(/[^a-z0-9_-]/gi, '_')
    .toLowerCase();
};

const takeActionScreenshot = async (stepName = 'action') => {
  if (process.env.VITE_TAKE_SCREENSHOTS !== 'true' || !page) return;
  actionCounter++;
  const step =
    stepName === 'action' ? `action-${String(actionCounter).padStart(2, '0')}` : stepName;
  const fileName = `${currentTestName}-${step}.png`;
  await page.screenshot({ fullPage: true, path: `./screenshots/${fileName}` });
};

beforeEach(async (context) => {
  actionCounter = 0;
  const customAlias = context.task.meta?.alias;
  if (customAlias) {
    currentTestName = slugify(customAlias);
  } else {
    const testPath = [];
    let current = context.task;
    while (current?.name) {
      testPath.unshift(current.name);
      current = current.suite as any;
    }
    currentTestName = slugify(testPath.join(' > '));
  }
});

vi.mock('@testing-library/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@testing-library/react')>();
  return {
    ...actual,
    render: (...args: Parameters<typeof actual.render>) => {
      const result = actual.render(...args);
      Promise.resolve().then(() => takeActionScreenshot('initial-render'));
      return result;
    },
  };
});

vi.mock('@testing-library/user-event', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@testing-library/user-event')>();
  const createWrappedUserEvent = (userEventInstance: UserEvent): UserEvent => {
    const wrapped = {} as UserEvent;
    for (const key of Object.keys(userEventInstance) as (keyof UserEvent)[]) {
      const originalMethod = userEventInstance[key];
      if (typeof originalMethod === 'function') {
        // @ts-expect-error
        wrapped[key] = async (...args: any[]) => {
          const result = await originalMethod(...args);
          await takeActionScreenshot('action');
          return result;
        };
      } else {
        // @ts-expect-error
        wrapped[key] = originalMethod;
      }
    }
    return wrapped;
  };
  return {
    ...actual,
    default: {
      ...actual.default,
      setup: (...args: any[]) => {
        const userEventInstance = actual.default.setup(...args);
        return createWrappedUserEvent(userEventInstance);
      },
    },
  };
});

// === Test Callbacks ===
beforeAll(async () => {
  vi.clearAllMocks();
  if (page) {
    await page.viewport(1280, 720);
  }
  await worker.start({ onUnhandledRequest: 'bypass' });
});

beforeEach(async (context) => {
  const shouldMock = context.task.meta?.mock ?? true;
  if (worker && shouldMock === false) {
    worker.use(
      http.all('*', () => {
        return passthrough();
      })
    );
  }
});

afterEach(async () => {
  // Wait for pending network requests to complete before teardown.
  // This prevents the race condition where MSW tries to call route.fulfill()
  // after Playwright has garbage collected the route object.
  // See: https://github.com/vitest-dev/vitest/issues/7290
  if (page) {
    try {
      // Delay to allow pending MSW handlers to complete their route.fulfill() calls
      // before the page context is torn down. 250ms provides sufficient margin under
      // heavy CPU contention in CI sharded runs. Combined with the global unhandled
      // rejection handler above, this should prevent all route.fulfill race conditions.
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch {
      // Ignore errors if page is already closed
    }
  }
  worker.resetHandlers();
});
