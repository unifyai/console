import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import {
  createCommunicationClient,
  getCommunicationErrorDetail,
  getCommunicationErrorStatus,
} from '@/lib/communication/client';

const isStaging = (process.env.ORCHESTRA_URL ?? '').includes('staging');

export async function POST(request: NextRequest) {
  if (!isStaging) {
    return NextResponse.json(
      { detail: 'WhatsApp contact creation is currently unavailable. Coming soon.' },
      { status: 503 }
    );
  }

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.error('Failed to parse JSON body in POST /api/contact/whatsapp:', error);
    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  }

  const { phoneNumber, firstName, lastName } = requestBody;
  if (!phoneNumber || !firstName || !lastName) {
    return NextResponse.json(
      { detail: 'Missing required fields: phoneNumber, firstName, lastName' },
      { status: 400 }
    );
  }

  try {
    const client = createCommunicationClient();
    // Client automatically converts phoneNumber → phone_number, firstName → first_name, etc.
    const { data } = await client.post('/whatsapp/create', { phoneNumber, firstName, lastName });

    // Backend /whatsapp/create returns { "sid": "..." } on success
    if (data.sid) {
      return NextResponse.json({ sid: data.sid }, { status: 201 });
    } else {
      console.error(
        "Communication service (whatsapp/create) did not return expected 'sid' data:",
        data
      );
      return NextResponse.json(
        { detail: 'Failed to create WhatsApp sender, unexpected response from service.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error proxying to communication service (whatsapp/create):', error);
    return NextResponse.json(
      { detail: getCommunicationErrorDetail(error) },
      { status: getCommunicationErrorStatus(error) }
    );
  }
}

export async function DELETE(request: NextRequest) {
  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.error('Failed to parse JSON body in DELETE /api/contact/whatsapp:', error);
    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  }

  const { sid } = requestBody;
  if (!sid) {
    return NextResponse.json({ detail: 'Missing required field: sid' }, { status: 400 });
  }

  try {
    const client = createCommunicationClient();
    const response = await client.delete('/whatsapp/delete', { data: { sid } });

    // Handle 204 No Content or empty 200
    if (response.status === 204 || (response.status === 200 && !response.data)) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to communication service (whatsapp/delete):', error);
    return NextResponse.json(
      { detail: getCommunicationErrorDetail(error) },
      { status: getCommunicationErrorStatus(error) }
    );
  }
}
