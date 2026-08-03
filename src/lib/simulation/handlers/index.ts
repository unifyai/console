/**
 * Aggregated simulation handler registry, grouped by product surface. The
 * dispatcher walks this list in order and falls back to a safe empty body for
 * any path without a dedicated handler.
 */

import type { SimHandler } from '../dispatch';
import { assistantsHandler } from './assistants';
import { projectHandlers } from './projects';
import { canvasHandlers } from './canvas';
import { brainHandlers } from './brain';
import { mutationHandlers } from './mutations';
import { billingHandlers } from './billing';
import { interfaceHandlers } from './interfaces';
import { identityHandlers } from './identity';
import { integrationHandlers } from './integrations';

export const handlers: SimHandler[] = [
  assistantsHandler,
  ...projectHandlers,
  // Ahead of the brain handlers: the canvas contexts are served from fixtures that
  // keep a bundle beside its own content address, and the generic `/v0/logs`
  // handler would otherwise claim them first.
  ...canvasHandlers,
  ...brainHandlers,
  ...mutationHandlers,
  ...billingHandlers,
  ...interfaceHandlers,
  ...identityHandlers,
  ...integrationHandlers,
];
