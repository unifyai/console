/**
 * Project / context / favourites handlers.
 *
 * The contexts endpoint returns *full* sub-context names (prefixed with each
 * assistant's `{userId}/{agentId}` in the active workspace) so the brain client's
 * sub-context discovery (Knowledge/Functions) and the Data browser tree both
 * resolve correctly.
 */

import type { SimContext, SimHandler } from '../dispatch';
import type { MockAssistant } from '../types';
import {
  addFavourite,
  deleteFavouriteById,
  getSession,
  listFavourites,
  updateFavouriteById,
} from '../store';
import { richTablePaths } from '../fixtures/tables';

function workspaceAssistants(ctx: SimContext): MockAssistant[] {
  const { assistants } = getSession(ctx.scenario.id);
  return assistants.filter((a) =>
    ctx.workspaceId === 'personal'
      ? a.organizationId === null
      : a.organizationId === Number(ctx.workspaceId)
  );
}

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
  handle: (ctx: SimContext) => {
    const assistants = workspaceAssistants(ctx);
    const tablePaths = richTablePaths();
    const names: { name: string; description: string }[] = [];
    for (const assistant of assistants) {
      for (const tablePath of tablePaths) {
        names.push({
          name: `${assistant.userId}/${assistant.agentId}/${tablePath}`,
          description: '',
        });
      }
    }
    return { json: names };
  },
};

const favouritesList: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/project/favorites',
  handle: (ctx: SimContext) => ({ json: listFavourites(ctx.scenario.id) }),
};

const favouritesCreate: SimHandler = {
  match: (method, pathname) => method === 'POST' && pathname === '/v0/project/favorites',
  handle: (ctx: SimContext) => {
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    const projectName =
      (body.projectName as string | undefined) ??
      (body['project_name'] as string | undefined) ??
      'Project';
    const favourite = addFavourite(
      ctx.scenario.id,
      projectName,
      (body.icon as string | undefined) ?? 'folder',
      (body.position as number | undefined) ?? 0
    );
    return { json: favourite };
  },
};

const favouritesUpdate: SimHandler = {
  match: (method, pathname) =>
    method === 'PATCH' && /^\/v0\/project\/favorites\/\d+$/.test(pathname),
  handle: (ctx: SimContext) => {
    const id = Number(ctx.pathname.split('/').pop());
    const body = (ctx.body ?? {}) as { icon?: string; position?: number };
    const favourite = updateFavouriteById(ctx.scenario.id, id, body);
    return { json: favourite ?? { id, ...body } };
  },
};

const favouritesDelete: SimHandler = {
  match: (method, pathname) =>
    method === 'DELETE' && /^\/v0\/project\/favorites\/\d+$/.test(pathname),
  handle: (ctx: SimContext) => {
    const id = Number(ctx.pathname.split('/').pop());
    deleteFavouriteById(ctx.scenario.id, id);
    return { json: { success: true } };
  },
};

export const projectHandlers: SimHandler[] = [
  projectsList,
  projectsTree,
  projectContexts,
  favouritesList,
  favouritesCreate,
  favouritesUpdate,
  favouritesDelete,
];
