/**
 * Types for the org roster (human members, teams, and chat groups), team /
 * group chat, and human-to-human DMs. Each type ships with a `parse*` helper
 * that maps the snake_case Orchestra API payload into the camelCase client shape.
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

/** Org-wide managed teams inherit the organization profile photo when they have none of their own. */
export function withOrgProfileImageForTeams<
  T extends { isOrgWideSharing?: boolean; image?: string | null },
>(teams: T[], orgImage: string | null | undefined): T[] {
  if (!orgImage) return teams;
  return teams.map((team) =>
    team.isOrgWideSharing && !team.image ? { ...team, image: orgImage } : team
  );
}

/** Managed org-wide teams display as the organization name, not a fixed "Org" label. */
export function withOrgNameForManagedTeams<T extends { isOrgWideSharing?: boolean; name: string }>(
  teams: T[],
  orgName: string | null | undefined
): T[] {
  const name = orgName?.trim();
  if (!name) return teams;
  return teams.map((team) => (team.isOrgWideSharing ? { ...team, name } : team));
}

export interface RosterGroup {
  groupId: number;
  name: string;
  createdByUserId: string;
  createdAt: string | null;
  memberUserIds: string[];
  assistantMemberIds: number[];
}

export function parseRosterGroup(raw: Record<string, unknown>): RosterGroup {
  const groupIdRaw = raw.group_id ?? raw.groupId;
  const createdByRaw = raw.created_by_user_id ?? raw.createdByUserId;
  const memberUserIdsRaw = raw.member_user_ids ?? raw.memberUserIds;
  const assistantMemberIdsRaw = raw.assistant_member_ids ?? raw.assistantMemberIds;
  return {
    groupId: Number(groupIdRaw),
    name: typeof raw.name === 'string' ? raw.name : '',
    createdByUserId: createdByRaw != null ? String(createdByRaw) : '',
    createdAt:
      typeof raw.created_at === 'string'
        ? raw.created_at
        : typeof raw.createdAt === 'string'
          ? raw.createdAt
          : null,
    memberUserIds: Array.isArray(memberUserIdsRaw) ? memberUserIdsRaw.map(String) : [],
    assistantMemberIds: Array.isArray(assistantMemberIdsRaw)
      ? assistantMemberIdsRaw.map(Number)
      : [],
  };
}

export interface OrgRoster {
  organizationId: number;
  humans: RosterHuman[];
  teams: RosterTeam[];
  groups: RosterGroup[];
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
    groups: Array.isArray(raw.groups)
      ? raw.groups.map((g) => parseRosterGroup(g as Record<string, unknown>))
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

export interface OrgChatReaction {
  userId: string;
  emoji: string;
  updatedAt?: string;
}

function parseReactions(raw: unknown): OrgChatReaction[] {
  if (!Array.isArray(raw)) return [];
  const reactions: OrgChatReaction[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const userId = record.user_id ?? record.userId;
    const emoji = record.emoji;
    if (typeof userId !== 'string' || !userId) continue;
    if (typeof emoji !== 'string' || !emoji.trim()) continue;
    const updatedAt = record.updated_at ?? record.updatedAt;
    reactions.push({
      userId,
      emoji,
      ...(typeof updatedAt === 'string' ? { updatedAt } : {}),
    });
  }
  return reactions;
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
  attachments: OrgChatAttachment[];
  reactions: OrgChatReaction[];
}

export interface OrgChatAttachment {
  id: string;
  filename: string;
  gsUrl?: string;
  contentType?: string;
  sizeBytes?: number;
  signedUrl?: string;
}

function parseAttachments(raw: unknown): OrgChatAttachment[] {
  if (!Array.isArray(raw)) return [];
  const attachments: OrgChatAttachment[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const id = record.id != null ? String(record.id) : '';
    const filename = typeof record.filename === 'string' ? record.filename : '';
    if (!id || !filename) continue;
    attachments.push({
      id,
      filename,
      ...(typeof record.gs_url === 'string'
        ? { gsUrl: record.gs_url }
        : typeof record.gsUrl === 'string'
          ? { gsUrl: record.gsUrl }
          : {}),
      ...(typeof record.content_type === 'string'
        ? { contentType: record.content_type }
        : typeof record.contentType === 'string'
          ? { contentType: record.contentType }
          : {}),
      ...(typeof record.size_bytes === 'number'
        ? { sizeBytes: record.size_bytes }
        : typeof record.sizeBytes === 'number'
          ? { sizeBytes: record.sizeBytes }
          : {}),
      ...(typeof record.signed_url === 'string'
        ? { signedUrl: record.signed_url }
        : typeof record.signedUrl === 'string'
          ? { signedUrl: record.signedUrl }
          : {}),
    });
  }
  return attachments;
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
    attachments: parseAttachments(raw.attachments),
    reactions: parseReactions(raw.reactions),
  };
}

export interface GroupChatMessage {
  messageId: number;
  groupId: number;
  timestamp: string | null;
  senderKind: 'user' | 'assistant';
  senderUserId: string | null;
  senderAssistantId: number | null;
  senderName: string;
  content: string;
  mentions: ChatMention[];
  attachments: OrgChatAttachment[];
  reactions: OrgChatReaction[];
}

export function parseGroupChatMessage(raw: Record<string, unknown>): GroupChatMessage {
  return {
    messageId: Number(raw.message_id),
    groupId: Number(raw.group_id),
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : null,
    senderKind: raw.sender_kind === 'assistant' ? 'assistant' : 'user',
    senderUserId: raw.sender_user_id != null ? String(raw.sender_user_id) : null,
    senderAssistantId: raw.sender_assistant_id != null ? Number(raw.sender_assistant_id) : null,
    senderName: typeof raw.sender_name === 'string' ? raw.sender_name : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    mentions: parseMentions(raw.mentions),
    attachments: parseAttachments(raw.attachments),
    reactions: parseReactions(raw.reactions),
  };
}

export interface DmMessage {
  id: number;
  threadId: number;
  senderUserId: string;
  content: string;
  createdAt: string | null;
  attachments: OrgChatAttachment[];
  reactions: OrgChatReaction[];
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
    attachments: parseAttachments(raw.attachments),
    reactions: parseReactions(raw.reactions),
  };
}

export interface OrgChatSearchResult {
  id: string;
  scope: 'dm' | 'team' | 'group';
  content: string;
  timestamp: string | null;
  senderName: string;
}

export function parseOrgChatSearchResult(raw: Record<string, unknown>): OrgChatSearchResult {
  return {
    id: String(raw.id ?? ''),
    scope: raw.scope === 'team' ? 'team' : raw.scope === 'group' ? 'group' : 'dm',
    content: typeof raw.content === 'string' ? raw.content : '',
    timestamp:
      typeof raw.timestamp === 'string'
        ? raw.timestamp
        : typeof raw.created_at === 'string'
          ? raw.created_at
          : null,
    senderName: typeof raw.sender_name === 'string' ? raw.sender_name : '',
  };
}

export type OrgCallScope = 'dm' | 'team' | 'group';
export type OrgCallStatus = 'ringing' | 'active' | 'ended';
export type OrgCallParticipantStatus = 'invited' | 'joined' | 'declined' | 'left';

export interface OrgCallParticipant {
  userId: string;
  role: 'host' | 'member';
  status: OrgCallParticipantStatus;
}

export interface OrgCallSession {
  callId: string;
  roomName: string;
  status: OrgCallStatus;
  scope: OrgCallScope;
  createdByUserId: string;
  callerUserId: string;
  calleeUserId: string | null;
  teamId: number | null;
  groupId: number | null;
  dmThreadId: number | null;
  userIds: string[];
  participants: OrgCallParticipant[];
  assistantIds: number[];
  roster: OrgCallRosterMember[];
}

export interface OrgCallRosterMember {
  kind: 'human' | 'assistant';
  userId: string | null;
  assistantId: number | null;
  displayName: string;
  contactId: number | null;
  email: string | null;
}

/** @deprecated Use OrgCallSession — kept for transitional imports. */
export type HumanCallSession = OrgCallSession;

export function parseOrgCallSession(raw: Record<string, unknown>): OrgCallSession {
  const statusRaw = String(raw.status ?? 'ringing');
  const status: OrgCallStatus =
    statusRaw === 'active' || statusRaw === 'ended' ? statusRaw : 'ringing';
  const scopeRaw = String(raw.scope ?? 'dm');
  const scope: OrgCallScope = scopeRaw === 'team' ? 'team' : scopeRaw === 'group' ? 'group' : 'dm';
  const participantsRaw = Array.isArray(raw.participants) ? raw.participants : [];
  const participants: OrgCallParticipant[] = participantsRaw.map((p) => {
    const row = (p ?? {}) as Record<string, unknown>;
    const pStatus = String(row.status ?? 'invited');
    const statusParsed: OrgCallParticipantStatus =
      pStatus === 'joined' || pStatus === 'declined' || pStatus === 'left' ? pStatus : 'invited';
    return {
      userId: String(row.user_id ?? ''),
      role: row.role === 'host' ? 'host' : 'member',
      status: statusParsed,
    };
  });
  const userIds = Array.isArray(raw.user_ids)
    ? raw.user_ids.map(String)
    : participants.map((p) => p.userId);
  const createdBy = String(raw.created_by_user_id ?? raw.caller_user_id ?? '');
  const rosterRaw = Array.isArray(raw.roster) ? raw.roster : [];
  const roster: OrgCallRosterMember[] = rosterRaw.map((r) => {
    const row = (r ?? {}) as Record<string, unknown>;
    return {
      kind: row.kind === 'assistant' ? 'assistant' : 'human',
      userId: row.user_id == null || row.user_id === '' ? null : String(row.user_id),
      assistantId:
        row.assistant_id == null || row.assistant_id === '' ? null : Number(row.assistant_id),
      displayName: typeof row.display_name === 'string' ? row.display_name : '',
      contactId: row.contact_id == null || row.contact_id === '' ? null : Number(row.contact_id),
      email: typeof row.email === 'string' ? row.email : null,
    };
  });
  return {
    callId: String(raw.call_id ?? ''),
    roomName: typeof raw.room_name === 'string' ? raw.room_name : '',
    status,
    scope,
    createdByUserId: createdBy,
    callerUserId: String(raw.caller_user_id ?? createdBy),
    calleeUserId:
      raw.callee_user_id == null || raw.callee_user_id === '' ? null : String(raw.callee_user_id),
    teamId: raw.team_id == null || raw.team_id === '' ? null : Number(raw.team_id),
    groupId: raw.group_id == null || raw.group_id === '' ? null : Number(raw.group_id),
    dmThreadId:
      raw.dm_thread_id == null && raw.thread_id == null
        ? null
        : Number(raw.dm_thread_id ?? raw.thread_id),
    userIds,
    participants,
    assistantIds: Array.isArray(raw.assistant_ids)
      ? raw.assistant_ids.map(Number).filter((n) => !Number.isNaN(n))
      : [],
    roster,
  };
}

export const parseHumanCallSession = parseOrgCallSession;
