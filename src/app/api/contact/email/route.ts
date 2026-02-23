import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';
import {
  createCommunicationClient,
  getCommunicationErrorDetail,
  getCommunicationErrorStatus,
} from '@/lib/communication/client';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { AxiosError } from 'axios';

const isStaging = (process.env.ORCHESTRA_URL ?? '').includes('staging');

export async function POST(request: NextRequest) {
  if (!isStaging) {
    return NextResponse.json(
      { detail: 'Email contact creation is currently unavailable. Coming soon.' },
      { status: 503 }
    );
  }

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
    // Use the admin/assistant endpoint with from_fields parameter to only fetch emails
    // This is more efficient than fetching full assistant objects
    // OrchestraAdminClient base URL is already set to /v0/admin
    const response = await OrchestraAdminClient.get('/assistant', {
      params: { fromFields: 'email' },
    });

    const responseData = response.data as { info?: Array<{ email?: string | null }> };

    // The backend returns { info: [{ email: "..." }, { email: "..." }, ...] }
    // We need to extract the emails and return as a flat list
    if (responseData.info && Array.isArray(responseData.info)) {
      const emails = responseData.info
        .map((item) => item.email)
        .filter((email): email is string => email != null);
      return NextResponse.json({ emails }, { status: 200 });
    } else {
      console.error(
        "Admin backend (admin/assistant?from_fields=email) did not return expected 'info' array:",
        responseData
      );
      return NextResponse.json(
        { detail: 'Unexpected response format from admin email listing service.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching assistant emails from admin backend:', error);

    if (error instanceof AxiosError) {
      const status = error.response?.status || 500;
      const detail = error.response?.data?.detail || 'Failed to fetch assistant emails';
      return NextResponse.json({ detail }, { status });
    }

    return internalError('Failed to connect to admin email listing service');
  }
}
