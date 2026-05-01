/** Space records exposed by Orchestra for Console read surfaces. */

export type SpaceStatus = 'active' | 'deleting';

export interface Space {
  spaceId: number;
  name: string;
  description: string | null;
  ownerUserId: string;
  organizationId: number | null;
  status: SpaceStatus;
  createdAt: string;
  updatedAt: string;
}

export type SpaceSummary = Pick<
  Space,
  'spaceId' | 'name' | 'description' | 'organizationId' | 'status'
>;
