/**
 * Reporting the user's shared surfaces to a running assistant.
 *
 * The regression covered here: reporting only ever fired on a toggle, and
 * hanging up is not a toggle. Ending a call while sharing left the assistant
 * holding a surface claim it had no way to retract — and because a frontend
 * report outranks LiveKit track state for the surfaces it owns, that stale
 * claim silenced the track events that would otherwise have corrected it.
 */
import * as React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMeetSurfaceReporting } from '@/hooks/Assistants/useMeetSurfaceReporting';

type Sent = [assistantId: string, eventType: string, message: string];

interface Surfaces {
  screenShare: boolean;
  camera: boolean;
  agentId: string | undefined;
}

const CLOSED: Surfaces = { screenShare: false, camera: false, agentId: '42' };

function renderReporter(overrides: Partial<Surfaces> = {}) {
  const sent: Sent[] = [];
  const sendSystemEvent = vi.fn(async (...args: Sent) => {
    sent.push(args);
    return { info: 'ok' };
  });

  // No default parameters here: a default would swallow an explicit
  // `agentId: undefined`, which is the detached case one test is about.
  function Harness(props: Surfaces) {
    useMeetSurfaceReporting({ ...props, sendSystemEvent });
    return null;
  }

  const initial = { ...CLOSED, ...overrides };
  const view = render(<Harness {...initial} />);
  const rerender = (next: Partial<Surfaces>) =>
    view.rerender(<Harness {...{ ...initial, ...next }} />);
  return { sent, sendSystemEvent, rerender, unmount: view.unmount };
}

const types = (sent: Sent[]) => sent.map(([, eventType]) => eventType);

describe('useMeetSurfaceReporting', () => {
  it('says nothing for surfaces that were already closed', () => {
    const { sent } = renderReporter();

    expect(sent).toEqual([]);
  });

  it('reports each surface opening and closing', () => {
    const { sent, rerender } = renderReporter();

    rerender({ screenShare: true });
    rerender({ screenShare: false });

    expect(types(sent)).toEqual(['user_screen_share_started', 'user_screen_share_stopped']);
    expect(sent[0][0]).toBe('42');
  });

  it('reports both surfaces when they change in the same render', () => {
    const { sent, rerender } = renderReporter();

    rerender({ screenShare: true, camera: true });

    expect(types(sent).sort()).toEqual(['user_screen_share_started', 'user_webcam_started']);
  });

  it('closes surfaces still open at unmount', () => {
    const { sent, rerender, unmount } = renderReporter();

    rerender({ screenShare: true, camera: true });
    sent.length = 0;
    unmount();

    expect(types(sent).sort()).toEqual(['user_screen_share_stopped', 'user_webcam_stopped']);
  });

  it('stays silent at unmount for surfaces already reported closed', () => {
    const { sent, rerender, unmount } = renderReporter();

    rerender({ screenShare: true });
    rerender({ screenShare: false });
    sent.length = 0;
    unmount();

    expect(sent).toEqual([]);
  });

  it('does not treat a toggle as an unmount', () => {
    const { sent, rerender } = renderReporter();

    rerender({ screenShare: true });
    rerender({ camera: true, screenShare: true });

    expect(types(sent)).not.toContain('user_screen_share_stopped');
  });

  it('reports nothing while no assistant is attached', () => {
    const { sent, rerender, unmount } = renderReporter({ agentId: undefined });

    rerender({ screenShare: true });
    unmount();

    expect(sent).toEqual([]);
  });
});
