import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';
import {
  createCommunicationClient,
  getCommunicationErrorDetail,
  getCommunicationErrorStatus,
} from '@/lib/communication/client';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.error('Failed to parse JSON body in POST /api/contact/email:', error);
    return badRequest('Invalid request body');
  }

  const { email } = requestBody;
  if (!email) {
    return badRequest('Missing required field: email');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest('Invalid email format provided.');
  }

  try {
    const client = createCommunicationClient();
    // Client automatically converts emailAddress → email_address
    const { data } = await client.post('/email/create', { emailAddress: email });

    if (data.success && data.user?.primaryEmail) {
      return NextResponse.json({ email: data.user.primaryEmail, user: data.user }, { status: 201 });
    } else if (data.email) {
      return NextResponse.json({ email: data.email }, { status: 201 });
    } else {
      console.error(
        'Communication service (email/create) did not return expected email data:',
        data
      );
      return NextResponse.json(
        { detail: 'Failed to create email, unexpected response from service.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error proxying to communication service (email/create):', error);
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
    console.error('Failed to parse JSON body in DELETE /api/contact/email:', error);
    return badRequest('Invalid request body');
  }

  const { primaryEmail } = requestBody;
  if (!primaryEmail) {
    return badRequest('Missing required field: primaryEmail');
  }

  try {
    const client = createCommunicationClient();
    // Client automatically converts primaryEmail → primary_email
    const response = await client.delete('/email/delete', { data: { primaryEmail } });

    // Handle 204 No Content
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to communication service (email/delete):', error);
    return NextResponse.json(
      { detail: getCommunicationErrorDetail(error) },
      { status: getCommunicationErrorStatus(error) }
    );
  }
}

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const adminEmailsResponse = await fetch(`${ORCHESTRA_BASE_URL}/admin/assistant/emails`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
    });

    const responseData = await adminEmailsResponse.json().catch((e) => {
      console.error(
        'Failed to parse JSON response from admin backend (admin/assistant/emails):',
        e
      );
      return {
        detail: 'Invalid JSON response from admin email listing service',
        status: adminEmailsResponse.status,
      };
    });

    if (!adminEmailsResponse.ok) {
      console.error(
        `Admin Backend Error (admin/assistant/emails - ${adminEmailsResponse.status}):`,
        responseData
      );
      return NextResponse.json(
        { detail: responseData.detail || 'Failed to fetch assistant emails from admin service' },
        { status: adminEmailsResponse.status }
      );
    }

    // The backend /admin/assistant/emails returns InfoResponse[List[str]]
    // So responseData should be { info: ["email1", "email2"] }
    if (responseData.info && Array.isArray(responseData.info)) {
      return NextResponse.json({ emails: responseData.info }, { status: 200 });
    } else {
      console.error(
        "Admin backend (admin/assistant/emails) did not return expected 'info' array:",
        responseData
      );
      return NextResponse.json(
        { detail: 'Unexpected response format from admin email listing service.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error proxying to admin backend (admin/assistant/emails):', error);
    return internalError('Failed to connect to admin email listing service');
  }
}
