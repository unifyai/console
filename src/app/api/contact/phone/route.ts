import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';

const baseUrl = process.env.COMMUNICATION_URL;

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const response = await fetch(`${baseUrl}/phone/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseData = await response.json().catch((e) => {
      console.error('Failed to parse JSON response from communication service (phone/create):', e);
      return {
        detail: 'Invalid JSON response from communication service',
        status: response.status,
      };
    });

    if (!response.ok) {
      console.error(
        `Communication Service Error (phone/create - ${response.status}):`,
        responseData
      );
      return NextResponse.json(
        {
          detail: responseData.detail || 'Failed to create phone number via communication service',
        },
        { status: response.status }
      );
    }

    if (responseData.success && responseData.phoneNumber) {
      return NextResponse.json({ phoneNumber: responseData.phoneNumber }, { status: 201 });
    } else {
      console.error(
        'Communication service (phone/create) did not return expected phone data:',
        responseData
      );
      return NextResponse.json(
        { detail: 'Failed to create phone number, unexpected response from service.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error proxying to communication service (phone/create):', error);
    return internalError('Failed to connect to communication service');
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
    const response = await fetch(
      `${baseUrl}/phone/delete`, // Backend endpoint path
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: phoneNumber }),
      }
    );

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const responseData = await response.json().catch((e) => {
      console.error('Failed to parse JSON response from communication service (phone/delete):', e);
      if (response.ok)
        return { success: true, message: 'Operation successful, but response was not JSON.' };
      return {
        detail: 'Invalid JSON response from communication service',
        status: response.status,
      };
    });

    if (!response.ok) {
      console.error(
        `Communication Service Error (phone/delete - ${response.status}):`,
        responseData
      );
      return NextResponse.json(
        {
          detail: responseData.detail || 'Failed to delete phone number via communication service',
        },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error: any) {
    console.error('Error proxying to communication service (phone/delete):', error);
    return internalError('Failed to connect to communication service');
  }
}
