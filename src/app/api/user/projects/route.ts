import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { getProjects } from '@/lib/interfaces/projects';

export async function GET(request: NextRequest) {
  try {
    const apiKey = await getApiKeyFromRequest(request);
    if (!apiKey) {
      return unauthorized();
    }

    const projects = await getProjects();
    return NextResponse.json(projects, { status: 200 });
  } catch (err) {
    console.error('/api/user/projects error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
