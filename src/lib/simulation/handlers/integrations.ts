/**
 * Provider integration connection handlers for mock simulation mode.
 *
 * Catalog reads still flow through Builtins `/v0/logs`; these handlers back the
 * Orchestra provider proxy routes that list and mutate live connections.
 */

import type { SimContext, SimHandler } from '../dispatch';
import { getTable } from '../store';

function connectionStatusFromApp(status: unknown): string {
  if (status === 'configured') return 'connected';
  if (typeof status === 'string' && status.length > 0) return status;
  return 'connected';
}

function mockConnections(ctx: SimContext) {
  const apps = getTable(ctx.scenario.id, 'Integrations/Apps');
  return apps
    .filter((app) => {
      const status = app.connectionStatus;
      return typeof status === 'string' && status !== 'not_connected';
    })
    .map((app) => ({
      connectionId: `mock-conn-${String(app.canonicalAppSlug)}`,
      canonicalAppSlug: app.canonicalAppSlug,
      backendId: app.backendId ?? 'composio-dev',
      providerAppId: app.providerAppId ?? `mock-${String(app.canonicalAppSlug)}`,
      providerConnectionId: `mock-pconn-${String(app.canonicalAppSlug)}`,
      status: connectionStatusFromApp(app.connectionStatus),
      ownerScope: ctx.searchParams.get('owner_scope') ?? 'assistant',
      externalAccountLabel: `${String(app.displayName ?? app.canonicalAppSlug)} workspace`,
      accountLabel: `${String(app.displayName ?? app.canonicalAppSlug)} workspace`,
      grantedScopes: [],
      toolPolicy: {},
    }));
}

const listConnections: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/integrations/connections',
  handle: (ctx) => ({ json: mockConnections(ctx) }),
};

const connectStart: SimHandler = {
  match: (method, pathname) => method === 'POST' && pathname === '/v0/integrations/connect/start',
  handle: (ctx) => {
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    const slug =
      (body.canonicalAppSlug as string | undefined) ??
      (body.canonical_app_slug as string | undefined) ??
      'slack';
    return {
      json: {
        connection: {
          connectionId: `mock-conn-${slug}`,
          canonicalAppSlug: slug,
          backendId: 'composio-dev',
          providerAppId: `mock-${slug}`,
          providerConnectionId: `mock-pconn-${slug}`,
          status: 'pending',
          ownerScope: (body.ownerScope as string | undefined) ?? 'assistant',
          externalAccountLabel: null,
          accountLabel: null,
          grantedScopes: [],
          toolPolicy: {},
        },
        authorizationUrl: null,
      },
    };
  },
};

const connectionMutation: SimHandler = {
  match: (method, pathname) =>
    (method === 'POST' || method === 'PATCH') &&
    /^\/v0\/integrations\/connections(\/[^/]+)?(\/[^/]+)?$/.test(pathname),
  handle: () => ({ json: { info: 'ok' } }),
};

export const integrationHandlers: SimHandler[] = [
  listConnections,
  connectStart,
  connectionMutation,
];
