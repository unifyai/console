import { Team } from '@/types/team';
import { ResponseProps } from '@/types/common';
import { createOrchestraClient } from '@/lib/orchestra/client';

export const createTeamAction =
  (apiKey: string) =>
  async (orgId: number, name: string, description?: string): Promise<Team | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.POST(
      '/v0/organizations/{organization_id}/teams',
      {
        params: { path: { organization_id: orgId } },
        body: { name, description } as never,
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to create team',
        status: response?.status || 500,
      };
    }

    return data as unknown as Team;
  };

export const updateTeamAction =
  (apiKey: string) =>
  async (
    orgId: number,
    teamId: number,
    name: string,
    description?: string
  ): Promise<Team | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.PATCH(
      '/v0/organizations/{organization_id}/teams/{team_id}',
      {
        params: { path: { organization_id: orgId, team_id: teamId } },
        body: { name, description } as never,
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to update team',
        status: response?.status || 500,
      };
    }

    return data as unknown as Team;
  };

export const getTeamsAction =
  (apiKey: string) =>
  async (orgId: number): Promise<Team[] | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.GET(
      '/v0/organizations/{organization_id}/teams',
      {
        params: { path: { organization_id: orgId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to get teams',
        status: response?.status || 500,
      };
    }

    return data as unknown as Team[];
  };

export const getTeamDetailsAction =
  (apiKey: string) =>
  async (orgId: number, teamId: number): Promise<Team | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { data, error, response } = await client.GET(
      '/v0/organizations/{organization_id}/teams/{team_id}',
      {
        params: { path: { organization_id: orgId, team_id: teamId } },
      }
    );

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to get team details',
        status: response?.status || 500,
      };
    }

    return data as unknown as Team;
  };

export const deleteTeamAction =
  (apiKey: string) =>
  async (orgId: number, teamId: number): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.DELETE(
      '/v0/organizations/{organization_id}/teams/{team_id}',
      {
        params: { path: { organization_id: orgId, team_id: teamId } },
      }
    );

    if (error) {
      return {
        detail: ((error as Record<string, unknown>)?.detail as string) || 'Failed to delete team',
        status: response?.status || 500,
      };
    }

    return;
  };

export const addTeamMemberAction =
  (apiKey: string) =>
  async (orgId: number, teamId: number, userId: string): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.POST(
      '/v0/organizations/{organization_id}/teams/{team_id}/members',
      {
        params: { path: { organization_id: orgId, team_id: teamId } },
        body: { user_ids: [userId] } as never,
      }
    );

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to add team member',
        status: response?.status || 500,
      };
    }

    return;
  };

export const removeTeamMemberAction =
  (apiKey: string) =>
  async (orgId: number, teamId: number, userId: string): Promise<void | ResponseProps> => {
    'use server';
    const client = createOrchestraClient(apiKey);
    const { error, response } = await client.DELETE(
      '/v0/organizations/{organization_id}/teams/{team_id}/members/{user_id_to_remove}',
      {
        params: { path: { organization_id: orgId, team_id: teamId, user_id_to_remove: userId } },
      }
    );

    if (error) {
      return {
        detail:
          ((error as Record<string, unknown>)?.detail as string) || 'Failed to remove team member',
        status: response?.status || 500,
      };
    }

    return;
  };
