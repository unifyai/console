/**
 * Assistant list handler. Returns the `{ info: [...] }` envelope the
 * `/v0/assistant` endpoint produces, with fully-shaped assistant objects so the
 * canonicalization + UI never trip over missing fields.
 */

import type { SimContext, SimHandler } from '../dispatch';
import type { MockAssistant } from '../types';
import { getSession } from '../store';

function buildAssistant(mock: MockAssistant, scenarioUser: { name: string; lastName: string }) {
  const contactBase = mock.agentId * 10;
  return {
    agentId: String(mock.agentId),
    userId: mock.userId,
    organizationId: mock.organizationId,
    isCoordinator: mock.isCoordinator,
    userFirstName: scenarioUser.name,
    userLastName: scenarioUser.lastName,
    userImage: null,
    firstName: mock.firstName,
    surname: mock.surname,
    jobTitle: mock.jobTitle ?? null,
    profilePhoto: mock.photoUrl ?? null,
    profileVideo: null,
    age: null,
    nationality: null,
    about: mock.bio ?? null,
    phoneCountry: null,
    timezone: null,
    voiceId: null,
    voiceProvider: null,
    email: null,
    emailProvider: null,
    emailProvisionedBy: null,
    phone: null,
    assistantWhatsappNumber: null,
    assistantDiscordBotId: null,
    userPhone: null,
    userWhatsappNumber: null,
    userDiscordId: null,
    isUserDesktop: false,
    desktopMode: null,
    desktopUrl: null,
    userDesktopMode: null,
    userDesktopUrl: null,
    userDesktopFilesysSync: null,
    weeklyLimit: null,
    maxParallel: null,
    teamIds: [],
    teamSummaries: [],
    selfContactId: contactBase + 1,
    bossContactId: contactBase + 2,
    contactIdentityRoots: [],
    createdAt: '2025-09-01T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    demoId: null,
  };
}

export const assistantsHandler: SimHandler = {
  match: (method, pathname) =>
    method === 'GET' && (pathname === '/v0/assistant' || pathname === '/v0/assistant/'),
  handle: (ctx: SimContext) => {
    const session = getSession(ctx.scenario.id);
    const visible = session.assistants.filter((a) =>
      ctx.workspaceId === 'personal'
        ? a.organizationId === null
        : a.organizationId === Number(ctx.workspaceId)
    );
    const info = visible.map((a) => buildAssistant(a, ctx.scenario.user));
    return { json: { info } };
  },
};
