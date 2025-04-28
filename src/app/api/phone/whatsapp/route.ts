import { NextResponse } from 'next/server';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;

export async function POST(req: Request) {
  try {
    const contactDetails = await req.json();

    const url = "https://messaging.twilio.com/v2/Channels/Senders";

    const payload = {
      sender_id: `whatsapp:${contactDetails.phone_number}`,
      profile: {
        name: `${contactDetails.first_name} ${contactDetails.surname}`,
      },
      webhook: {
        callback_method: 'POST',
        callback_url: `${process.env.NEXTAUTH_URL}/api/phone/text`,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create WhatsApp sender: ${errorText}`);
    }

    const data = await response.json();

    return NextResponse.json({ sid: data.sid });

  } catch (error: any) {
    console.error('Error creating WhatsApp SID:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
    try {
      const { sid } = await req.json(); // Expect { "sid": "XEXXXXXXXXXXXXXXXXXXXXX" }

      const url = `https://messaging.twilio.com/v2/Channels/Senders/${sid}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete WhatsApp sender: ${errorText}`);
      }
  
      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting WhatsApp sender:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }