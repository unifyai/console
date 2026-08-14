import { describe, expect, it } from 'vitest';
import { getFriendlyErrorCopy, parseSystemErrorPayload } from '@/utils/assistants/system-errors';

/**
 * A spending refusal names its own cause and remedy ("switch to one of the
 * included models", "subscribe in billing"). Every other system error here
 * describes something that clears on its own, so the generic copy tells the
 * user to wait or refresh — advice that is actively wrong for a block that
 * only lifts when the account changes.
 */
const REFUSAL =
  'Anthropic models unlock once this account has made its first payment. ' +
  'Subscribe in billing to use them, or switch this assistant to one of ' +
  'the included models to carry on now.';

const payload = (content: string, errorType?: string) => ({
  thread: 'system_error',
  event: errorType ? { content, error_type: errorType } : { content },
});

describe('billing refusals survive the trip to the user', () => {
  it('keeps the runtime type instead of falling back to unknown', () => {
    const parsed = parseSystemErrorPayload(payload(REFUSAL, 'billing_blocked'));

    expect(parsed?.type).toBe('billing_blocked');
  });

  it('shows the reason the runtime gave, not a rewritten summary', () => {
    const { detail } = getFriendlyErrorCopy('billing_blocked', 'Ada', REFUSAL);

    expect(detail).toBe(REFUSAL);
  });

  it('never tells someone to refresh out of a billing block', () => {
    const { title, detail } = getFriendlyErrorCopy('billing_blocked', 'Ada', REFUSAL);

    expect(`${title} ${detail}`.toLowerCase()).not.toContain('refresh');
    expect(`${title} ${detail}`.toLowerCase()).not.toContain('try again');
    expect(`${title} ${detail}`.toLowerCase()).not.toContain('resolves on its own');
  });

  it('still names the assistant so the toast reads as theirs', () => {
    const { title } = getFriendlyErrorCopy('billing_blocked', 'Ada', REFUSAL);

    expect(title).toContain('Ada');
  });

  it('falls back to fixed copy if the runtime sent no reason', () => {
    const { title, detail } = getFriendlyErrorCopy('billing_blocked', 'Ada');

    expect(title).toContain('Ada');
    expect(detail).toBe('');
  });

  it('leaves the generic types alone', () => {
    const { detail } = getFriendlyErrorCopy('recovering', 'Ada', REFUSAL);

    expect(detail).not.toBe(REFUSAL);
  });
});
