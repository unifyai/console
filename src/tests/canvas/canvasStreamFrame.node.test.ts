/**
 * Canvas frames on the assistant action stream.
 *
 * The lifecycle of one triggered action is assembled from **two** producers on the
 * same thread: Orchestra announces the invocation when it records it, and unify
 * announces how the run ended. Orchestra's announcement carries no status, so an
 * absent status has to mean `requested` — otherwise the first frame of every action
 * is discarded and a control never leaves its initial state.
 *
 * The 0-based id test is the one that caught a real class of bug elsewhere in this
 * feature: `invocation_id` is auto-counted, so the first run of a canvas is id `0`,
 * and any truthiness check on that path drops it.
 */

import { describe, expect, it } from 'vitest';

import { canvasFrame, encodeCanvasSse } from '@/lib/assistants/canvas-stream-frame';

const TOKEN = 'canvas_tok01';

function systemEvent(event: Record<string, unknown>) {
  return { thread: 'unity_system_event', event };
}

describe('canvas stream frames', () => {
  describe('what is not a canvas frame', () => {
    it('ignores an ordinary action event', () => {
      expect(canvasFrame({ thread: 'action_event', event: { type: 'ManagerMethod' } })).toBeNull();
    });

    it('ignores a system event of another kind', () => {
      expect(canvasFrame(systemEvent({ event_type: 'voice_enrollment_suggested' }))).toBeNull();
    });

    it('ignores a canvas event with no token', () => {
      // Without a token no surface can tell whether the event is theirs.
      expect(canvasFrame(systemEvent({ event_type: 'canvas_updated', title: 'x' }))).toBeNull();
    });
  });

  describe('canvas_updated', () => {
    it('reports a republish', () => {
      const frame = canvasFrame(
        systemEvent({
          event_type: 'canvas_updated',
          canvas_token: TOKEN,
          title: 'Task tracker',
          status: 'published',
        })
      );

      expect(frame).toEqual({
        type: 'CanvasUpdated',
        data: { token: TOKEN, title: 'Task tracker', status: 'published' },
      });
    });

    it('carries a deletion through, so a surface can stop re-reading the token', () => {
      const frame = canvasFrame(
        systemEvent({ event_type: 'canvas_updated', canvas_token: TOKEN, status: 'deleted' })
      );

      expect(frame?.type).toBe('CanvasUpdated');
      expect((frame as { data: { status: string } }).data.status).toBe('deleted');
    });
  });

  describe('canvas_invocation', () => {
    it("treats Orchestra's status-less announcement as requested", () => {
      // Orchestra publishes when it records the row, before anything has run.
      const frame = canvasFrame(
        systemEvent({
          event_type: 'canvas_invocation',
          canvas_token: TOKEN,
          invocation_id: 4,
          action_name: 'send_reminders',
        })
      );

      expect(frame).toEqual({
        type: 'CanvasInvocation',
        data: {
          token: TOKEN,
          invocationId: 4,
          actionName: 'send_reminders',
          status: 'requested',
        },
      });
    });

    it('keeps the very first invocation of a canvas, whose id is 0', () => {
      const frame = canvasFrame(
        systemEvent({
          event_type: 'canvas_invocation',
          canvas_token: TOKEN,
          invocation_id: 0,
          action_name: 'send_reminders',
          status: 'succeeded',
        })
      );

      expect(frame).not.toBeNull();
      expect((frame as { data: { invocationId: number } }).data.invocationId).toBe(0);
    });

    it('carries a failure reason', () => {
      const frame = canvasFrame(
        systemEvent({
          event_type: 'canvas_invocation',
          canvas_token: TOKEN,
          invocation_id: 1,
          action_name: 'send_reminders',
          status: 'failed',
          error: 'recipients: too long',
        })
      );

      expect((frame as { data: { error?: string } }).data.error).toBe('recipients: too long');
    });

    it('drops an event with no usable invocation id', () => {
      expect(
        canvasFrame(
          systemEvent({
            event_type: 'canvas_invocation',
            canvas_token: TOKEN,
            invocation_id: 'not-a-number',
          })
        )
      ).toBeNull();
    });
  });

  describe('SSE encoding', () => {
    it('emits a single terminated SSE data frame', () => {
      const encoded = encodeCanvasSse(
        systemEvent({ event_type: 'canvas_updated', canvas_token: TOKEN, title: 't' })
      );

      expect(encoded?.startsWith('data: ')).toBe(true);
      expect(encoded?.endsWith('\n\n')).toBe(true);
      // A newline inside the payload would split one frame into two.
      expect(encoded?.slice(6, -2)).not.toContain('\n');
    });

    it('returns null for a payload it does not own, so the route falls through', () => {
      expect(encodeCanvasSse({ thread: 'action_event', event: {} })).toBeNull();
    });
  });
});
