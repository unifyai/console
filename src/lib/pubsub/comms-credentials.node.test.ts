import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { commsCredentialsConfigured } from './ephemeral-subscription';

const ORIGINAL = process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
  } else {
    process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS = ORIGINAL;
  }
});

describe('commsCredentialsConfigured', () => {
  it('returns false when unset or empty', () => {
    delete process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
    expect(commsCredentialsConfigured()).toBe(false);

    process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS = '   ';
    expect(commsCredentialsConfigured()).toBe(false);
  });

  it('returns false when a credentials file path is missing', () => {
    process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS = '/tmp/does-not-exist-comms.json';
    expect(commsCredentialsConfigured()).toBe(false);
  });

  it('returns false for a relative credentials file path that does not exist', () => {
    process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS = 'comms_sa_credentials.json';
    expect(commsCredentialsConfigured()).toBe(false);
  });

  it('returns true for inline JSON credentials', () => {
    process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS =
      '{"project_id":"test-project","client_email":"test@example.com"}';
    expect(commsCredentialsConfigured()).toBe(true);
  });

  it('returns true for a readable credentials file', () => {
    const filePath = path.join(os.tmpdir(), `comms-creds-${Date.now()}.json`);
    fs.writeFileSync(filePath, '{"project_id":"file-project","client_email":"file@example.com"}');
    process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS = filePath;
    expect(commsCredentialsConfigured()).toBe(true);
    fs.unlinkSync(filePath);
  });
});
