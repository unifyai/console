import { afterEach, describe, expect, it } from 'vitest';
import { hasCredentials, localEventBusEnabled } from './local-event-bus';

const ORIGINAL_COMMS = process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
const ORIGINAL_EMULATOR = process.env.PUBSUB_EMULATOR_HOST;

afterEach(() => {
  if (ORIGINAL_COMMS === undefined) {
    delete process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
  } else {
    process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS = ORIGINAL_COMMS;
  }
  if (ORIGINAL_EMULATOR === undefined) {
    delete process.env.PUBSUB_EMULATOR_HOST;
  } else {
    process.env.PUBSUB_EMULATOR_HOST = ORIGINAL_EMULATOR;
  }
});

describe('localEventBusEnabled', () => {
  it('is true only when neither cloud creds nor the emulator are configured', () => {
    delete process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
    delete process.env.PUBSUB_EMULATOR_HOST;

    expect(hasCredentials()).toBe(false);
    expect(localEventBusEnabled()).toBe(true);
  });

  it('is false when PUBSUB_EMULATOR_HOST is set (self-host / local chat)', () => {
    delete process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
    process.env.PUBSUB_EMULATOR_HOST = 'pubsub-emulator:8085';

    expect(hasCredentials()).toBe(true);
    expect(localEventBusEnabled()).toBe(false);
  });

  it('is false when valid COMMS credentials are configured', () => {
    delete process.env.PUBSUB_EMULATOR_HOST;
    process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS =
      '{"project_id":"test-project","client_email":"test@example.com"}';

    expect(hasCredentials()).toBe(true);
    expect(localEventBusEnabled()).toBe(false);
  });
});
