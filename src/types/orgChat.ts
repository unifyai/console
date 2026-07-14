/**
 * Types for the org roster (human members + teams), team group chat, and
 * human-to-human DMs. Each type ships with a `parse*` helper that maps the
 * snake_case Orchestra API payload into the camelCase client shape.
 */

export interface ChatMention {
  kind: 'user' | 'assistant';
  id: string;
  name?: string;
}

export interface RosterHuman {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  roleName: string | null;
  bio: string | null;
  jobTitle: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  timezone: string | null;
  online: boolean;
  lastSeenAt: string | null;
}

export function parseRosterHuman(raw: Record<string, unknown>): RosterHuman {
  return {
    userId: String(raw.user_id ?? ''),
    name: typeof raw.name === 'string' ? raw.name : '',
    email: typeof raw.email === 'string' ? raw.email : '',
    image: typeof raw.image === 'string' ? raw.image : null,
    roleName: typeof raw.role_name === 'string' ? raw.role_name : null,
    bio: typeof raw.bio === 'string' ? raw.bio : null,
    jobTitle: typeof raw.job_title === 'string' ? raw.job_title : null,
    phoneNumber: typeof raw.phone_number === 'string' ? raw.phone_number : null,
    whatsappNumber: typeof raw.whatsapp_number === 'string' ? raw.whatsapp_number : null,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : null,
    online: raw.online === true,
    lastSeenAt: typeof raw.last_seen_at === 'string' ? raw.last_seen_at : null,
  };
}

export interface RosterTeam {
  teamId: number;
  name: string;
  description: string | null;
  isOrgWideSharing: boolean;
  createdAt: string | null;
  memberUserIds: string[];
  assistantMemberIds: number[];
  image: string | null;
}

export function parseRosterTeam(raw: Record<string, unknown>): RosterTeam {
  return {
    teamId: Number(raw.team_id),
    name: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : null,
    isOrgWideSharing: raw.is_org_wide_sharing === true,
    createdAt: typeof raw.created_at === 'string' ? raw.created_at : null,
    memberUserIds: Array.isArray(raw.member_user_ids) ? raw.member_user_ids.map(String) : [],
    assistantMemberIds: Array.isArray(raw.assistant_member_ids)
      ? raw.assistant_member_ids.map(Number)
      : [],
    image: typeof raw.image === 'string' ? raw.image : null,
  };
}

/** Org-wide "Org" teams inherit the organization profile photo when they have none of their own. */
export function withOrgProfileImageForTeams<
  T extends { isOrgWideSharing?: boolean; image?: string | null },
>(teams: T[], orgImage: string | null | undefined): T[] {
  if (!orgImage) return teams;
  return teams.map((team) =>
    team.isOrgWideSharing && !team.image ? { ...team, image: orgImage } : team
  );
}

export interface OrgRoster {
  organizationId: number;
  humans: RosterHuman[];
  teams: RosterTeam[];
}

export function parseOrgRoster(raw: Record<string, unknown>): OrgRoster {
  return {
    organizationId: Number(raw.organization_id),
    humans: Array.isArray(raw.humans)
      ? raw.humans.map((h) => parseRosterHuman(h as Record<string, unknown>))
      : [],
    teams: Array.isArray(raw.teams)
      ? raw.teams.map((t) => parseRosterTeam(t as Record<string, unknown>))
      : [],
  };
}

function parseMentions(raw: unknown): ChatMention[] {
  if (!Array.isArray(raw)) return [];
  const mentions: ChatMention[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const kind = record.kind === 'assistant' ? 'assistant' : 'user';
    const id = record.id != null ? String(record.id) : '';
    if (!id) continue;
    mentions.push({
      kind,
      id,
      ...(typeof record.name === 'string' ? { name: record.name } : {}),
    });
  }
  return mentions;
}

export interface TeamChatMessage {
  messageId: number;
  teamId: number;
  timestamp: string | null;
  senderKind: 'user' | 'assistant';
  senderUserId: string | null;
  senderAssistantId: number | null;
  senderName: string;
  content: string;
  mentions: ChatMention[];
}

export function parseTeamChatMessage(raw: Record<string, unknown>): TeamChatMessage {
  return {
    messageId: Number(raw.message_id),
    teamId: Number(raw.team_id),
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : null,
    senderKind: raw.sender_kind === 'assistant' ? 'assistant' : 'user',
    senderUserId: raw.sender_user_id != null ? String(raw.sender_user_id) : null,
    senderAssistantId: raw.sender_assistant_id != null ? Number(raw.sender_assistant_id) : null,
    senderName: typeof raw.sender_name === 'string' ? raw.sender_name : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    mentions: parseMentions(raw.mentions),
  };
}

export interface DmMessage {
  id: number;
  threadId: number;
  senderUserId: string;
  content: string;
  createdAt: string | null;
}

export function parseDmMessage(raw: Record<string, unknown>): DmMessage {
  return {
    id: Number(raw.id),
    threadId: Number(raw.thread_id),
    senderUserId: raw.sender_user_id != null ? String(raw.sender_user_id) : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    // Realtime DM frames carry `timestamp` where the REST API uses `created_at`.
    createdAt:
      typeof raw.created_at === 'string'
        ? raw.created_at
        : typeof raw.timestamp === 'string'
          ? raw.timestamp
          : null,
  };
}
