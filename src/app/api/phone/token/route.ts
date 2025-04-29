// app/api/get-token/route.js

import { NextRequest, NextResponse } from 'next/server';
import { jwt as twilioJwt } from 'twilio';

export async function GET(request: NextRequest) {
  const AccessToken = twilioJwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_SID;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const outgoingAppSid = process.env.TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret || !outgoingAppSid) {
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 });
  }

  const identity = "julia@unify.ai";

  const token = new AccessToken(accountSid, apiKey, apiSecret, { identity });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: `${process.env.TWILIO_CALL_APP_SID}`,
    // incomingAllow: true,
  });

  token.addGrant(voiceGrant);

  const jwt = token.toJwt();

  return NextResponse.json({ token: jwt });
}
