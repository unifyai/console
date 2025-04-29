import { NextResponse } from 'next/server';
import { twiml } from 'twilio';

export async function POST(request: Request) {

    const formData = await request.formData();
    const phone_number = formData.get('To') || "";

    const voiceResponse = new twiml.VoiceResponse();
    voiceResponse.dial().sip({
        username: "unify-unity",
        password: "Unity@123456",
    }, `sip:+${phone_number.slice(1, phone_number.toString().length)}@${process.env.LIVEKIT_SIP_URI?.slice(4, process.env.LIVEKIT_SIP_URI.length)}`);

    return new NextResponse(
        voiceResponse.toString(), 
        {
            status: 200,
            headers: {'Content-Type': 'text/xml'},
        }
    );
}
