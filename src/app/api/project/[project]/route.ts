import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

export async function GET(request: NextRequest, { params }: { params: { project: string } }) {
  const { project } = params;
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey') || '';
  if (!apiKey) return NextResponse.json({ detail: 'No API Key' }, { status: 401 });

  try {
    const backendRes = await fetch(
      `${process.env.ORCHESTRA_URL}/v0/project/${encodeURIComponent(project)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    const text = await backendRes.text();
    let data;
    try {
      data = JSON.parse(text);
      // Transform snake_case response to camelCase for frontend
      data = snakeToCamelObject(data);
    } catch {
      data = { detail: text };
    }

    return NextResponse.json(data, {
      status: backendRes.status,
    });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message || 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { project: string } }) {
  const { project } = params;
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey') || '';
  if (!apiKey) return NextResponse.json({ detail: 'No API Key' }, { status: 401 });

  const bodyObj = await request.json();

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody = camelToSnakeObject(bodyObj);

  try {
    const backendRes = await fetch(
      `${process.env.ORCHESTRA_URL}/v0/project/${encodeURIComponent(project)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(snakeCaseBody),
        cache: 'no-store',
      }
    );

    const text = await backendRes.text();
    let data;
    try {
      data = JSON.parse(text);
      // Transform snake_case response to camelCase for frontend
      data = snakeToCamelObject(data);
    } catch {
      data = { detail: text };
    }

    return NextResponse.json(data, {
      status: backendRes.status,
    });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message || 'Failed' }, { status: 500 });
  }
}
