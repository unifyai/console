import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchCoordinatorReferenceQuizClue } from '@/utils/assistants/coordinator-reference-quiz';

describe('dispatchCoordinatorReferenceQuizClue', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts reference quiz clues through the coordinator onboarding event envelope', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 202 }));
    vi.stubGlobal('fetch', fetchSpy);

    const clue = await dispatchCoordinatorReferenceQuizClue('123', 'slack-reference');

    expect(clue?.replyStepId).toBe('slack-message');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/assistant/123/system-event',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      eventType: 'coordinator_onboarding_event',
      message: 'The user triggered a reference quiz clue during Coordinator onboarding.',
      extraEventFields: {
        subtype: 'reference_quiz_clue_requested',
        details: {
          game: 'guess_the_reference',
          triggerStepId: 'slack-reference',
          replyStepId: 'slack-message',
          channel: 'slack_message',
          clue: 'The clue is: "Phone home."',
          quote: 'Phone home.',
          answer: 'Battlestar Galactica',
        },
      },
    });
  });
});
