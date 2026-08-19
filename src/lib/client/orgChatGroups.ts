import { parseRosterGroup, type RosterGroup } from '@/types/orgChat';

export interface OrgChatGroupPatch {
  name?: string;
  /** Null clears the emoji and returns the group to its member faces. */
  icon?: string | null;
}

/**
 * Patches a chat group's own settings (name, icon) through the session-cookie
 * API route. Membership changes go through the same endpoint from the manage
 * dialog, which owns the member lists.
 */
export async function updateOrgChatGroup(
  orgId: string,
  groupId: number,
  patch: OrgChatGroupPatch
): Promise<RosterGroup | null> {
  const response = await fetch(`/api/organizations/${orgId}/groups/${groupId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    console.error(`Failed to update chat group ${groupId} (${response.status})`);
    return null;
  }
  return parseRosterGroup(await response.json());
}
