import { ResponseProps } from '@/types/common';
import { ConnectionDetails } from '@/types/assistants/call';
import type { CallOpeningConfig } from '@/types/assistants/assistant';
import { AccessToken, RoomServiceClient, type VideoGrant } from 'livekit-server-sdk';
import { getCurrentUser } from '@/lib/user/user';
import { makeRoomName } from '@/utils/assistants/call-utils';
import { camelToSnakeObject } from '@/utils/casing';
import { getAdaptersBaseUrl } from '@/utils/assistants/api-utils';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

/** Browser-facing WS URL is returned to clients; server-side Room APIs use HTTP on the Docker network. */
function resolveLiveKitApiUrl(): string | undefined {
  const apiUrl = process.env.LIVEKIT_API_URL?.trim();
  if (apiUrl) return apiUrl;
  const clientUrl = LIVEKIT_URL?.trim();
  if (!clientUrl) return undefined;
  return clientUrl.replace(/^ws/i, 'http');
}

export const getCallConnectionDetails = async (apiKey: string) => {
  return async (
    assistantId: string,
    assistantName: string
  ): Promise<ConnectionDetails | ResponseProps> => {
    'use server';
    try {
      if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
        const roomName = makeRoomName(assistantId, 'meet');
        return { serverUrl: '', roomName, token: '', mode: 'dev' };
      }

      const user = await getCurrentUser();
      if (!user) {
        // This call now works correctly because it's inside the server action context
        return { detail: 'User not authenticated' };
      }

      if (!assistantId || !assistantName) {
        return { detail: 'assistantId and assistantName are required' };
      }

      const roomName = makeRoomName(assistantId, 'meet');
      const participantName = user.name || 'User';
      const participantIdentity = `user-${user.id}-${Math.random().toString(36).substring(7)}`;

      const at = new AccessToken(API_KEY, API_SECRET, {
        identity: participantIdentity,
        name: participantName,
        ttl: '30m', // 30 minutes
      });

      const grant: VideoGrant = {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
      };
      at.addGrant(grant);

      const token = await at.toJwt();

      const data: ConnectionDetails = {
        serverUrl: LIVEKIT_URL,
        roomName,
        token,
      };

      return data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error getting call connection details.';
      console.error('[lib/assistants/call.ts]', error);
      return { detail: message };
    }
  };
};

export const deleteCallRoom = async () => {
  return async (roomName: string): Promise<ResponseProps> => {
    'use server';
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { detail: 'User not authenticated' };
      }

      if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
        return {};
      }
      const apiUrl = resolveLiveKitApiUrl();
      if (!apiUrl) {
        return {};
      }
      const roomService = new RoomServiceClient(apiUrl, API_KEY, API_SECRET);
      await roomService.deleteRoom(roomName);
      return {};
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error deleting room.';
      console.error('[lib/assistants/call.ts] deleteCallRoom error:', message);
      return { detail: message };
    }
  };
};

export const dispatchAssistantToCall = async (_apiKey: string) => {
  return async (
    assistantId: string,
    roomName: string,
    openingConfig?: CallOpeningConfig
  ): Promise<ResponseProps> => {
    'use server';
    try {
      const adminKey = process.env.ORCHESTRA_ADMIN_KEY;
      if (!adminKey || !LIVEKIT_URL) {
        return { info: 'Dispatch skipped (no LiveKit or backend configured)' };
      }

      const localAdaptersUrl = process.env.LOCAL_ADAPTERS_URL;
      const dispatchUrl = `${getAdaptersBaseUrl({ localAdaptersUrl })}/unify/meet`;

      const dispatchPayload = camelToSnakeObject({
        assistantId,
        livekitAgentName: roomName,
        roomName,
        ...(openingConfig ? { openingConfig } : {}),
      });

      const resp = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify(dispatchPayload),
      });

      if (!resp.ok) {
        const detail = await resp.text().catch(() => 'Failed to dispatch agent');
        return { detail };
      }

      const data = await resp.json().catch(() => ({}));
      return { info: 'Agent dispatched', ...data };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error dispatching assistant.';
      return { detail: message };
    }
  };
};
