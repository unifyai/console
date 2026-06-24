import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchCoordinatorOnboardingStepEvent } from '@/utils/assistants/coordinator-reference-quiz';

describe('dispatchCoordinatorOnboardingStepEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the Orchestra-owned onboarding step event by step id', async () => {
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ emitted: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const event = await dispatchCoordinatorOnboardingStepEvent('123', {
      id: 'slack-reference',
      title: 'Receive Slack message from T-W1N',
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
        message: "The user just clicked 'Receive Slack message from T-W1N'.",
        subtype: 'reference_quiz_clue_requested',
        details: {
          game: 'guess_the_reference',
          trigger_step_id: 'slack-reference',
          reply_step_id: 'slack-message',
          channel: 'slack_message',
          tool_name: 'send_slack_message',
          framing: 'Play the mini-game.',
        },
      },
    });

    expect(event?.details.reply_step_id).toBe('slack-message');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/coordinator-onboarding-step-event',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      coordinatorId: '123',
      stepId: 'slack-reference',
    });
  });
});
