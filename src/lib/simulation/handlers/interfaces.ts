/**
 * Interfaces / tabs / tiles handlers for the dashboard builder surface.
 */

import type { SimHandler } from '../dispatch';
import { interfaceList, tileList } from '../fixtures/interfaces';

const interfacesList: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/interfaces/list',
  handle: () => ({ json: interfaceList }),
};

const tabsList: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/tab/list',
  handle: () => ({ json: interfaceList.flatMap((i) => i.tabs) }),
};

const tilesList: SimHandler = {
  match: (method, pathname) =>
    method === 'GET' && (pathname === '/v0/tile/list' || pathname === '/v0/tile/'),
  handle: () => ({ json: tileList }),
};

export const interfaceHandlers: SimHandler[] = [interfacesList, tabsList, tilesList];
