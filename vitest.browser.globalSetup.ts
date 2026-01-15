/**
 * Global setup for browser tests - runs in Node.js context before any tests.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * GLOBAL ERROR HANDLER FOR PLAYWRIGHT ROUTE RACE CONDITION
 * ════════════════════════════════════════════════════════════════════════════════
 * This suppresses the "route.fulfill: The object has been collected" error that
 * occurs when MSW tries to fulfill a route after Playwright has garbage collected
 * the route object during test teardown.
 *
 * The error originates in @vitest/browser-playwright (Node.js side), not the browser.
 * It's a race condition between test teardown and pending network request fulfillment.
 *
 * The error is harmless - it means a network response couldn't be delivered to a
 * page that was already being destroyed. Suppressing it prevents CI shard failures.
 * ════════════════════════════════════════════════════════════════════════════════
 */

export function setup() {
  process.on('unhandledRejection', (reason: any) => {
    const message = reason?.message || String(reason);

    // Suppress the specific Playwright route race condition error
    if (message.includes('The object has been collected') || message.includes('route.fulfill')) {
      // Silently suppress - this is expected during test teardown under load
      return;
    }

    // Re-throw other unhandled rejections so they're not silently swallowed
    throw reason;
  });
}

export function teardown() {
  // No cleanup needed - process handlers are removed when process exits
}
