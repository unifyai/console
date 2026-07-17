/**
 * Formats the team/group member subtitle shown in the roster list and chat
 * headers. Real count excludes the viewing user so it matches the dropdown,
 * which also omits "you".
 */
export function formatRealVirtualSubtitle(
  memberUserIds: readonly string[],
  assistantMemberCount: number,
  currentUserId: string | null | undefined
): string {
  const realOthers = memberUserIds.filter((id) => id !== currentUserId).length;
  return `${realOthers} real · ${assistantMemberCount} virtual`;
}
