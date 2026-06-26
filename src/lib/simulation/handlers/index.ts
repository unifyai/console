/**
 * Aggregated simulation handler registry, grouped by product surface. The
 * dispatcher walks this list in order and falls back to a safe empty body for
 * any path without a dedicated handler.
 */

import type { SimHandler } from '../dispatch';
import { assistantsHandler } from './assistants';
import { projectHandlers } from './projects';
import { brainHandlers } from './brain';
import { mutationHandlers } from './mutations';
import { billingHandlers } from './billing';
import { interfaceHandlers } from './interfaces';
import { identityHandlers } from './identity';

export const handlers: SimHandler[] = [
  assistantsHandler,
  ...projectHandlers,
  ...brainHandlers,
  ...mutationHandlers,
  ...billingHandlers,
  ...interfaceHandlers,
  ...identityHandlers,
];
