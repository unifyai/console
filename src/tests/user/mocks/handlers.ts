import { http, HttpResponse } from 'msw';
import { mockOrganizations, mockMembers, mockRoles, mockTeams, mockInvites } from './data';

const BASE_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';

export const organizationHandlers = [
  // Organization
  http.get(`${BASE_URL}/v0/organizations/:id/members`, () => {
    return HttpResponse.json(mockMembers);
  }),
  http.get(`${BASE_URL}/v0/organizations/:id/roles`, () => {
    return HttpResponse.json(mockRoles);
  }),
  http.get(`${BASE_URL}/v0/organizations/:id/invites`, () => {
    return HttpResponse.json({ invites: mockInvites });
  }),

  // Teams
  http.get(`${BASE_URL}/v0/organizations/:id/teams`, () => {
    return HttpResponse.json(mockTeams);
  }),
  http.get(`${BASE_URL}/v0/organizations/:id/teams/:teamId`, ({ params }) => {
    const team = mockTeams.find((t) => t.id === Number(params.teamId));
    return team ? HttpResponse.json(team) : new HttpResponse(null, { status: 404 });
  }),

  // Permissions
  http.get(`${BASE_URL}/v0/permissions`, () => {
    return HttpResponse.json([
      { id: 1, name: 'read', resource_type: 'org' },
      { id: 2, name: 'write', resource_type: 'org' },
    ]);
  }),
];
