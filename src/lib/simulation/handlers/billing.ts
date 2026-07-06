/**
 * Billing / credits / transactions handlers.
 */

import type { SimContext, SimHandler } from '../dispatch';
import { getSession } from '../store';

const credits: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/credits',
  handle: (ctx: SimContext) => {
    const { billing } = getSession(ctx.scenario.id);
    // Handlers emit camelCase; the snake→camel response pipeline is idempotent
    // for already-camelCase keys, so the UI receives exactly these fields.
    return {
      json: {
        credits: billing.balance ?? 0,
        billingMode: 'CREDITS',
        freeTrial: billing.freeTrial,
        autoReloadEnabled: billing.autoReloadEnabled,
        nextPayment: billing.nextPayment,
        minCutoff: billing.minCutoff,
      },
    };
  },
};

const creditsTransactions: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/credits/transactions',
  handle: (ctx: SimContext) => {
    const { transactions } = getSession(ctx.scenario.id);
    const limit = Number(ctx.searchParams.get('limit') ?? '50');
    const offset = Number(ctx.searchParams.get('offset') ?? '0');
    const orgId =
      ctx.workspaceId === 'personal'
        ? null
        : Number.isFinite(Number(ctx.workspaceId))
          ? Number(ctx.workspaceId)
          : null;
    const page = transactions.slice(offset, offset + limit).map((txn, index) => ({
      id: offset + index + 1,
      at: txn.createdAt,
      amount: txn.amount,
      category: txn.category,
      assistantId: txn.assistantId ? Number(txn.assistantId) : null,
      userId: ctx.scenario.user.id,
      organizationId: orgId,
      description: txn.description,
      detail: null,
    }));
    return { json: { transactions: page } };
  },
};

export const billingHandlers: SimHandler[] = [credits, creditsTransactions];
