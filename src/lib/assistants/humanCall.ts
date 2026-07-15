'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { ResponseProps } from '@/types/common';
import { ConnectionDetails } from '@/types/assistants/call';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';
import { getCurrentUser } from '@/lib/user/user';
import { cookies } from 'next/headers';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const DEV_CALLS = (process.env.CONSOLE_DEV_CALLS ?? '').trim() !== '';
const DEV_CALLS_COOKIE = 'console_dev_calls';

async function devCallsEnabled(): Promise<boolean> {
  if (DEV_CALLS) return true;
  if (process.env.NODE_ENV === 'production') return false;
  const cookieStore = await cookies();
  return cookieStore.get(DEV_CALLS_COOKIE)?.value === '1';
}

/** Mint a LiveKit token for a human↔human room (no assistant agent dispatch). */
export async function getHumanCallConnectionDetails(
  roomName: string
): Promise<ConnectionDetails | ResponseProps> {
  await requireUserApiKey();
  try {
    if ((await devCallsEnabled()) || !LIVEKIT_URL || !API_KEY || !API_SECRET) {
      return { serverUrl: '', roomName, token: '', mode: 'dev' };
    }

    const user = await getCurrentUser();
    if (!user) {
      return { detail: 'User not authenticated' };
    }
    if (!roomName.trim()) {
      return { detail: 'roomName is required' };
    }

    const participantName = user.name || 'User';
    const participantIdentity = `user-${user.id}-${Math.random().toString(36).substring(7)}`;

    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      ttl: '30m',
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
    return {
      serverUrl: LIVEKIT_URL,
      roomName,
      token,
      mode: 'live',
    };
  } catch (error) {
    console.error('[getHumanCallConnectionDetails]', error);
    return { detail: 'Failed to mint call token' };
  }
}
