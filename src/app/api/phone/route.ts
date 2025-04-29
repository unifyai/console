import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { SipClient } from 'livekit-server-sdk';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

export async function POST() {
    try {
      // Search for available phone numbers (US, Mobile, etc.)
      const locals = await client.availablePhoneNumbers('US').local.list({
        limit: 1,
        smsEnabled: true,
        voiceEnabled: true,
      });
  
      if (locals.length === 0) {
        return NextResponse.json({ error: 'No suitable phone numbers found.' }, { status: 404 });
      }

      const record = locals[0];
      const incomingPhoneNumber = await client.incomingPhoneNumbers.create({
        phoneNumber: record.phoneNumber,
      });
      
      // Create LiveKit inbound trunk
      const sipClient = new SipClient(
        process.env.LIVEKIT_URL!,
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET
      );

      // An array of one or more provider phone numbers associated with the trunk.
      const numbers = [record.phoneNumber];
      const name = `Unity_${record.phoneNumber.toString().slice(1, record.phoneNumber.toString().length)}`;

      // Trunk options
      const trunkOptions = {
        krispEnabled: true,
        auth_username: "unify-unity",
        auth_password: "Unity@123456",
      };

      const trunk = sipClient.createSipInboundTrunk(
        name,
        numbers,
        trunkOptions,
      );
  
      return NextResponse.json({
        success: true,
        phoneNumber: incomingPhoneNumber.phoneNumber,
      });
  

    } catch (error: any) {
      console.error('Twilio error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  export async function DELETE(req: Request) {
    try {
      const { phoneNumber } = await req.json(); // Expect { "phoneNumber": "+1234567890" }
  
      // 1. Find the phone SID
      const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({
        phoneNumber: phoneNumber,
        limit: 1,
      });
  
      if (incomingPhoneNumbers.length === 0) {
        return NextResponse.json({ error: 'Phone number not found' }, { status: 404 });
      }
  
      const phoneSid = incomingPhoneNumbers[0].sid;
  
      // 2. Delete the phone number
      await client.incomingPhoneNumbers(phoneSid).remove();
  
      return NextResponse.json({ success: true, sid: phoneSid });
    } catch (error: any) {
      console.error('Error deleting phone number:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }