import { ResponseProps } from '@/types/common';
import { ConnectionDetails } from '@/types/assistants/call';
import { AccessToken, RoomServiceClient, type VideoGrant } from 'livekit-server-sdk';
import { getCurrentUser } from '@/lib/user/user';
import { makeRoomName } from '@/utils/assistants/call-utils';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export const getCallConnectionDetails = async (apiKey: string) => {
  return async (
    assistantId: string,
    assistantName: string
  ): Promise<ConnectionDetails | ResponseProps> => {
    'use server';
    try {
      // Logic from the original API route is now here in the Server Action
      if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
        console.error(
          '[lib/assistants/call.ts] LiveKit server environment variables are not defined'
        );
        return { detail: 'Server configuration error.' };
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
        return { detail: 'Server configuration error.' };
      }
      const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
      await roomService.deleteRoom(roomName);
      return {};
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error deleting room.';
      console.error('[lib/assistants/call.ts] deleteCallRoom error:', message);
      return { detail: message };
    }
  };
};

export const dispatchAssistantToCall = async (apiKey: string) => {
  return async (assistantId: string, roomName: string): Promise<ResponseProps> => {
    'use server';
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/call/dispatch`, {
        method: 'POST',
        headers: {
          apiKey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assistantId, roomName }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { detail: data.detail || `Failed to dispatch assistant: ${response.statusText}` };
      }
      return data as ResponseProps;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error dispatching assistant.';
      return { detail: message };
    }
  };
};
