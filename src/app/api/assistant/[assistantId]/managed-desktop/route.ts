import { NextRequest, NextResponse } from 'next/server';
import { AxiosError } from 'axios';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const assistantIdNum = parseInt(assistantId, 10);
  const client = await getOrchestraUserClient(apiKey);

  try {
    const response = await client.get(`/assistant/${assistantIdNum}/managed-desktop`);
    return NextResponse.json(response.data ?? {}, { status: response.status });
  } catch (e: unknown) {
    if (e instanceof AxiosError && e.response) {
      return NextResponse.json(e.response.data, { status: e.response.status });
    }
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const requestBody = await request.json();
  const assistantIdNum = parseInt(assistantId, 10);
  const client = await getOrchestraUserClient(apiKey);

  try {
    const response = await client.post(`/assistant/${assistantIdNum}/managed-desktop`, requestBody);
    return NextResponse.json(response.data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    if (e instanceof AxiosError && e.response) {
      return NextResponse.json(e.response.data, { status: e.response.status });
    }
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const assistantIdNum = parseInt(assistantId, 10);
  const client = await getOrchestraUserClient(apiKey);

  try {
    const response = await client.delete(`/assistant/${assistantIdNum}/managed-desktop`);
    return NextResponse.json(response.data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    if (e instanceof AxiosError && e.response) {
      return NextResponse.json(e.response.data, { status: e.response.status });
    }
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}
