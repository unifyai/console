/**
 * Reading who is in a call from the room rather than from the last frame.
 *
 * The regression: a peer who had picked up still showed "ringing…" on the
 * host's side, and the header read "1 joined" over two faces. Participant state
 * arrived only as pushed `call_*` frames, applied only when the frame's call id
 * matched the one already held — so a frame published during an event-stream
 * reconnect, or one that arrived before the local session was set, was dropped
 * and never re-read. The room knows better: connected media is not a claim, it
 * is an observation.
 */
import { describe, expect, it } from 'vitest';
import { isParticipantInCall, presentUserIds } from '@/utils/assistants/call-participants';

const PEER = 'a1b2c3d4-5e6f-7890-abcd-ef1234567890';
const OTHER = '99999999-1111-2222-3333-444444444444';

function room(...identities: string[]) {
  return {
    remoteParticipants: new Map(
      identities.map((identity, i) => [String(i), { identity } as never])
    ),
  } as never;
}

describe('presentUserIds', () => {
  it('finds a user whose media is connected', () => {
    const present = presentUserIds(room(`user-${PEER}-x1y2`), [PEER]);

    expect(present.has(PEER)).toBe(true);
  });

  it('matches a user id containing hyphens', () => {
    /** User ids are UUIDs, so the identity cannot be split back apart. */
    const present = presentUserIds(room(`user-${PEER}-abc123`), [PEER, OTHER]);

    expect([...present]).toEqual([PEER]);
  });

  it('does not match a different user', () => {
    expect(presentUserIds(room(`user-${OTHER}-x1`), [PEER]).size).toBe(0);
  });

  it('does not match on a prefix of a longer id', () => {
    /** ``user-abc-`` must not match a participant whose id is ``abcdef``. */
    const present = presentUserIds(room('user-abcdef-x1'), ['abc']);

    expect(present.size).toBe(0);
  });

  it('ignores an assistant participant', () => {
    /** Agents use their own identity shape and are never a human participant. */
    expect(presentUserIds(room('agent-AJ_123'), [PEER]).size).toBe(0);
  });

  it('reads as nobody present when there is no room yet', () => {
    expect(presentUserIds(null, [PEER]).size).toBe(0);
  });
});

describe('isParticipantInCall', () => {
  it('trusts the session when it already says joined', () => {
    const inCall = isParticipantInCall({ userId: PEER, status: 'joined' }, new Set());

    expect(inCall).toBe(true);
  });

  it('trusts the room when the session is still stale', () => {
    /** The exact bug: answered server-side, the frame never landed. */
    const inCall = isParticipantInCall({ userId: PEER, status: 'invited' }, new Set([PEER]));

    expect(inCall).toBe(true);
  });

  it('keeps ringing for someone who has genuinely not arrived', () => {
    const inCall = isParticipantInCall({ userId: PEER, status: 'invited' }, new Set());

    expect(inCall).toBe(false);
  });

  it('does not resurrect a participant who left', () => {
    /** "left" is filtered out before this point; if it reaches here the room
     *  no longer holds them either, so the two agree. */
    const inCall = isParticipantInCall({ userId: PEER, status: 'left' }, new Set());

    expect(inCall).toBe(false);
  });
});
