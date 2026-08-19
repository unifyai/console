/**
 * Choosing which of several shared screens the Meet stage shows large.
 *
 * A call can carry one screen share per participant, so a group call routinely
 * has more than one up at once. The stage renders one at a time, which makes
 * *which* one a decision rather than an implementation detail — and the previous
 * answer, "the last entry LiveKit happened to list", was neither stable nor
 * meaningfully the newest.
 *
 * Kept apart from the component so the choice can be tested without standing up
 * a LiveKit room.
 */

/**
 * One live screen share, as much of it as the focus decision needs.
 *
 * Two kinds share the stage. A `track` is a published LiveKit screenshare. A
 * `liveview` is an assistant's desktop, which is not a media track at all —
 * every participant mounts the VM's own page for itself — so it has no track
 * sid and carries a synthetic one instead. The focus decision only ever compares
 * and orders sids, so it does not care which kind it is looking at.
 */
export type ShareEntry = TrackShareEntry | LiveviewShareEntry;

export interface TrackShareEntry {
  kind: 'track';
  /** LiveKit track sid — stable for the life of the publication. */
  sid: string;
  presenterName: string;
  isLocal: boolean;
}

export interface LiveviewShareEntry {
  kind: 'liveview';
  /** Synthetic, stable for as long as this assistant is presenting. */
  sid: string;
  presenterName: string;
  isLocal: false;
  assistantId: string;
}

/** The focus sid for an assistant presenting its desktop. */
export function liveviewShareSid(assistantId: string): string {
  return `liveview:${assistantId}`;
}

/** When each share was first seen, by track sid. */
export type ShareStartTimes = Record<string, number>;

/**
 * Record first-seen times for shares that are new, and forget ended ones.
 *
 * Returns a fresh object rather than mutating, so a caller holding it in state
 * re-renders when the set of shares changes. Shares that are still up keep
 * their original time — a re-render must not look like a new share, or every
 * render would reshuffle the running order.
 */
export function trackShareStarts(
  shares: ShareEntry[],
  known: ShareStartTimes,
  now: number
): ShareStartTimes {
  const next: ShareStartTimes = {};
  for (const share of shares) {
    next[share.sid] = known[share.sid] ?? now;
  }
  return next;
}

/**
 * Shares in the order they started, oldest first.
 *
 * Ties break on sid so the order is total: two shares can land in the same
 * millisecond, and a comparator that called them equal would leave their
 * relative order down to the input, which is the problem being fixed.
 */
export function sortSharesByStart(shares: ShareEntry[], startedAt: ShareStartTimes): ShareEntry[] {
  return [...shares].sort((a, b) => {
    const delta = (startedAt[a.sid] ?? 0) - (startedAt[b.sid] ?? 0);
    return delta !== 0 ? delta : a.sid.localeCompare(b.sid);
  });
}

/**
 * The share to show large: the viewer's pick while it lasts, else the newest.
 *
 * Falling back to the newest keeps the old latest-presenter-wins behaviour for
 * anyone who never touches the picker, and is what a viewer expects when the
 * screen they were watching goes away. Returns null only when nobody is
 * sharing.
 */
export function resolveFocusedSid(
  shares: ShareEntry[],
  requestedSid: string | null,
  startedAt: ShareStartTimes
): string | null {
  if (shares.length === 0) return null;
  if (requestedSid && shares.some((share) => share.sid === requestedSid)) {
    return requestedSid;
  }
  const ordered = sortSharesByStart(shares, startedAt);
  return ordered[ordered.length - 1]?.sid ?? null;
}

/**
 * How a presenter is named in the picker.
 *
 * A desktop is named after the teammate, exactly like a published track: the
 * picker is a row of who is sharing, and a lone entry reading differently from
 * its neighbours looks like a different kind of thing rather than the same
 * choice. What is on the stage is spelled out by the caption instead.
 */
export function presenterLabel(share: ShareEntry): string {
  if (share.kind === 'liveview') {
    return share.presenterName || 'Teammate';
  }
  return share.isLocal ? 'You' : share.presenterName || 'Teammate';
}

/** Caption over the focused share. */
export function presentingCaption(share: ShareEntry): string {
  if (share.kind === 'liveview') {
    return `${share.presenterName || 'Teammate'} is showing their desktop`;
  }
  return share.isLocal
    ? 'You are presenting'
    : `${share.presenterName || 'Teammate'} is presenting`;
}
