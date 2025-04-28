import { NextResponse } from 'next/server';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

export async function POST() {
    try {
      // Search for available phone numbers (US, Mobile, etc.)
      const locals = await client.availablePhoneNumbers('US').local.list({ limit: 5 });
  
      if (locals.length === 0) {
        return NextResponse.json({ error: 'No phone numbers available' }, { status: 404 });
      }
  
      for (const record of locals) {
        if (record.capabilities?.voice && record.capabilities?.sms) {
          // Provision (buy) the number
          const incomingPhoneNumber = await client.incomingPhoneNumbers.create({
            phoneNumber: record.phoneNumber,
          });
  
          return NextResponse.json({
            success: true,
            phoneNumber: incomingPhoneNumber.phoneNumber,
          });
        }
      }
  
      // If no suitable number was found
      return NextResponse.json(
        { error: 'No suitable phone number found' },
        { status: 404 }
      );
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