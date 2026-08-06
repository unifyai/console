import type { Room } from 'livekit-client';

/**
 * Who is actually in the call, according to the room rather than the signalling.
 *
 * The Console learns that somebody joined from a pushed `call_*` frame, and
 * applies it only when the frame's call matches the one it already holds —
 * otherwise the frame is dropped and nothing ever re-reads the session. A frame
 * published while the event stream was reconnecting, or one that arrived before
 * the local session was set, therefore leaves a participant showing "ringing…"
 * for the rest of the call even though they are in the room and talking.
 *
 * The LiveKit room is the authority on presence: someone whose media is
 * connected has joined, whatever the last snapshot said. Reading presence from
 * it makes the display self-correcting instead of dependent on every frame
 * arriving in order.
 */

/**
 * Console mints participant identities as ``user-{userId}-{random}``.
 * Matching by prefix rather than parsing the id back out: user ids are UUIDs
 * containing hyphens, so splitting is ambiguous while a prefix test is exact.
 */
function identityBelongsTo(identity: string, userId: string): boolean {
  return identity.startsWith(`user-${userId}-`);
}

/** The subset of *candidateUserIds* whose media is connected to *room*. */
export function presentUserIds(
  room: Pick<Room, 'remoteParticipants'> | null,
  candidateUserIds: readonly string[]
): Set<string> {
  const present = new Set<string>();
  if (!room) return present;

  const identities = [...room.remoteParticipants.values()].map((p) => p.identity ?? '');
  for (const userId of candidateUserIds) {
    if (identities.some((identity) => identityBelongsTo(identity, userId))) {
      present.add(userId);
    }
  }
  return present;
}

/**
 * Whether a participant should be shown as being in the call.
 *
 * Presence in the room stands on its own: it is observed rather than reported,
 * so it cannot be missed the way a frame can. Deliberately strict about
 * identity — no display-name fallback — because a wrong match here would show
 * someone as present who never arrived, which is worse than the stale ring it
 * is meant to fix.
 */
export function isParticipantInCall(
  participant: { userId: string; status: string },
  present: Set<string>
): boolean {
  return participant.status === 'joined' || present.has(participant.userId);
}
