import { describe, expect, it } from 'vitest';
import { resolveFeatures } from '@/lib/features/features';
import type { Environment } from '@/lib/environment/environment';

const localEnvironment: Environment = {
  deployment: 'dev',
  authMode: 'managed',
  isProduction: false,
  isStaging: false,
  isSelfHost: false,
  isDev: true,
};

describe('resolveFeatures', () => {
  it('enables voice calls in explicit dev-call mode without LiveKit credentials', () => {
    const features = resolveFeatures({ CONSOLE_DEV_CALLS: '1' }, localEnvironment);

    expect(features.voiceCalls).toBe(true);
    expect(features.voiceSynthesis).toBe(false);
    expect(features.transcription).toBe(false);
  });
});
