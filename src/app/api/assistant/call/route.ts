import { NextResponse, NextRequest } from 'next/server';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';
import { getCurrentUser } from '@/lib/user/user';
import { ConnectionDetails } from '@/types/assistants/call';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export async function POST(req: NextRequest) {
  try {
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      console.error("[API /api/assistant/call] LiveKit server environment variables are not defined");
      return NextResponse.json({ detail: 'Server configuration error.' }, { status: 500 });
    }

    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ detail: "User not authenticated" }, { status: 401 });
    }

    const { assistantId, assistantName } = await req.json();
    if (!assistantId || !assistantName) {
        return NextResponse.json({ detail: "assistantId and assistantName are required" }, { status: 400 });
    }

    const roomName = `assistant-call-${assistantId}-${Date.now()}`;
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
    
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error) {
      console.error("[API /api/assistant/call]", error);
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse('An unknown error occurred', { status: 500 });
  }
}
