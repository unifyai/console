import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCommunicationClient } from '@/lib/communication/client';
import { getAdaptersBaseUrl } from '@/utils/assistants/api-utils';

const ENV_KEYS = [
  'COMMUNICATION_URL',
  'UNIFY_COMMS_URL',
  'LOCAL_ADAPTERS_URL',
  'UNIFY_ADAPTERS_URL',
] as const;

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
    process.env.UNIFY_ADAPTERS_URL = 'https://hosted-adapters.example.com/';

    expect(
      getAdaptersBaseUrl({
        localAdaptersUrl: 'http://127.0.0.1:8001/',
      })
    ).toBe('http://127.0.0.1:8001');
  });

  it('uses UNIFY_ADAPTERS_URL when no local override is provided', () => {
    process.env.UNIFY_ADAPTERS_URL = 'http://127.0.0.1:8001/';

    expect(getAdaptersBaseUrl()).toBe('http://127.0.0.1:8001');
  });

  it('prefers UNIFY_COMMS_URL over adapter URLs for Communication clients', () => {
    process.env.UNIFY_COMMS_URL = 'https://comms.example.com';
    process.env.UNIFY_ADAPTERS_URL = 'http://127.0.0.1:8001';

    const client = createCommunicationClient();

    expect(client.defaults.baseURL).toBe('https://comms.example.com');
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

describe('local gateway script wrappers', () => {
  it('exposes thin Unity gateway wrapper commands', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/local.sh'), 'utf8');

    expect(script).toContain('gateway-setup');
    expect(script).toContain('gateway-doctor');
    expect(script).toContain('gateway-urls');
    expect(script).toContain('args=(setup');
    expect(script).toContain('-m unify.gateway doctor');
    expect(script).toContain('-m unify.gateway urls');
  });
});
