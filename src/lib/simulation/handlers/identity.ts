/**
 * Identity-adjacent handlers that are reached through the Orchestra fetch seam
 * (the core `getCurrentUser`/session identity is shimmed directly in
 * `lib/user/user.ts`).
 */

import type { SimHandler } from '../dispatch';

const onboardingStatus: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/user/onboarding-status',
  handle: () => ({ json: { onboarded: true } }),
};

const permissions: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/permissions',
  handle: () => ({ json: [] }),
};

export const identityHandlers: SimHandler[] = [onboardingStatus, permissions];
