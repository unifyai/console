/**
 * Display helpers for the managed org-wide team (legacy DB name `"Org"`).
 */

export function isManagedOrgWideTeam(team: { isOrgWideSharing?: boolean; name: string }): boolean {
  return team.isOrgWideSharing === true || team.name.trim() === 'Org';
}

/** Prefer the live organization name over the legacy `"Org"` team label. */
export function resolveManagedTeamDisplayName(
  team: { isOrgWideSharing?: boolean; name: string },
  orgName: string | null | undefined
): string {
  const name = orgName?.trim();
  if (name && isManagedOrgWideTeam(team)) return name;
  return team.name;
}

/** Prefer the organization profile photo for the managed org-wide team. */
export function resolveManagedTeamImageUrl(
  team: { isOrgWideSharing?: boolean; name: string; image?: string | null },
  orgImage: string | null | undefined
): string | null {
  if (team.image) return team.image;
  if (orgImage && isManagedOrgWideTeam(team)) return orgImage;
  return null;
}
