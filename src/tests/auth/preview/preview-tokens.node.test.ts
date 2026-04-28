/**
 * Round-trip tests for the preview-environment transfer-token contract.
 *
 * Locks the cross-host session-handoff guarantees:
 *  - Mint on canonical → decode on slug succeeds (shared ``JWT_SECRET``).
 *  - Audience mismatch is rejected (anti-replay across slugs).
 *  - Expired transfer tokens are rejected.
 *  - Re-minted session token has the shape ``getToken()`` accepts.
 *
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-preview-tokens';

import { decode } from 'next-auth/jwt';

import {
  decodePreviewTransferToken,
  encodePreviewSessionToken,
  encodePreviewTransferToken,
  PREVIEW_TRANSFER_MAX_AGE_SECONDS,
} from '@/lib/auth/preview-tokens';

const SLUG_ORIGIN = 'https://service.a.run.app';
const OTHER_SLUG_ORIGIN = 'https://service.a.run.app';

const PAYLOAD = {
  sub: 'user-123',
  email: 'someone@unify.ai',
  name: 'Some One',
  picture: null,
  provider: 'google',
};

describe('preview transfer-token round-trip', () => {
  it('decodes a transfer token at the audience it was minted for', async () => {
    const token = await encodePreviewTransferToken(PAYLOAD, SLUG_ORIGIN);
    const decoded = await decodePreviewTransferToken(token, SLUG_ORIGIN);
    expect(decoded).toEqual(expect.objectContaining(PAYLOAD));
    expect(decoded).not.toHaveProperty('aud');
  });

  it('rejects a transfer token claimed at a different slug', async () => {
    const token = await encodePreviewTransferToken(PAYLOAD, SLUG_ORIGIN);
    expect(await decodePreviewTransferToken(token, OTHER_SLUG_ORIGIN)).toBeNull();
  });

  it('rejects an expired transfer token', async () => {
    const token = await encodePreviewTransferToken(PAYLOAD, SLUG_ORIGIN);
    vi.useFakeTimers();
    try {
      // jose decoder allows 15s of clock skew on top of the 30s max-age.
      vi.setSystemTime(Date.now() + (PREVIEW_TRANSFER_MAX_AGE_SECONDS + 60) * 1000);
      expect(await decodePreviewTransferToken(token, SLUG_ORIGIN)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a tampered transfer token', async () => {
    const token = await encodePreviewTransferToken(PAYLOAD, SLUG_ORIGIN);
    const tampered = token.slice(0, -2) + 'AA';
    expect(await decodePreviewTransferToken(tampered, SLUG_ORIGIN)).toBeNull();
  });
});

describe('preview session-token shape', () => {
  it('produces a JWE that NextAuth decode accepts', async () => {
    const token = await encodePreviewSessionToken(PAYLOAD);
    const decoded = await decode({ token, secret: process.env.JWT_SECRET! });
    expect(decoded).toEqual(
      expect.objectContaining({
        sub: 'user-123',
        email: 'someone@unify.ai',
        name: 'Some One',
        provider: 'google',
      })
    );
    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('exp');
  });

  it('omits the transfer-token audience claim from session tokens', async () => {
    const token = await encodePreviewSessionToken(PAYLOAD);
    const decoded = (await decode({ token, secret: process.env.JWT_SECRET! })) as Record<
      string,
      unknown
    > | null;
    expect(decoded?.aud).toBeUndefined();
  });
});
