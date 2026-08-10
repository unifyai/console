'use client';

import React from 'react';

/**
 * Marks a dashboard/tile row read from the personal root of a team-owned
 * assistant. Team assistants keep all state in their team root, so such a
 * row only exists when a mislabeled session wrote past the team routing —
 * worth surfacing, not hiding, since it usually explains duplicate entries.
 */
export function StrayRootBadge() {
  return (
    <span
      className="shrink-0 rounded-full bg-[color:var(--status-warning-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--status-warning)]"
      title="Stored in the personal root — a team-owned assistant's dashboards belong in its team root. This copy is stray and likely a duplicate."
      data-testid="stray-root-badge"
    >
      stray
    </span>
  );
}

export function isStrayRootRecord(
  record: { originRoot?: string },
  flagPersonalAsStray: boolean
): boolean {
  return flagPersonalAsStray && record.originRoot === 'personal';
}
