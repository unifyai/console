import { NextResponse } from 'next/server';
import { twiml } from 'twilio';

export async function POST(request: Request) {

    const voiceResponse = new twiml.VoiceResponse();
    voiceResponse.dial().sip(`${process.env.LIVEKIT_SIP_URI}`);

    return new NextResponse(
        voiceResponse.toString(), 
        {
            status: 200,
            headers: {'Content-Type': 'text/xml'},
        }
    );
}
