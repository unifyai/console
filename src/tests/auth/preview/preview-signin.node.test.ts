// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/preview-signin/route';

const PREVIEW_HOST = 'service.a.run.app';

function makeRequest(body: unknown, host: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/preview-signin', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-host': host,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/preview-signin', () => {
  it('rejects calls from non-preview hosts before doing any other work', async () => {
    const response = await POST(
      makeRequest({ email: 'dev@unify.ai' }, 'internal.example.com')
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('preview_only');
  });

  it('rejects emails that are not @unify.ai team members', async () => {
    const response = await POST(makeRequest({ email: 'user@example.com' }, PREVIEW_HOST));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('email_not_allowed');
  });

  it('rejects requests with no email payload', async () => {
    const response = await POST(makeRequest({}, PREVIEW_HOST));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('missing_email');
  });
});
