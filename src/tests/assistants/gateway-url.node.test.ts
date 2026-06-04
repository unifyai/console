import { describe, expect, it, afterEach } from 'vitest';
import { createCommunicationClient } from '@/lib/communication/client';
import { getAdaptersBaseUrl } from '@/utils/assistants/api-utils';

const ENV_KEYS = ['COMMUNICATION_URL', 'LOCAL_ADAPTERS_URL', 'UNITY_ADAPTERS_URL'] as const;

function clearGatewayEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe('local gateway URL resolution', () => {
  afterEach(() => {
    clearGatewayEnv();
  });

  it('prefers explicit local adapter URLs for adapter dispatch', () => {
    process.env.UNITY_ADAPTERS_URL = 'https://hosted-adapters.example.com/';

    expect(
      getAdaptersBaseUrl({
        localAdaptersUrl: 'http://127.0.0.1:8001/',
        isStaging: true,
      })
    ).toBe('http://127.0.0.1:8001');
  });

  it('uses UNITY_ADAPTERS_URL when no local override is provided', () => {
    process.env.UNITY_ADAPTERS_URL = 'http://127.0.0.1:8001/';

    expect(getAdaptersBaseUrl({ isStaging: true })).toBe('http://127.0.0.1:8001');
  });

  it('lets Communication-shaped clients target the local Unity gateway', () => {
    process.env.LOCAL_ADAPTERS_URL = 'http://127.0.0.1:8001';

    const client = createCommunicationClient('admin-key');

    expect(client.defaults.baseURL).toBe('http://127.0.0.1:8001');
  });

  it('prefers COMMUNICATION_URL when explicitly set', () => {
    process.env.COMMUNICATION_URL = 'https://communication.example.com';
    process.env.LOCAL_ADAPTERS_URL = 'http://127.0.0.1:8001';

    const client = createCommunicationClient();

    expect(client.defaults.baseURL).toBe('https://communication.example.com');
  });
});
