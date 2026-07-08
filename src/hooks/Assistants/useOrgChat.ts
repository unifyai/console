import * as React from 'react';
import {
  ChatMention,
  DmMessage,
  TeamChatMessage,
  parseDmMessage,
  parseTeamChatMessage,
} from '@/types/orgChat';

const SSE_MAX_RECONNECT_ATTEMPTS = 5;
const SSE_RECONNECT_BASE_DELAY = 1000;

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

function appendTeamMessage(
  existing: TeamChatMessage[] | undefined,
  message: TeamChatMessage
): TeamChatMessage[] {
  const current = existing ?? [];
  if (current.some((m) => m.messageId === message.messageId)) return current;
  return [...current, message];
}

function appendDmMessage(existing: DmMessage[] | undefined, message: DmMessage): DmMessage[] {
  const current = existing ?? [];
  if (current.some((m) => m.id === message.id)) return current;
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

function dedupeDmMessages(messages: DmMessage[]): DmMessage[] {
  const seen = new Set<number>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/**
 * Client engine for org chat: one SSE connection per org multiplexing every
 * team-chat and DM frame the user may see, plus history loading and
 * optimistic sends against the REST proxy routes.
 */
export function useOrgChat(params: UseOrgChatParams) {
  const { orgId, currentUserId, enabled, onHumanActivity } = params;

  const [teamMessages, setTeamMessages] = React.useState<Record<number, TeamChatMessage[]>>({});
  const [dmMessages, setDmMessages] = React.useState<Record<string, DmMessage[]>>({});
  const [unread, setUnread] = React.useState<Record<string, number>>({});

  const currentUserIdRef = React.useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const onHumanActivityRef = React.useRef(onHumanActivity);
  onHumanActivityRef.current = onHumanActivity;

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

  const handleTeamFrameRef = React.useRef(handleTeamFrame);
  handleTeamFrameRef.current = handleTeamFrame;
  const handleDmFrameRef = React.useRef(handleDmFrame);
  handleDmFrameRef.current = handleDmFrame;

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
        if (frame.thread === 'team_message') {
          handleTeamFrameRef.current(frame.event);
        } else if (frame.thread === 'dm_message') {
          handleDmFrameRef.current(frame.event);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (disposed || attempts >= SSE_MAX_RECONNECT_ATTEMPTS) return;
        const delay = SSE_RECONNECT_BASE_DELAY * Math.pow(2, attempts);
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
    async (teamId: number, content: string, mentions: ChatMention[] = []): Promise<boolean> => {
      if (!orgId) return false;
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
      };
      setTeamMessages((prev) => ({
        ...prev,
        [teamId]: [...(prev[teamId] ?? []), optimistic],
      }));

      try {
        const response = await fetch(`/api/organizations/${orgId}/teams/${teamId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, mentions }),
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

  const sendDmMessage = React.useCallback(
    async (otherUserId: string, content: string): Promise<boolean> => {
      if (!orgId) return false;
      const tempId = -Date.now();
      const optimistic: DmMessage = {
        id: tempId,
        threadId: 0,
        senderUserId: currentUserIdRef.current ?? '',
        content,
        createdAt: new Date().toISOString(),
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
            body: JSON.stringify({ content }),
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

  return {
    teamMessages,
    dmMessages,
    unread,
    clearUnread,
    loadTeamHistory,
    loadDmHistory,
    sendTeamMessage,
    sendDmMessage,
  };
}
