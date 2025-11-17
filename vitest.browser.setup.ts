import { setupWorker } from 'msw/browser';
import { handlers } from '@/tests/handlers';
import { beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { UserEvent } from '@testing-library/user-event';
import { http, passthrough } from 'msw';
import '@/styles/globals.css';

export const worker = setupWorker(...handlers);

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
  if (String(import.meta.env.VITE_TAKE_SCREENSHOTS) !== 'true' || !page) return;
  actionCounter++;
  const step = stepName === 'action' ? `action-${String(actionCounter).padStart(2, '0')}` : stepName;
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

afterEach(() => {
  worker.resetHandlers();
});