/**
 * Data Bridge E2E Tests — browser-based user flows verifying the UnifyData
 * bridge on a real tile view page, including bridge injection, postMessage
 * routing through TileViewer to the proxy API routes, and error propagation.
 *
 * Seeds a real tile in Orchestra (with has_data_bindings=true) and registers
 * its token so `/tile/view/[token]` resolves end-to-end. The tile page is
 * public (no login needed) so tests use Playwright's base `page` fixture.
 *
 * Proxy validation tests send direct HTTP requests to the Next.js API routes
 * to verify input validation independently.
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
const BRIDGE_TOKEN = `br${Date.now().toString(36).slice(-8)}`;
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

test.setTimeout(120_000);

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedTile() {
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: TILE_CONTEXT,
        entries: [
          {
            token: BRIDGE_TOKEN,
            title: TILE_TITLE,
            description: 'Tile for bridge e2e tests',
            html_content: TILE_HTML,
            has_data_bindings: true,
            data_binding_contexts: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
          },
        ],
      }),
    },
    user.apiKey
  );
  if (!res.ok) throw new Error(`Failed to seed tile: ${res.status} ${await res.text()}`);
}

async function registerToken() {
  const res = await orchestraFetch(
    '/v0/dashboards/tokens',
    {
      method: 'POST',
      body: JSON.stringify({
        token: BRIDGE_TOKEN,
        entity_type: 'tile',
        context_name: TILE_CONTEXT,
        project_name: 'Assistants',
      }),
    },
    user.apiKey
  );
  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to register token: ${res.status} ${await res.text()}`);
  }
}

let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  await seedTile();
  await registerToken();
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
// PostMessage routing — each method goes to correct proxy endpoint
// ===========================================================================

test('UnifyData.filter() routes through TileViewer to /api/.../filter', async ({ page }) => {
  await ensureSeeded();

  const captured: Record<string, unknown>[] = [];
  await page.route('**/api/dashboards/tiles/*/filter', async (route) => {
    captured.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [], total_count: 0 }),
    });
  });

  const iframe = await gotoTileAndWaitForBridge(page);

  await iframe.locator('body').evaluate(() => {
    const ud = (window as unknown as Record<string, unknown>).UnifyData as {
      filter: (opts: Record<string, unknown>) => Promise<unknown>;
    };
    return ud.filter({ context: 'TestCtx', limit: 10, columns: ['id', 'name'] });
  });

  expect(captured).toHaveLength(1);
  expect(captured[0].context).toBe('TestCtx');
  expect(captured[0].limit).toBe(10);
  expect(captured[0].columns).toEqual(['id', 'name']);
});

test('UnifyData.reduce() routes through TileViewer to /api/.../reduce', async ({ page }) => {
  await ensureSeeded();

  const captured: Record<string, unknown>[] = [];
  await page.route('**/api/dashboards/tiles/*/reduce', async (route) => {
    captured.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: 42 }),
    });
  });

  const iframe = await gotoTileAndWaitForBridge(page);

  const result = await iframe.locator('body').evaluate(() => {
    const ud = (window as unknown as Record<string, unknown>).UnifyData as {
      reduce: (opts: Record<string, unknown>) => Promise<unknown>;
    };
    return ud.reduce({ context: 'Metrics', metric: 'sum', columns: ['revenue'] });
  });

  expect(result).toEqual({ result: 42 });
  expect(captured).toHaveLength(1);
  expect(captured[0].context).toBe('Metrics');
  expect(captured[0].metric).toBe('sum');
  expect(captured[0].columns).toEqual(['revenue']);
});

test('UnifyData.join() routes through TileViewer to /api/.../join', async ({ page }) => {
  await ensureSeeded();

  const captured: Record<string, unknown>[] = [];
  await page.route('**/api/dashboards/tiles/*/join', async (route) => {
    captured.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [{ name: 'Widget', total: 100 }], total_count: 1 }),
    });
  });

  const iframe = await gotoTileAndWaitForBridge(page);

  const result = await iframe.locator('body').evaluate(() => {
    const ud = (window as unknown as Record<string, unknown>).UnifyData as {
      join: (opts: Record<string, unknown>) => Promise<unknown>;
    };
    return ud.join({
      tables: ['Orders', 'Products'],
      join_expr: 'a.product_id == b.id',
      select: { name: 'b.name', total: 'a.total' },
    });
  });

  expect(result).toEqual({ rows: [{ name: 'Widget', total: 100 }], total_count: 1 });
  expect(captured).toHaveLength(1);
  expect(captured[0].joinExpr).toBe('a.product_id == b.id');
  expect(captured[0].tables).toEqual(['Orders', 'Products']);
});

test('UnifyData.joinReduce() routes through TileViewer to /api/.../join-reduce', async ({
  page,
}) => {
  await ensureSeeded();

  const captured: Record<string, unknown>[] = [];
  await page.route('**/api/dashboards/tiles/*/join-reduce', async (route) => {
    captured.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: 99 }),
    });
  });

  const iframe = await gotoTileAndWaitForBridge(page);

  const result = await iframe.locator('body').evaluate(() => {
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

  expect(result).toEqual({ result: 99 });
  expect(captured).toHaveLength(1);
  expect(captured[0].metric).toBe('sum');
  expect(captured[0].joinExpr).toBe('a.product_id == b.id');
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
// Proxy route validation — required field checks (direct HTTP)
// ===========================================================================

test('filter proxy returns 400 when context is missing', async ({ request }) => {
  const res = await request.post('/api/dashboards/tiles/fake-token/filter', {
    data: { columns: ['id'] },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain('context');
});

test('reduce proxy returns 400 when context is missing', async ({ request }) => {
  const res = await request.post('/api/dashboards/tiles/fake-token/reduce', {
    data: { metric: 'count', columns: ['id'] },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain('context');
});

test('reduce proxy returns 400 when metric is missing', async ({ request }) => {
  const res = await request.post('/api/dashboards/tiles/fake-token/reduce', {
    data: { context: 'Test', columns: ['id'] },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain('metric');
});

test('join proxy returns 400 when tables has wrong count', async ({ request }) => {
  const res = await request.post('/api/dashboards/tiles/fake-token/join', {
    data: { tables: ['OnlyOne'], joinExpr: 'a.id == b.id', select: { id: 'a.id' } },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain('tables');
});

test('join proxy returns 400 when joinExpr is missing', async ({ request }) => {
  const res = await request.post('/api/dashboards/tiles/fake-token/join', {
    data: { tables: ['A', 'B'], select: { id: 'a.id' } },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain('joinExpr');
});

test('join proxy returns 400 when select is empty', async ({ request }) => {
  const res = await request.post('/api/dashboards/tiles/fake-token/join', {
    data: { tables: ['A', 'B'], joinExpr: 'a.id == b.id', select: {} },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain('select');
});

test('join-reduce proxy returns 400 when metric is missing', async ({ request }) => {
  const res = await request.post('/api/dashboards/tiles/fake-token/join-reduce', {
    data: {
      tables: ['A', 'B'],
      joinExpr: 'a.id == b.id',
      select: { id: 'a.id' },
      columns: ['id'],
    },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain('metric');
});
