/**
 * Formats the team/group member subtitle shown in the roster list and chat
 * headers. Both counts cover the whole membership, including the viewing user,
 * so the subtitle matches the roster list below it — which renders the viewer
 * as an ordinary row marked "(you)".
 */
export function formatRealVirtualSubtitle(
  memberUserIds: readonly string[],
  assistantMemberCount: number
): string {
  return `${memberUserIds.length} real · ${assistantMemberCount} virtual`;
}
