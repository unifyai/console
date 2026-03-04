import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';
import {
  createCommunicationClient,
  getCommunicationErrorDetail,
  getCommunicationErrorStatus,
} from '@/lib/communication/client';

const isStaging = (process.env.ORCHESTRA_URL ?? '').includes('staging');

export async function POST(request: NextRequest) {
  if (!isStaging) {
    return NextResponse.json(
      { detail: 'Phone contact creation is currently unavailable. Coming soon.' },
      { status: 503 }
    );
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const client = createCommunicationClient();
    const { data } = await client.post('/phone/create');

    if (data.success && data.phoneNumber) {
      return NextResponse.json({ phoneNumber: data.phoneNumber }, { status: 201 });
    } else {
      console.error(
        'Communication service (phone/create) did not return expected phone data:',
        data
      );
      return NextResponse.json(
        { detail: 'Failed to create phone number, unexpected response from service.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error proxying to communication service (phone/create):', error);
    return NextResponse.json(
      { detail: getCommunicationErrorDetail(error) },
      { status: getCommunicationErrorStatus(error) }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.error('Failed to parse JSON body in DELETE /api/contact/phone:', error);
    return badRequest('Invalid request body');
  }

  const { phoneNumber } = requestBody;
  if (!phoneNumber) {
    return badRequest('Missing required field: phoneNumber');
  }

  try {
    const client = createCommunicationClient();
    // Client automatically converts phoneNumber → phone_number
    const response = await client.delete('/phone/delete', { data: { phoneNumber } });

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to communication service (phone/delete):', error);
    return NextResponse.json(
      { detail: getCommunicationErrorDetail(error) },
      { status: getCommunicationErrorStatus(error) }
    );
  }
}
