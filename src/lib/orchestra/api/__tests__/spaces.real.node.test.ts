import { afterEach, describe, expect, it } from 'vitest';

import { listSpaces, listSpacesForAssistant } from '@/lib/orchestra/api/spaces';
import type { ResponseProps } from '@/types/common';
import type { SpaceSummary } from '@/types/spaces/space';

const describeReal =
  process.env.VITE_SHARED_CONTEXT_SPACES_REAL === 'true' ? describe : describe.skip;

interface RealSpacesConfig {
  apiKey: string;
  assistantId: number;
  orchestraUrl: string;
}

interface SpaceReadResponse {
  space_id: number;
  name: string;
  description: string | null;
  organization_id: number | null;
  status: string;
}

interface SpaceMembershipResponse {
  membership_status: string;
  assistant_id: number;
  space_id: number;
}

let createdSpaceId: number | undefined;

function realSpacesConfig(): RealSpacesConfig {
  const apiKey = process.env.VITE_TEST_API_KEY;
  const assistantId = Number(process.env.VITE_SHARED_CONTEXT_ASSISTANT_ID);
  const orchestraUrl = (process.env.ORCHESTRA_URL ?? '').replace(/\/+$/, '');

  if (!apiKey || !Number.isInteger(assistantId) || !orchestraUrl) {
    throw new Error(
      'Set VITE_TEST_API_KEY, VITE_SHARED_CONTEXT_ASSISTANT_ID, ORCHESTRA_URL, and VITE_SHARED_CONTEXT_SPACES_REAL=true to run real spaces tests.'
    );
  }

  return { apiKey, assistantId, orchestraUrl };
}

async function orchestraJson<T>(
  config: RealSpacesConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${config.orchestraUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new Error(`Orchestra ${init.method ?? 'GET'} ${path} failed: ${response.status} ${text}`);
  }

  return body as T;
}

async function orchestraDelete(config: RealSpacesConfig, path: string): Promise<void> {
  const response = await fetch(`${config.orchestraUrl}${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw new Error(`Orchestra DELETE ${path} failed during cleanup: ${response.status} ${text}`);
  }
}

function expectSpaces(value: SpaceSummary[] | ResponseProps): SpaceSummary[] {
  expect(Array.isArray(value), JSON.stringify(value)).toBe(true);
  return value as SpaceSummary[];
}

describeReal('@real spaces API', () => {
  afterEach(async () => {
    const config = realSpacesConfig();

    if (createdSpaceId !== undefined) {
      await orchestraDelete(
        config,
        `/v0/spaces/${createdSpaceId}/members/${config.assistantId}`
      ).catch(() => undefined);
      await orchestraDelete(config, `/v0/spaces/${createdSpaceId}`).catch(() => undefined);
    }

    createdSpaceId = undefined;
  });

  it(
    'reads live space summaries and assistant memberships through the Console wrappers',
    { meta: { mock: false }, timeout: 30_000 },
    async () => {
      const config = realSpacesConfig();
      const spaceName = `Console Shared Context ${Date.now()}`;
      const spaceDescription = 'Real Console wrapper contract test';

      const space = await orchestraJson<SpaceReadResponse>(config, '/v0/spaces', {
        method: 'POST',
        body: JSON.stringify({
          name: spaceName,
          description: spaceDescription,
          organization_id: null,
        }),
      });
      createdSpaceId = space.space_id;

      const membership = await orchestraJson<SpaceMembershipResponse>(
        config,
        `/v0/spaces/${createdSpaceId}/members`,
        {
          method: 'POST',
          body: JSON.stringify({ assistant_id: config.assistantId }),
        }
      );
      expect(membership.membership_status).toBe('active');

      const [visibleSpaces, assistantSpaces] = await Promise.all([
        listSpaces(config.apiKey).then(expectSpaces),
        listSpacesForAssistant(config.apiKey, config.assistantId).then(expectSpaces),
      ]);

      const visibleSpace = visibleSpaces.find((item) => item.spaceId === createdSpaceId);
      expect(visibleSpace).toMatchObject({
        spaceId: createdSpaceId,
        name: spaceName,
        description: spaceDescription,
        organizationId: null,
        status: 'active',
      });
      expect(visibleSpace).not.toHaveProperty('space_id');

      const assistantSpace = assistantSpaces.find((item) => item.spaceId === createdSpaceId);
      expect(assistantSpace).toMatchObject({
        spaceId: createdSpaceId,
        name: spaceName,
        description: spaceDescription,
        organizationId: null,
        status: 'active',
      });
      expect(assistantSpace).not.toHaveProperty('space_id');
    }
  );
});
