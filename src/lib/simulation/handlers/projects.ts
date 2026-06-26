/**
 * Project / context / favourites handlers.
 */

import type { SimContext, SimHandler } from '../dispatch';
import { getSession } from '../store';

const projectsList: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/projects',
  handle: (ctx: SimContext) => {
    const { projects } = getSession(ctx.scenario.id);
    return { json: projects.map((p) => p.name) };
  },
};

const projectsTree: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/projects/tree',
  handle: (ctx: SimContext) => {
    const { projects } = getSession(ctx.scenario.id);
    return {
      json: projects.map((p) => ({ name: p.name, description: p.description ?? '', contexts: [] })),
    };
  },
};

const projectContexts: SimHandler = {
  match: (method, pathname) =>
    method === 'GET' && /^\/v0\/project\/[^/]+\/contexts$/.test(pathname),
  handle: () => ({
    json: [
      { name: 'Contacts', description: 'Contacts table' },
      { name: 'Transcripts', description: 'Conversation transcripts' },
      { name: 'Knowledge', description: 'Knowledge base' },
    ],
  }),
};

const favourites: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/project/favorites',
  handle: () => ({ json: [] }),
};

export const projectHandlers: SimHandler[] = [
  projectsList,
  projectsTree,
  projectContexts,
  favourites,
];
