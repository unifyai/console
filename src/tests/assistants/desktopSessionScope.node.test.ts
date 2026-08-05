import { describe, expect, it } from 'vitest';
import {
  findScopedStartupLiveviewLog,
  readLogEntryField,
} from '@/lib/assistants/desktopSessionScope';
import type { LogProps } from '@/types/interfaces/logs';

function logWithEntries(entries: Record<string, unknown>): LogProps {
  return {
    type: 'ungrouped',
    id: 'log-1',
    ts: '2026-08-03T00:00:00Z',
    entries,
    derivedEntries: {},
    clippedFields: {},
  } as unknown as LogProps;
}

describe('readLogEntryField', () => {
  it('reads the snake_case key', () => {
    expect(
      readLogEntryField({ liveview_password: 'secret-1' }, 'liveview_password', 'liveviewPassword')
    ).toBe('secret-1');
  });

  it('falls back to the camelCase key', () => {
    expect(
      readLogEntryField({ liveviewPassword: 'secret-2' }, 'liveview_password', 'liveviewPassword')
    ).toBe('secret-2');
  });

  it('returns undefined when neither key is present', () => {
    expect(readLogEntryField({}, 'liveview_password', 'liveviewPassword')).toBeUndefined();
  });
});

describe('findScopedStartupLiveviewLog liveview_password passthrough', () => {
  it('surfaces a published snake_case secret on the resolved row', () => {
    const logs = [
      logWithEntries({
        liveview_url: 'https://vm.example.com/desktop/custom.html',
        liveview_password: 'published-secret',
      }),
    ];

    const scoped = findScopedStartupLiveviewLog(logs, null);
    expect(scoped).toBeDefined();
    expect(readLogEntryField(scoped!.entries, 'liveview_password', 'liveviewPassword')).toBe(
      'published-secret'
    );
  });

  it('surfaces a published camelCase secret on the resolved row', () => {
    const logs = [
      logWithEntries({
        liveviewUrl: 'https://vm.example.com/desktop/custom.html',
        liveviewPassword: 'published-secret-camel',
      }),
    ];

    const scoped = findScopedStartupLiveviewLog(logs, null);
    expect(scoped).toBeDefined();
    expect(readLogEntryField(scoped!.entries, 'liveview_password', 'liveviewPassword')).toBe(
      'published-secret-camel'
    );
  });

  it('leaves nothing to read when the row predates the secret rollout', () => {
    const logs = [
      logWithEntries({
        liveview_url: 'https://vm.example.com/desktop/custom.html',
      }),
    ];

    const scoped = findScopedStartupLiveviewLog(logs, null);
    expect(scoped).toBeDefined();
    expect(
      readLogEntryField(scoped!.entries, 'liveview_password', 'liveviewPassword')
    ).toBeUndefined();
  });
});
