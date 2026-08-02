/**
 * Organization workspace tab vocabulary.
 *
 * Kept out of the view component so server code (route handlers, the agent
 * guidance builder) can read the tab set without pulling in a client module,
 * and so a tab cannot be renamed in one place and described stale in another.
 */

/** Tabs shown to every member. */
export const ORGANIZATION_MEMBER_TABS = [
  { id: 'members', label: 'Members' },
  { id: 'teams', label: 'Teams' },
  { id: 'roles', label: 'Roles' },
] as const;

/** Tabs shown only to members who can update the organization. */
export const ORGANIZATION_ADMIN_TABS = [
  { id: 'organization', label: 'Profile' },
  { id: 'security', label: 'Security' },
] as const;

export type OrganizationTabId =
  | (typeof ORGANIZATION_MEMBER_TABS)[number]['id']
  | (typeof ORGANIZATION_ADMIN_TABS)[number]['id'];

/** Sidebar order for a given permission level. `Profile` leads when present. */
export function organizationTabs(
  canUpdateOrg: boolean
): ReadonlyArray<{ id: OrganizationTabId; label: string }> {
  if (!canUpdateOrg) return ORGANIZATION_MEMBER_TABS;
  const [profile, security] = ORGANIZATION_ADMIN_TABS;
  return [profile, ...ORGANIZATION_MEMBER_TABS, security];
}
