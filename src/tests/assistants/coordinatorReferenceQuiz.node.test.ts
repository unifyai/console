import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchCoordinatorOnboardingStepEvent } from '@/utils/assistants/coordinator-reference-quiz';

describe('dispatchCoordinatorOnboardingStepEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts reference quiz clues through the coordinator onboarding event envelope', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 202 }));
    vi.stubGlobal('fetch', fetchSpy);

    const event = await dispatchCoordinatorOnboardingStepEvent('123', {
      id: 'slack-reference',
      title: 'Receive Slack message from Twin',
      phase: 'Communication',
      status: 'available',
      canSkip: true,
      description: '',
      estimatedTime: '',
      chipsChat: [],
      chipsCall: [],
      dependencies: [],
      event: {
        eventType: 'coordinator_onboarding_event',
        message: 'The user triggered an onboarding communication task.',
        subtype: 'reference_quiz_clue_requested',
        details: {
          game: 'guess_the_reference',
          trigger_step_id: 'slack-reference',
          reply_step_id: 'slack-message',
          channel: 'slack_message',
          tool_name: 'send_slack_message',
          clue: 'The clue is: "Phone home."',
          quote: 'Phone home.',
          answer: 'Battlestar Galactica',
          framing: 'Play the mini-game.',
        },
      },
    });

    expect(event?.details.reply_step_id).toBe('slack-message');
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
      message: 'The user triggered an onboarding communication task.',
      extraEventFields: {
        subtype: 'reference_quiz_clue_requested',
        details: {
          game: 'guess_the_reference',
          trigger_step_id: 'slack-reference',
          reply_step_id: 'slack-message',
          channel: 'slack_message',
          tool_name: 'send_slack_message',
          clue: 'The clue is: "Phone home."',
          quote: 'Phone home.',
          answer: 'Battlestar Galactica',
          framing: 'Play the mini-game.',
        },
      },
    });
  });
});
