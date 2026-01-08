import { ResponseProps } from './common';

export interface Team {
  id: number;
  name: string;
  description?: string;
  organizationId: number;
  createdAt: string;
  memberCount?: number;
  members?: string[];
}

export interface TeamActions {
  createTeam: (orgId: number, name: string, description?: string) => Promise<Team | ResponseProps>;
  updateTeam: (
    orgId: number,
    teamId: number,
    name: string,
    description?: string
  ) => Promise<Team | ResponseProps>;
  deleteTeam: (orgId: number, teamId: number) => Promise<void | ResponseProps>;
  addTeamMember: (orgId: number, teamId: number, userId: string) => Promise<void | ResponseProps>;
  removeTeamMember: (
    orgId: number,
    teamId: number,
    userId: string
  ) => Promise<void | ResponseProps>;
  getTeams: (orgId: number) => Promise<Team[] | ResponseProps>;
  getTeamDetails: (orgId: number, teamId: number) => Promise<Team | ResponseProps>;
}
