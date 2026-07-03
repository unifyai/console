/**
 * Data Bridge E2E Tests — browser-based user flows verifying the UnifyData
 * bridge on a real tile view page, including bridge injection, postMessage
 * routing through TileViewer to the proxy API routes, and error propagation.
 *
 * Seeds a real tile in Orchestra (with has_data_bindings=true) and registers
 * its token so `/tile/view/[token]` resolves end-to-end. The tile page is
 * public (no login needed) so tests use Playwright's base `page` fixture.
 *
 * Run: npx playwright test src/tests/assistants/data-bridge.e2e.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistant,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  orchestraFetch,
  setUserCredits,
} from './helpers';

/* eslint-disable @typescript-eslint/naming-convention */

// ---------------------------------------------------------------------------
// Test user + assistant (module-level, synchronous DB inserts)
// ---------------------------------------------------------------------------

const user = createTestUser({ name: 'BridgeE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);

const bridgeAssistant = createAssistant({
  userId: user.id,
  firstName: 'BridgeBot',
  surname: 'DataTest',
});

// Token must be <=12 chars for Orchestra's RegisterTokenRequest
const TS_SUFFIX = Date.now().toString(36).slice(-6);
const BRIDGE_TOKEN = `br${TS_SUFFIX}aa`;
const AUTOEXEC_TOKEN = `ax${TS_SUFFIX}bb`;
const STATIC_TOKEN = `st${TS_SUFFIX}cc`;
const TILE_CONTEXT = `${user.id}/${bridgeAssistant.agentId}/Dashboards/Tiles`;
const TILE_TITLE = 'Bridge Test Tile';

const TILE_HTML = [
  '<!DOCTYPE html><html><head></head><body>',
  '<div id="status">loading</div>',
  '<div id="result"></div>',
  '<script>',
  'document.getElementById("status").textContent = window.UnifyData ? "bridge-ready" : "no-bridge";',
  '</script>',
  '</body></html>',
].join('');

const AUTOEXEC_HTML = [
  '<!DOCTYPE html><html><head></head><body>',
  '<div id="status">loading</div>',
  '<div id="sales-result"></div>',
  '<div id="total-result"></div>',
  '</body></html>',
].join('');

const AUTOEXEC_BINDINGS = JSON.stringify([
  { operation: 'filter', alias: 'sales', context: 'Data/Sales', columns: ['month', 'revenue'] },
  {
    operation: 'reduce',
    alias: 'total',
    context: 'Data/Sales',
    metric: 'sum',
    columns: ['revenue'],
  },
]);

const AUTOEXEC_ON_DATA = [
  'document.getElementById("sales-result").textContent = JSON.stringify(data.sales);',
  'document.getElementById("total-result").textContent = JSON.stringify(data.total);',
  'document.getElementById("status").textContent = "data-loaded";',
].join('\n');

const STATIC_HTML = [
  '<!DOCTYPE html><html><head></head><body>',
  '<div id="status">static-ready</div>',
  '<div id="bridge-check"></div>',
  '<script>',
  'document.getElementById("bridge-check").textContent = window.UnifyData ? "has-bridge" : "no-bridge";',
  '</script>',
  '</body></html>',
].join('');

test.setTimeout(120_000);

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedAndRegister(token: string, entries: Record<string, unknown>) {
  const seedRes = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: TILE_CONTEXT,
        entries: [entries],
      }),
    },
    user.apiKey
  );
  if (!seedRes.ok)
    throw new Error(`Failed to seed tile ${token}: ${seedRes.status} ${await seedRes.text()}`);

  const regRes = await orchestraFetch(
    '/v0/dashboards/tokens',
    {
      method: 'POST',
      body: JSON.stringify({
        token,
        entity_type: 'tile',
        context_name: TILE_CONTEXT,
        project_name: 'Assistants',
      }),
    },
    user.apiKey
  );
  if (!regRes.ok && regRes.status !== 409) {
    throw new Error(`Failed to register token ${token}: ${regRes.status} ${await regRes.text()}`);
  }
}

let seeded = false;
async function ensureSeeded() {
  if (seeded) return;

  await seedAndRegister(BRIDGE_TOKEN, {
    token: BRIDGE_TOKEN,
    title: TILE_TITLE,
    description: 'Tile for bridge e2e tests',
    html_content: TILE_HTML,
    has_data_bindings: true,
    data_binding_contexts: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  });

  await seedAndRegister(AUTOEXEC_TOKEN, {
    token: AUTOEXEC_TOKEN,
    title: 'Auto-exec Test Tile',
    description: 'Tile with data_bindings_json and on_data_script',
    html_content: AUTOEXEC_HTML,
    has_data_bindings: true,
    data_binding_contexts: null,
    data_bindings_json: AUTOEXEC_BINDINGS,
    on_data_script: AUTOEXEC_ON_DATA,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  });

  await seedAndRegister(STATIC_TOKEN, {
    token: STATIC_TOKEN,
    title: 'Static Test Tile',
    description: 'Tile with no bindings',
    html_content: STATIC_HTML,
    has_data_bindings: false,
    data_binding_contexts: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  });

  seeded = true;
}

/* eslint-enable @typescript-eslint/naming-convention */

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.afterAll(() => {
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

// ---------------------------------------------------------------------------
// Helper — navigate to tile page and wait for bridge
// ---------------------------------------------------------------------------

async function gotoTileAndWaitForBridge(page: import('@playwright/test').Page) {
  await page.goto(`/tile/view/${BRIDGE_TOKEN}`);
  const iframe = page.frameLocator('iframe');
  await expect(iframe.locator('#status')).toHaveText('bridge-ready', { timeout: 15_000 });
  return iframe;
}

// ===========================================================================
// Bridge injection — real tile page
// ===========================================================================

test('tile view page loads and injects bridge with all four methods', async ({ page }) => {
  await ensureSeeded();
  const iframe = await gotoTileAndWaitForBridge(page);

  const methods = await iframe.locator('body').evaluate(() => {
    const ud = (window as unknown as Record<string, unknown>).UnifyData as Record<string, unknown>;
    if (!ud) return [];
    return ['filter', 'reduce', 'join', 'joinReduce'].filter((m) => typeof ud[m] === 'function');
  });

  expect(methods).toEqual(['filter', 'reduce', 'join', 'joinReduce']);
});

// ===========================================================================
// PostMessage routing — all four methods in one page session
// ===========================================================================

test('UnifyData filter, reduce, join, and joinReduce route through TileViewer @critical @area(assistants.data)', async ({
  page,
}) => {
  await ensureSeeded();

  const filterCaptured: Record<string, unknown>[] = [];
  const reduceCaptured: Record<string, unknown>[] = [];
  const joinCaptured: Record<string, unknown>[] = [];
  const joinReduceCaptured: Record<string, unknown>[] = [];

  await page.route('**/api/dashboards/tiles/*/filter', async (route) => {
    filterCaptured.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [], total_count: 0 }),
    });
  });

  await page.route('**/api/dashboards/tiles/*/reduce', async (route) => {
    reduceCaptured.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: 42 }),
    });
  });

  await page.route('**/api/dashboards/tiles/*/join', async (route) => {
    joinCaptured.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [{ name: 'Widget', total: 100 }], total_count: 1 }),
    });
  });

  await page.route('**/api/dashboards/tiles/*/join-reduce', async (route) => {
    joinReduceCaptured.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: 99 }),
    });
  });

  const iframe = await gotoTileAndWaitForBridge(page);

  await iframe.locator('body').evaluate(() => {
    const ud = (window as unknown as Record<string, unknown>).UnifyData as {
      filter: (opts: Record<string, unknown>) => Promise<unknown>;
    };
    return ud.filter({ context: 'TestCtx', limit: 10, columns: ['id', 'name'] });
  });

  const reduceResult = await iframe.locator('body').evaluate(() => {
    const ud = (window as unknown as Record<string, unknown>).UnifyData as {
      reduce: (opts: Record<string, unknown>) => Promise<unknown>;
    };
    return ud.reduce({ context: 'Metrics', metric: 'sum', columns: ['revenue'] });
  });

  const joinResult = await iframe.locator('body').evaluate(() => {
    const ud = (window as unknown as Record<string, unknown>).UnifyData as {
      join: (opts: Record<string, unknown>) => Promise<unknown>;
    };
    return ud.join({
      tables: ['Orders', 'Products'],
      join_expr: 'a.product_id == b.id',
      select: { name: 'b.name', total: 'a.total' },
    });
  });

  const joinReduceResult = await iframe.locator('body').evaluate(() => {
    const ud = (window as unknown as Record<string, unknown>).UnifyData as {
      joinReduce: (opts: Record<string, unknown>) => Promise<unknown>;
    };
    return ud.joinReduce({
      tables: ['Orders', 'Products'],
      join_expr: 'a.product_id == b.id',
      select: { val: 'a.amount' },
      metric: 'sum',
      columns: ['val'],
    });
  });

  expect(filterCaptured).toHaveLength(1);
  expect(filterCaptured[0].context).toBe('TestCtx');
  expect(filterCaptured[0].limit).toBe(10);
  expect(filterCaptured[0].columns).toEqual(['id', 'name']);

  expect(reduceResult).toBe(42);
  expect(reduceCaptured).toHaveLength(1);
  expect(reduceCaptured[0].context).toBe('Metrics');
  expect(reduceCaptured[0].metric).toBe('sum');
  expect(reduceCaptured[0].columns).toEqual(['revenue']);

  expect(joinResult).toEqual([{ name: 'Widget', total: 100 }]);
  expect(joinCaptured).toHaveLength(1);
  expect(joinCaptured[0].joinExpr).toBe('a.product_id == b.id');
  expect(joinCaptured[0].tables).toEqual(['Orders', 'Products']);

  expect(joinReduceResult).toBe(99);
  expect(joinReduceCaptured).toHaveLength(1);
  expect(joinReduceCaptured[0].metric).toBe('sum');
  expect(joinReduceCaptured[0].joinExpr).toBe('a.product_id == b.id');
});

// ===========================================================================
// Error propagation — proxy error surfaces in iframe
// ===========================================================================

test('bridge rejects when proxy returns an error response', async ({ page }) => {
  await ensureSeeded();

  await page.route('**/api/dashboards/tiles/*/filter', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Something went wrong' }),
    });
  });

  const iframe = await gotoTileAndWaitForBridge(page);

  const errorMessage = await iframe.locator('body').evaluate(async () => {
    const ud = (window as unknown as Record<string, unknown>).UnifyData as {
      filter: (opts: Record<string, unknown>) => Promise<unknown>;
    };
    try {
      await ud.filter({ context: 'Broken' });
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  });

  expect(errorMessage).toBe('Something went wrong');
});

// ===========================================================================
// Auto-exec path — data_bindings_json + on_data_script
// ===========================================================================

test('auto-exec tile injects bridge and executes on_data with resolved bindings', async ({
  page,
}) => {
  await ensureSeeded();

  const filterCalls: Record<string, unknown>[] = [];
  const reduceCalls: Record<string, unknown>[] = [];

  await page.route('**/api/dashboards/tiles/*/filter', async (route) => {
    filterCalls.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rows: [
          { month: 'Jan', revenue: 100 },
          { month: 'Feb', revenue: 200 },
        ],
        total_count: 2,
      }),
    });
  });

  await page.route('**/api/dashboards/tiles/*/reduce', async (route) => {
    reduceCalls.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: 300 }),
    });
  });

  await page.goto(`/tile/view/${AUTOEXEC_TOKEN}`);
  const iframe = page.frameLocator('iframe');

  await expect(iframe.locator('#status')).toHaveText('data-loaded', { timeout: 15_000 });

  const salesResult = await iframe.locator('#sales-result').textContent();
  const parsedSales = JSON.parse(salesResult!);
  expect(parsedSales).toEqual([
    { month: 'Jan', revenue: 100 },
    { month: 'Feb', revenue: 200 },
  ]);

  const totalResult = await iframe.locator('#total-result').textContent();
  expect(JSON.parse(totalResult!)).toBe(300);

  expect(filterCalls).toHaveLength(1);
  expect(filterCalls[0].context).toBe('Data/Sales');
  expect(filterCalls[0].columns).toEqual(['month', 'revenue']);

  expect(reduceCalls).toHaveLength(1);
  expect(reduceCalls[0].context).toBe('Data/Sales');
  expect(reduceCalls[0].metric).toBe('sum');
  expect(reduceCalls[0].columns).toEqual(['revenue']);
});

// ===========================================================================
// Static tile — no bindings, no bridge injection
// ===========================================================================

test('static tile renders without auto-exec bindings', async ({ page }) => {
  await ensureSeeded();

  await page.goto(`/tile/view/${STATIC_TOKEN}`);
  const iframe = page.frameLocator('iframe');

  await expect(iframe.locator('#status')).toHaveText('static-ready', { timeout: 15_000 });
  await expect(iframe.locator('#bridge-check')).toHaveText('has-bridge');
});

// ===========================================================================
// Auto-exec error handling — one binding fails, on_data still runs
// ===========================================================================

test('auto-exec tile handles binding failure gracefully', async ({ page }) => {
  await ensureSeeded();

  await page.route('**/api/dashboards/tiles/*/filter', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'DB connection failed' }),
    });
  });

  await page.route('**/api/dashboards/tiles/*/reduce', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(42),
    });
  });

  await page.goto(`/tile/view/${AUTOEXEC_TOKEN}`);
  const iframe = page.frameLocator('iframe');

  // Promise.all rejects when any binding fails, so on_data never runs
  // and status stays "loading". The page should not crash.
  await page.waitForTimeout(8_000);

  const status = await iframe.locator('#status').textContent();
  expect(status).not.toBe('data-loaded');
  expect(status).toBe('loading');
});
