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

export const billingHandlers: SimHandler[] = [credits];
