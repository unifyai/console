import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const forwardToOrchestraMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/chat/_utils/orchestra', () => ({
  forwardToOrchestra: forwardToOrchestraMock,
}));

vi.mock('@/app/api/_utils/auth', () => ({
  badRequest: (message: string) =>
    new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

import { POST } from '@/app/api/calls/route';

function request(body: unknown): NextRequest {
  return new NextRequest('https://console.unify.ai/api/calls', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function forwardedBody(body: unknown) {
  forwardToOrchestraMock.mockClear();
  forwardToOrchestraMock.mockResolvedValue(new Response('{}', { status: 200 }));
  await POST(request(body));
  return forwardToOrchestraMock.mock.calls[0][2].body;
}

/**
 * The runtime reads the opening config's fields by snake_case name, so renaming
 * only the outer key leaves the nested ones unreadable: a recorded opening
 * arrives with no asset and the voice agent rejects it outright.
 */
describe('POST /api/calls opening config casing', () => {
  it('converts the nested opening config to snake_case', async () => {
    const body = await forwardedBody({
      kind: 'assistant_dm',
      assistantId: 2310,
      openingConfig: {
        mode: 'recorded',
        recordingAsset: 'coordinator_onboarding_intro',
        source: 'coordinator_onboarding_intro',
      },
    });

    expect(body.opening_config).toEqual({
      mode: 'recorded',
      recording_asset: 'coordinator_onboarding_intro',
      source: 'coordinator_onboarding_intro',
    });
  });

  it('leaves an already converted config alone', async () => {
    const body = await forwardedBody({
      kind: 'assistant_dm',
      assistantId: 2310,
      opening_config: { mode: 'recorded', recording_asset: 'coordinator_onboarding_intro' },
    });

    expect(body.opening_config).toEqual({
      mode: 'recorded',
      recording_asset: 'coordinator_onboarding_intro',
    });
  });

  it('omits the config when the caller sends none', async () => {
    const body = await forwardedBody({ kind: 'assistant_dm', assistantId: 2310 });

    expect(body.opening_config).toBeUndefined();
  });
});
