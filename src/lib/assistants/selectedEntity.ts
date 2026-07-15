/**
 * Selector entity encoding.
 *
 * The selection state (`profileAssistantId`, its localStorage mirror, and the
 * `?profile=` URL param) historically held a bare assistant agent id. Humans
 * and teams extend the same string domain with a `kind:` prefix so every
 * existing plumbing layer (panel manager, switcher bridge, URL sync) carries
 * them unchanged; bare strings keep meaning "assistant" for back-compat with
 * old deep links and stored selections.
 */

export type SelectedEntity =
  | { kind: 'assistant'; assistantId: string }
  | { kind: 'human'; userId: string }
  | { kind: 'team'; teamId: number }
  | { kind: 'group'; groupId: number };

const HUMAN_PREFIX = 'human:';
const TEAM_PREFIX = 'team:';
const GROUP_PREFIX = 'group:';

export function humanEntityKey(userId: string): string {
  return `${HUMAN_PREFIX}${userId}`;
}

export function teamEntityKey(teamId: number): string {
  return `${TEAM_PREFIX}${teamId}`;
}

export function groupEntityKey(groupId: number): string {
  return `${GROUP_PREFIX}${groupId}`;
}

/** True when the selection key refers to a human, team, or group (not an assistant). */
export function isNonAssistantEntityKey(key: string | null): boolean {
  if (!key) return false;
  return (
    key.startsWith(HUMAN_PREFIX) || key.startsWith(TEAM_PREFIX) || key.startsWith(GROUP_PREFIX)
  );
}

export function parseSelectedEntityKey(key: string | null): SelectedEntity | null {
  if (!key) return null;
  if (key.startsWith(HUMAN_PREFIX)) {
    const userId = key.slice(HUMAN_PREFIX.length);
    return userId ? { kind: 'human', userId } : null;
  }
  if (key.startsWith(TEAM_PREFIX)) {
    const teamId = Number.parseInt(key.slice(TEAM_PREFIX.length), 10);
    return Number.isFinite(teamId) ? { kind: 'team', teamId } : null;
  }
  if (key.startsWith(GROUP_PREFIX)) {
    const groupId = Number.parseInt(key.slice(GROUP_PREFIX.length), 10);
    return Number.isFinite(groupId) ? { kind: 'group', groupId } : null;
  }
  return { kind: 'assistant', assistantId: key };
}
