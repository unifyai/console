import * as React from 'react';
import {
  ChatMention,
  DmMessage,
  GroupChatMessage,
  OrgChatAttachment,
  OrgChatReaction,
  TeamChatMessage,
  parseDmMessage,
  parseGroupChatMessage,
  parseTeamChatMessage,
} from '@/types/orgChat';
import { applyOrgReactionUpdate } from '@/utils/assistants/chat-reactions';
import { toast } from 'sonner';

// Retry forever with capped backoff: giving up permanently would leave the
// session without live org chat until a reload (e.g. after a transient 503
// while the per-org topic is provisioned).
const SSE_RECONNECT_BASE_DELAY = 1000;
const SSE_RECONNECT_MAX_DELAY = 60_000;

export interface UseOrgChatParams {
  orgId: string | null;
  currentUserId: string | null;
  enabled: boolean;
  /**
   * Fires when an inbound team/DM frame authored by another human arrives.
   * Callers typically wire this to `markHumanOnline` so presence dots react
   * to live activity ahead of the next roster poll.
   */
  onHumanActivity?: (userId: string) => void;
}

/**
 * Find a not-yet-confirmed optimistic send (negative temp id) matching an
 * incoming server-id copy of the same message. The author's own SSE echo can
 * beat the POST response, so upgrading the optimistic bubble in place (rather
 * than appending) prevents a transient duplicate.
 */
function findOptimisticIndex<T>(
  current: T[],
  message: T,
  getId: (m: T) => number,
  getSender: (m: T) => string | null | undefined,
  getContent: (m: T) => string
): number {
  return current.findIndex(
    (m) =>
      getId(m) < 0 && getSender(m) === getSender(message) && getContent(m) === getContent(message)
  );
}

function appendTeamMessage(
  existing: TeamChatMessage[] | undefined,
  message: TeamChatMessage
): TeamChatMessage[] {
  const current = existing ?? [];
  if (current.some((m) => m.messageId === message.messageId)) return current;
  const optimisticIndex = findOptimisticIndex(
    current,
    message,
    (m) => m.messageId,
    (m) => m.senderUserId,
    (m) => m.content
  );
  if (optimisticIndex !== -1) {
    const updated = [...current];
    updated[optimisticIndex] = message;
    return updated;
  }
  return [...current, message];
}

function appendGroupMessage(
  existing: GroupChatMessage[] | undefined,
  message: GroupChatMessage
): GroupChatMessage[] {
  const current = existing ?? [];
  if (current.some((m) => m.messageId === message.messageId)) return current;
  const optimisticIndex = findOptimisticIndex(
    current,
    message,
    (m) => m.messageId,
    (m) => m.senderUserId,
    (m) => m.content
  );
  if (optimisticIndex !== -1) {
    const updated = [...current];
    updated[optimisticIndex] = message;
    return updated;
  }
  return [...current, message];
}

function appendDmMessage(existing: DmMessage[] | undefined, message: DmMessage): DmMessage[] {
  const current = existing ?? [];
  if (current.some((m) => m.id === message.id)) return current;
  const optimisticIndex = findOptimisticIndex(
    current,
    message,
    (m) => m.id,
    (m) => m.senderUserId,
    (m) => m.content
  );
  if (optimisticIndex !== -1) {
    const updated = [...current];
    updated[optimisticIndex] = message;
    return updated;
  }
  return [...current, message];
}

function dedupeTeamMessages(messages: TeamChatMessage[]): TeamChatMessage[] {
  const seen = new Set<number>();
  return messages.filter((m) => {
    if (seen.has(m.messageId)) return false;
    seen.add(m.messageId);
    return true;
  });
}

function dedupeGroupMessages(messages: GroupChatMessage[]): GroupChatMessage[] {
  const seen = new Set<number>();
  return messages.filter((m) => {
    if (seen.has(m.messageId)) return false;
    seen.add(m.messageId);
    return true;
  });
}

function dedupeDmMessages(messages: DmMessage[]): DmMessage[] {
  const seen = new Set<number>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function toOrgReactions(reactions: ReturnType<typeof applyOrgReactionUpdate>): OrgChatReaction[] {
  return reactions
    .filter((reaction): reaction is typeof reaction & { userId: string } => !!reaction.userId)
    .map((reaction) => ({
      userId: reaction.userId,
      emoji: reaction.emoji,
      ...(reaction.updatedAt ? { updatedAt: reaction.updatedAt.toISOString() } : {}),
    }));
}

function asMessageReactions(reactions: OrgChatReaction[] | undefined) {
  return (reactions ?? []).map((reaction) => ({
    userId: reaction.userId,
    emoji: reaction.emoji,
    ...(reaction.updatedAt ? { updatedAt: new Date(reaction.updatedAt) } : {}),
  }));
}

/**
 * Client engine for org chat: one SSE connection per org multiplexing every
 * team/group-chat and DM frame the user may see, plus history loading and
 * optimistic sends against the REST proxy routes.
 */
export function useOrgChat(params: UseOrgChatParams) {
  const { orgId, currentUserId, enabled, onHumanActivity } = params;

  const [teamMessages, setTeamMessages] = React.useState<Record<number, TeamChatMessage[]>>({});
  const [groupMessages, setGroupMessages] = React.useState<Record<number, GroupChatMessage[]>>({});
  const [dmMessages, setDmMessages] = React.useState<Record<string, DmMessage[]>>({});
  const [unread, setUnread] = React.useState<Record<string, number>>({});

  const currentUserIdRef = React.useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const onHumanActivityRef = React.useRef(onHumanActivity);
  onHumanActivityRef.current = onHumanActivity;

  React.useEffect(() => {
    setTeamMessages({});
    setGroupMessages({});
    setDmMessages({});
    setUnread({});
  }, [orgId]);

  const bumpUnread = React.useCallback((key: string) => {
    setUnread((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }, []);

  const clearUnread = React.useCallback((key: string) => {
    setUnread((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleTeamFrame = React.useCallback(
    (event: Record<string, unknown>) => {
      const message = parseTeamChatMessage(event);
      if (isNaN(message.teamId) || isNaN(message.messageId)) return;
      setTeamMessages((prev) => {
        const next = appendTeamMessage(prev[message.teamId], message);
        if (next === prev[message.teamId]) return prev;
        return { ...prev, [message.teamId]: next };
      });
      const isSelf =
        message.senderKind === 'user' && message.senderUserId === currentUserIdRef.current;
      if (!isSelf) {
        bumpUnread(`team:${message.teamId}`);
        if (message.senderKind === 'user' && message.senderUserId) {
          onHumanActivityRef.current?.(message.senderUserId);
        }
      }
    },
    [bumpUnread]
  );

  const handleGroupFrame = React.useCallback(
    (event: Record<string, unknown>) => {
      const message = parseGroupChatMessage(event);
      if (isNaN(message.groupId) || isNaN(message.messageId)) return;
      setGroupMessages((prev) => {
        const next = appendGroupMessage(prev[message.groupId], message);
        if (next === prev[message.groupId]) return prev;
        return { ...prev, [message.groupId]: next };
      });
      const isSelf =
        message.senderKind === 'user' && message.senderUserId === currentUserIdRef.current;
      if (!isSelf) {
        bumpUnread(`group:${message.groupId}`);
        if (message.senderKind === 'user' && message.senderUserId) {
          onHumanActivityRef.current?.(message.senderUserId);
        }
      }
    },
    [bumpUnread]
  );

  const handleDmFrame = React.useCallback(
    (event: Record<string, unknown>) => {
      const myUserId = currentUserIdRef.current;
      if (!myUserId) return;
      const userIds = Array.isArray(event.user_ids) ? event.user_ids.map(String) : [];
      const otherUserId = userIds.find((id) => id !== myUserId);
      if (!otherUserId) return;
      const message = parseDmMessage(event);
      if (isNaN(message.id)) return;
      setDmMessages((prev) => {
        const next = appendDmMessage(prev[otherUserId], message);
        if (next === prev[otherUserId]) return prev;
        return { ...prev, [otherUserId]: next };
      });
      if (message.senderUserId !== myUserId) {
        bumpUnread(`human:${otherUserId}`);
        onHumanActivityRef.current?.(message.senderUserId);
      }
    },
    [bumpUnread]
  );

  const handleTeamReactionFrame = React.useCallback((event: Record<string, unknown>) => {
    const message = parseTeamChatMessage(event);
    if (isNaN(message.teamId) || isNaN(message.messageId)) return;
    setTeamMessages((prev) => {
      const current = prev[message.teamId] ?? [];
      const index = current.findIndex((m) => m.messageId === message.messageId);
      if (index === -1) return prev;
      const updated = [...current];
      updated[index] = { ...updated[index], reactions: message.reactions };
      return { ...prev, [message.teamId]: updated };
    });
  }, []);

  const handleGroupReactionFrame = React.useCallback((event: Record<string, unknown>) => {
    const message = parseGroupChatMessage(event);
    if (isNaN(message.groupId) || isNaN(message.messageId)) return;
    setGroupMessages((prev) => {
      const current = prev[message.groupId] ?? [];
      const index = current.findIndex((m) => m.messageId === message.messageId);
      if (index === -1) return prev;
      const updated = [...current];
      updated[index] = { ...updated[index], reactions: message.reactions };
      return { ...prev, [message.groupId]: updated };
    });
  }, []);

  const handleDmReactionFrame = React.useCallback((event: Record<string, unknown>) => {
    const myUserId = currentUserIdRef.current;
    if (!myUserId) return;
    const userIds = Array.isArray(event.user_ids) ? event.user_ids.map(String) : [];
    const otherUserId = userIds.find((id) => id !== myUserId);
    if (!otherUserId) return;
    const message = parseDmMessage(event);
    if (isNaN(message.id)) return;
    setDmMessages((prev) => {
      const current = prev[otherUserId] ?? [];
      const index = current.findIndex((m) => m.id === message.id);
      if (index === -1) return prev;
      const updated = [...current];
      updated[index] = { ...updated[index], reactions: message.reactions };
      return { ...prev, [otherUserId]: updated };
    });
  }, []);

  const handleTeamFrameRef = React.useRef(handleTeamFrame);
  handleTeamFrameRef.current = handleTeamFrame;
  const handleGroupFrameRef = React.useRef(handleGroupFrame);
  handleGroupFrameRef.current = handleGroupFrame;
  const handleDmFrameRef = React.useRef(handleDmFrame);
  handleDmFrameRef.current = handleDmFrame;
  const handleTeamReactionFrameRef = React.useRef(handleTeamReactionFrame);
  handleTeamReactionFrameRef.current = handleTeamReactionFrame;
  const handleGroupReactionFrameRef = React.useRef(handleGroupReactionFrame);
  handleGroupReactionFrameRef.current = handleGroupReactionFrame;
  const handleDmReactionFrameRef = React.useRef(handleDmReactionFrame);
  handleDmReactionFrameRef.current = handleDmReactionFrame;

  React.useEffect(() => {
    if (!enabled || !orgId) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      eventSource = new EventSource(`/api/org-chat/events?orgId=${encodeURIComponent(orgId)}`);

      eventSource.onopen = () => {
        attempts = 0;
      };

      eventSource.onmessage = (event) => {
        let frame: { thread?: string; event?: Record<string, unknown> };
        try {
          frame = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!frame.event || typeof frame.event !== 'object') return;
        // Unified chat-store frames: one thread name, demuxed by the
        // message payload's thread kind.
        const kind = (frame.event as Record<string, unknown>).kind;
        if (frame.thread === 'chat_message') {
          if (kind === 'team') {
            handleTeamFrameRef.current(frame.event);
          } else if (kind === 'group') {
            handleGroupFrameRef.current(frame.event);
          } else if (kind === 'dm') {
            handleDmFrameRef.current(frame.event);
          }
        } else if (frame.thread === 'chat_reaction') {
          if (kind === 'team') {
            handleTeamReactionFrameRef.current(frame.event);
          } else if (kind === 'group') {
            handleGroupReactionFrameRef.current(frame.event);
          } else if (kind === 'dm') {
            handleDmReactionFrameRef.current(frame.event);
          }
        }
        // Org call signaling frames stream on the app-level `channel=calls`
        // connection owned by the app-level CallProvider, not this chat stream.
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (disposed) return;
        const delay = Math.min(
          SSE_RECONNECT_BASE_DELAY * Math.pow(2, attempts),
          SSE_RECONNECT_MAX_DELAY
        );
        attempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [enabled, orgId]);

  const loadTeamHistory = React.useCallback(
    async (teamId: number) => {
      if (!orgId) return;
      try {
        const response = await fetch(`/api/organizations/${orgId}/teams/${teamId}/messages`);
        if (!response.ok) return;
        const data = await response.json();
        const messages: TeamChatMessage[] = Array.isArray(data?.messages)
          ? data.messages.map((m: Record<string, unknown>) => parseTeamChatMessage(m))
          : [];
        setTeamMessages((prev) => ({ ...prev, [teamId]: dedupeTeamMessages(messages) }));
      } catch {
        // History load is retried on next open; live frames still stream in.
      }
    },
    [orgId]
  );

  const loadGroupHistory = React.useCallback(
    async (groupId: number) => {
      if (!orgId) return;
      try {
        const response = await fetch(`/api/organizations/${orgId}/groups/${groupId}/messages`);
        if (!response.ok) return;
        const data = await response.json();
        const messages: GroupChatMessage[] = Array.isArray(data?.messages)
          ? data.messages.map((m: Record<string, unknown>) => parseGroupChatMessage(m))
          : [];
        setGroupMessages((prev) => ({ ...prev, [groupId]: dedupeGroupMessages(messages) }));
      } catch {
        // History load is retried on next open; live frames still stream in.
      }
    },
    [orgId]
  );

  const loadDmHistory = React.useCallback(
    async (otherUserId: string) => {
      if (!orgId) return;
      try {
        const response = await fetch(
          `/api/organizations/${orgId}/dms/${encodeURIComponent(otherUserId)}/messages`
        );
        if (!response.ok) return;
        const data = await response.json();
        const messages: DmMessage[] = Array.isArray(data?.messages)
          ? data.messages.map((m: Record<string, unknown>) => parseDmMessage(m))
          : [];
        setDmMessages((prev) => ({ ...prev, [otherUserId]: dedupeDmMessages(messages) }));
      } catch {
        // History load is retried on next open; live frames still stream in.
      }
    },
    [orgId]
  );

  const sendTeamMessage = React.useCallback(
    async (
      teamId: number,
      content: string,
      mentions: ChatMention[] = [],
      attachments: OrgChatAttachment[] = []
    ): Promise<boolean> => {
      if (!orgId) return false;
      if (!content.trim() && attachments.length === 0) return false;
      const tempId = -Date.now();
      const optimistic: TeamChatMessage = {
        messageId: tempId,
        teamId,
        timestamp: new Date().toISOString(),
        senderKind: 'user',
        senderUserId: currentUserIdRef.current,
        senderAssistantId: null,
        senderName: 'You',
        content,
        mentions,
        attachments,
        reactions: [],
      };
      setTeamMessages((prev) => ({
        ...prev,
        [teamId]: [...(prev[teamId] ?? []), optimistic],
      }));

      try {
        const response = await fetch(`/api/organizations/${orgId}/teams/${teamId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, mentions, attachments }),
        });
        if (!response.ok) throw new Error(`send failed (${response.status})`);
        const data = await response.json();
        const serverMessage = parseTeamChatMessage(data);
        setTeamMessages((prev) => {
          const withoutTemp = (prev[teamId] ?? []).filter((m) => m.messageId !== tempId);
          return { ...prev, [teamId]: appendTeamMessage(withoutTemp, serverMessage) };
        });
        return true;
      } catch {
        setTeamMessages((prev) => ({
          ...prev,
          [teamId]: (prev[teamId] ?? []).filter((m) => m.messageId !== tempId),
        }));
        return false;
      }
    },
    [orgId]
  );

  const sendGroupMessage = React.useCallback(
    async (
      groupId: number,
      content: string,
      mentions: ChatMention[] = [],
      attachments: OrgChatAttachment[] = []
    ): Promise<boolean> => {
      if (!orgId) return false;
      if (!content.trim() && attachments.length === 0) return false;
      const tempId = -Date.now();
      const optimistic: GroupChatMessage = {
        messageId: tempId,
        groupId,
        timestamp: new Date().toISOString(),
        senderKind: 'user',
        senderUserId: currentUserIdRef.current,
        senderAssistantId: null,
        senderName: 'You',
        content,
        mentions,
        attachments,
        reactions: [],
      };
      setGroupMessages((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), optimistic],
      }));

      try {
        const response = await fetch(`/api/organizations/${orgId}/groups/${groupId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, mentions, attachments }),
        });
        if (!response.ok) throw new Error(`send failed (${response.status})`);
        const data = await response.json();
        const serverMessage = parseGroupChatMessage(data);
        setGroupMessages((prev) => {
          const withoutTemp = (prev[groupId] ?? []).filter((m) => m.messageId !== tempId);
          return { ...prev, [groupId]: appendGroupMessage(withoutTemp, serverMessage) };
        });
        return true;
      } catch {
        setGroupMessages((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] ?? []).filter((m) => m.messageId !== tempId),
        }));
        return false;
      }
    },
    [orgId]
  );

  const sendDmMessage = React.useCallback(
    async (
      otherUserId: string,
      content: string,
      attachments: OrgChatAttachment[] = []
    ): Promise<boolean> => {
      if (!orgId) return false;
      if (!content.trim() && attachments.length === 0) return false;
      const tempId = -Date.now();
      const optimistic: DmMessage = {
        id: tempId,
        threadId: 0,
        senderUserId: currentUserIdRef.current ?? '',
        content,
        createdAt: new Date().toISOString(),
        attachments,
        reactions: [],
      };
      setDmMessages((prev) => ({
        ...prev,
        [otherUserId]: [...(prev[otherUserId] ?? []), optimistic],
      }));

      try {
        const response = await fetch(
          `/api/organizations/${orgId}/dms/${encodeURIComponent(otherUserId)}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, attachments }),
          }
        );
        if (!response.ok) throw new Error(`send failed (${response.status})`);
        const data = await response.json();
        const serverMessage = parseDmMessage(data);
        setDmMessages((prev) => {
          const withoutTemp = (prev[otherUserId] ?? []).filter((m) => m.id !== tempId);
          return { ...prev, [otherUserId]: appendDmMessage(withoutTemp, serverMessage) };
        });
        return true;
      } catch {
        setDmMessages((prev) => ({
          ...prev,
          [otherUserId]: (prev[otherUserId] ?? []).filter((m) => m.id !== tempId),
        }));
        return false;
      }
    },
    [orgId]
  );

  const toggleTeamReaction = React.useCallback(
    async (teamId: number, messageId: number, emoji: string) => {
      if (!orgId || !currentUserIdRef.current) return;
      const userId = currentUserIdRef.current;
      let previous: OrgChatReaction[] | undefined;
      setTeamMessages((prev) => {
        const current = prev[teamId] ?? [];
        const index = current.findIndex((m) => m.messageId === messageId);
        if (index === -1) return prev;
        previous = current[index].reactions;
        const existing = previous?.find((reaction) => reaction.userId === userId);
        const nextEmoji = existing?.emoji === emoji ? null : emoji;
        const updated = [...current];
        updated[index] = {
          ...updated[index],
          reactions: toOrgReactions(
            applyOrgReactionUpdate(asMessageReactions(previous), userId, nextEmoji)
          ),
        };
        return { ...prev, [teamId]: updated };
      });
      if (previous === undefined) return;

      try {
        const response = await fetch(
          `/api/organizations/${orgId}/teams/${teamId}/messages/${messageId}/reactions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              emoji: previous.find((r) => r.userId === userId)?.emoji === emoji ? null : emoji,
            }),
          }
        );
        if (!response.ok) throw new Error(`react failed (${response.status})`);
        const data = await response.json();
        const serverMessage = parseTeamChatMessage(data);
        setTeamMessages((prev) => {
          const current = prev[teamId] ?? [];
          const index = current.findIndex((m) => m.messageId === messageId);
          if (index === -1) return prev;
          const updated = [...current];
          updated[index] = { ...updated[index], reactions: serverMessage.reactions };
          return { ...prev, [teamId]: updated };
        });
      } catch {
        setTeamMessages((prev) => {
          const current = prev[teamId] ?? [];
          const index = current.findIndex((m) => m.messageId === messageId);
          if (index === -1 || previous === undefined) return prev;
          const updated = [...current];
          updated[index] = { ...updated[index], reactions: previous };
          return { ...prev, [teamId]: updated };
        });
        toast.error('Could not update reaction. Please try again.');
      }
    },
    [orgId]
  );

  const toggleGroupReaction = React.useCallback(
    async (groupId: number, messageId: number, emoji: string) => {
      if (!orgId || !currentUserIdRef.current) return;
      const userId = currentUserIdRef.current;
      let previous: OrgChatReaction[] | undefined;
      let nextEmoji: string | null = null;
      setGroupMessages((prev) => {
        const current = prev[groupId] ?? [];
        const index = current.findIndex((m) => m.messageId === messageId);
        if (index === -1) return prev;
        previous = current[index].reactions;
        const existing = previous?.find((reaction) => reaction.userId === userId);
        nextEmoji = existing?.emoji === emoji ? null : emoji;
        const updated = [...current];
        updated[index] = {
          ...updated[index],
          reactions: toOrgReactions(
            applyOrgReactionUpdate(asMessageReactions(previous), userId, nextEmoji)
          ),
        };
        return { ...prev, [groupId]: updated };
      });
      if (previous === undefined) return;

      try {
        const response = await fetch(
          `/api/organizations/${orgId}/groups/${groupId}/messages/${messageId}/reactions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji: nextEmoji }),
          }
        );
        if (!response.ok) throw new Error(`react failed (${response.status})`);
        const data = await response.json();
        const serverMessage = parseGroupChatMessage(data);
        setGroupMessages((prev) => {
          const current = prev[groupId] ?? [];
          const index = current.findIndex((m) => m.messageId === messageId);
          if (index === -1) return prev;
          const updated = [...current];
          updated[index] = { ...updated[index], reactions: serverMessage.reactions };
          return { ...prev, [groupId]: updated };
        });
      } catch {
        setGroupMessages((prev) => {
          const current = prev[groupId] ?? [];
          const index = current.findIndex((m) => m.messageId === messageId);
          if (index === -1 || previous === undefined) return prev;
          const updated = [...current];
          updated[index] = { ...updated[index], reactions: previous };
          return { ...prev, [groupId]: updated };
        });
        toast.error('Could not update reaction. Please try again.');
      }
    },
    [orgId]
  );

  const toggleDmReaction = React.useCallback(
    async (otherUserId: string, messageId: number, emoji: string) => {
      if (!orgId || !currentUserIdRef.current) return;
      const userId = currentUserIdRef.current;
      let previous: OrgChatReaction[] | undefined;
      let nextEmoji: string | null = null;
      setDmMessages((prev) => {
        const current = prev[otherUserId] ?? [];
        const index = current.findIndex((m) => m.id === messageId);
        if (index === -1) return prev;
        previous = current[index].reactions;
        const existing = previous?.find((reaction) => reaction.userId === userId);
        nextEmoji = existing?.emoji === emoji ? null : emoji;
        const updated = [...current];
        updated[index] = {
          ...updated[index],
          reactions: toOrgReactions(
            applyOrgReactionUpdate(asMessageReactions(previous), userId, nextEmoji)
          ),
        };
        return { ...prev, [otherUserId]: updated };
      });
      if (previous === undefined) return;

      try {
        const response = await fetch(
          `/api/organizations/${orgId}/dms/${encodeURIComponent(otherUserId)}/messages/${messageId}/reactions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji: nextEmoji }),
          }
        );
        if (!response.ok) throw new Error(`react failed (${response.status})`);
        const data = await response.json();
        const serverMessage = parseDmMessage(data);
        setDmMessages((prev) => {
          const current = prev[otherUserId] ?? [];
          const index = current.findIndex((m) => m.id === messageId);
          if (index === -1) return prev;
          const updated = [...current];
          updated[index] = { ...updated[index], reactions: serverMessage.reactions };
          return { ...prev, [otherUserId]: updated };
        });
      } catch {
        setDmMessages((prev) => {
          const current = prev[otherUserId] ?? [];
          const index = current.findIndex((m) => m.id === messageId);
          if (index === -1 || previous === undefined) return prev;
          const updated = [...current];
          updated[index] = { ...updated[index], reactions: previous };
          return { ...prev, [otherUserId]: updated };
        });
        toast.error('Could not update reaction. Please try again.');
      }
    },
    [orgId]
  );

  return {
    teamMessages,
    groupMessages,
    dmMessages,
    unread,
    clearUnread,
    loadTeamHistory,
    loadGroupHistory,
    loadDmHistory,
    sendTeamMessage,
    sendGroupMessage,
    sendDmMessage,
    toggleTeamReaction,
    toggleGroupReaction,
    toggleDmReaction,
  };
}
