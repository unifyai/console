/** Organization team metadata for shared-brain routing in Console. */

export type TeamStatus = 'active' | 'deleting';

export interface SharedTeamSummary {
  teamId: number;
  name: string;
  description: string | null;
  organizationId?: number | null;
  status?: TeamStatus;
}
