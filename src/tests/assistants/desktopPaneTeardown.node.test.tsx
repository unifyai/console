/**
 * Lifecycle of the standalone Desktop pane's viewing session.
 *
 * The regression covered here: the pane's tab body is force-mounted and only
 * CSS-hidden, and the whole assistants surface is only hidden behind other
 * routes, so leaving the Desktop tab used to leave a live liveview iframe
 * mounted — holding its socket open and decoding frames for the rest of the
 * session. The `desktop_pane` viewer it registered leaked with it, since a call
 * ending drops only the viewers that call owned.
 *
 * Hiding the pane now closes the session once the grace window elapses, and
 * returning inside that window keeps it without spending a start/stop pair.
 */
import * as React from 'react';
import { render, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantDesktopPane } from '@/components/Pages/Assistants/Desktop/AssistantDesktopPane';
import { DESKTOP_PANE_VIEWER_SOURCE } from '@/lib/assistants/desktopViewer';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';

vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => ({
  useWorkspace: () => ({ currentUserId: 'user-1' }),
}));

// The readiness hook owns polling and the desktop-ready event stream; this suite
// is about what the pane does around it. Readiness is a knob so the startup path
// can be exercised too.
const readiness = vi.hoisted(() => ({ isDesktopReady: true }));

vi.mock('@/hooks/Assistants/useDesktopReady', () => ({
  useDesktopReady: () => ({
    isDesktopReady: readiness.isDesktopReady,
    eventLiveviewUrl: null,
    eventBindingId: null,
    eventLiveviewPassword: null,
  }),
}));

const LIVEVIEW_URL = 'https://vm.example.com/desktop/custom.html?password=secret';

function makeAssistant(agentId = '42'): Assistant {
  return {
    agentId,
    userId: 'user-1',
    organizationId: null,
    firstName: 'Ada',
    surname: 'Byron',
    desktopMode: 'ubuntu',
    managedDesktopStatus: 'active',
  } as unknown as Assistant;
}

function makeDesktopActions() {
  return {
    getLiveviewUrl: vi.fn().mockResolvedValue({ liveviewUrl: LIVEVIEW_URL }),
    buildLiveviewUrl: vi.fn().mockResolvedValue({ liveviewUrl: LIVEVIEW_URL }),
    checkLiveviewHealth: vi.fn().mockResolvedValue(true),
    wakeAssistantSession: vi.fn().mockResolvedValue({ info: 'ok' }),
    sendSystemEvent: vi.fn().mockResolvedValue({ info: 'ok' }),
  } as unknown as AssistantActions['desktop'];
}

function shareEvents(actions: AssistantActions['desktop'], eventType: string) {
  return vi.mocked(actions.sendSystemEvent).mock.calls.filter((call) => call[1] === eventType);
}

/** Mount the pane visible and let the connect chain settle into `ready`. */
async function renderReadyPane() {
  const desktopActions = makeDesktopActions();
  const assistant = makeAssistant();

  const view = render(
    <AssistantDesktopPane assistant={assistant} desktopActions={desktopActions} isVisible />
  );
  // Drain the promise chain inside connect() (build/resolve → health → ready).
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

  return { view, desktopActions, assistant };
}

describe('AssistantDesktopPane — viewing session lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    readiness.isDesktopReady = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('opens the viewer and mounts the desktop when the pane is visible', async () => {
    const { view, desktopActions } = await renderReadyPane();

    expect(view.container.querySelector('iframe')).not.toBeNull();
    const started = shareEvents(desktopActions, 'assistant_screen_share_started');
    expect(started).toHaveLength(1);
    expect(started[0][3]).toMatchObject({
      viewerUserId: 'user-1',
      viewerSource: DESKTOP_PANE_VIEWER_SOURCE,
    });
  });

  it('keeps the desktop up while hidden inside the grace window', async () => {
    const { view, desktopActions, assistant } = await renderReadyPane();

    view.rerender(
      <AssistantDesktopPane
        assistant={assistant}
        desktopActions={desktopActions}
        isVisible={false}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(shareEvents(desktopActions, 'assistant_screen_share_stopped')).toHaveLength(0);
    expect(view.container.querySelector('iframe')).not.toBeNull();
  });

  it('closes the viewer and unmounts the desktop once the grace window elapses', async () => {
    const { view, desktopActions, assistant } = await renderReadyPane();

    view.rerender(
      <AssistantDesktopPane
        assistant={assistant}
        desktopActions={desktopActions}
        isVisible={false}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    const stopped = shareEvents(desktopActions, 'assistant_screen_share_stopped');
    expect(stopped).toHaveLength(1);
    expect(stopped[0][3]).toMatchObject({
      viewerUserId: 'user-1',
      viewerSource: DESKTOP_PANE_VIEWER_SOURCE,
    });
    expect(view.container.querySelector('iframe')).toBeNull();
  });

  it('does not close twice when the pane unmounts after the grace window', async () => {
    const { view, desktopActions, assistant } = await renderReadyPane();

    view.rerender(
      <AssistantDesktopPane
        assistant={assistant}
        desktopActions={desktopActions}
        isVisible={false}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    view.unmount();

    expect(shareEvents(desktopActions, 'assistant_screen_share_stopped')).toHaveLength(1);
  });

  it('closes the viewer immediately when the pane unmounts while visible', async () => {
    const { view, desktopActions } = await renderReadyPane();

    view.unmount();

    expect(shareEvents(desktopActions, 'assistant_screen_share_stopped')).toHaveLength(1);
  });

  it('re-opens the viewer when the pane comes back after being torn down', async () => {
    const { view, desktopActions, assistant } = await renderReadyPane();

    view.rerender(
      <AssistantDesktopPane
        assistant={assistant}
        desktopActions={desktopActions}
        isVisible={false}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    view.rerender(
      <AssistantDesktopPane assistant={assistant} desktopActions={desktopActions} isVisible />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(shareEvents(desktopActions, 'assistant_screen_share_started')).toHaveLength(2);
    expect(view.container.querySelector('iframe')).not.toBeNull();
  });

  it('releases remote control alongside the viewer when the grace window elapses', async () => {
    const { view, desktopActions, assistant } = await renderReadyPane();

    // Take control, the way the toolbar toggle does.
    const takeControl = view.getByRole('button', { name: /take control/i });
    await act(async () => {
      takeControl.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(shareEvents(desktopActions, 'user_remote_control_started')).toHaveLength(1);

    view.rerender(
      <AssistantDesktopPane
        assistant={assistant}
        desktopActions={desktopActions}
        isVisible={false}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(shareEvents(desktopActions, 'user_remote_control_stopped')).toHaveLength(1);
    expect(shareEvents(desktopActions, 'assistant_screen_share_stopped')).toHaveLength(1);
  });
});

describe('AssistantDesktopPane — watch / unwatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    readiness.isDesktopReady = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /** Press the one control that serves both directions. */
  async function toggleWatch(view: Awaited<ReturnType<typeof renderReadyPane>>['view']) {
    await act(async () => {
      view.getByTestId('desktop-watch-toggle').click();
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  it('closes the viewer on unwatch and stays closed while the pane is visible', async () => {
    const { view, desktopActions } = await renderReadyPane();

    await toggleWatch(view);

    expect(shareEvents(desktopActions, 'assistant_screen_share_stopped')).toHaveLength(1);
    expect(view.container.querySelector('iframe')).toBeNull();
    expect(view.getByTestId('desktop-not-watching')).toBeTruthy();

    // The auto-connect effect would otherwise undo this on the next render.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(shareEvents(desktopActions, 'assistant_screen_share_started')).toHaveLength(1);
    expect(view.container.querySelector('iframe')).toBeNull();
  });

  it('re-opens the viewer on watch', async () => {
    const { view, desktopActions } = await renderReadyPane();

    await toggleWatch(view);
    await toggleWatch(view);

    expect(shareEvents(desktopActions, 'assistant_screen_share_started')).toHaveLength(2);
    expect(view.container.querySelector('iframe')).not.toBeNull();
  });

  it('keeps the unwatch across leaving the tab and coming back', async () => {
    const { view, desktopActions, assistant } = await renderReadyPane();

    await toggleWatch(view);
    view.rerender(
      <AssistantDesktopPane
        assistant={assistant}
        desktopActions={desktopActions}
        isVisible={false}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    view.rerender(
      <AssistantDesktopPane assistant={assistant} desktopActions={desktopActions} isVisible />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(shareEvents(desktopActions, 'assistant_screen_share_started')).toHaveLength(1);
    expect(view.getByTestId('desktop-not-watching')).toBeTruthy();
  });

  it('still reconnects by itself after the grace teardown, which is not an unwatch', async () => {
    const { view, desktopActions, assistant } = await renderReadyPane();

    view.rerender(
      <AssistantDesktopPane
        assistant={assistant}
        desktopActions={desktopActions}
        isVisible={false}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    view.rerender(
      <AssistantDesktopPane assistant={assistant} desktopActions={desktopActions} isVisible />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(shareEvents(desktopActions, 'assistant_screen_share_started')).toHaveLength(2);
    expect(view.container.querySelector('iframe')).not.toBeNull();
  });

  it('releases remote control on unwatch', async () => {
    const { view, desktopActions } = await renderReadyPane();

    await act(async () => {
      view.getByRole('button', { name: /take control/i }).click();
      await vi.advanceTimersByTimeAsync(0);
    });

    await toggleWatch(view);

    expect(shareEvents(desktopActions, 'user_remote_control_stopped')).toHaveLength(1);
    expect(shareEvents(desktopActions, 'assistant_screen_share_stopped')).toHaveLength(1);
  });

  it('stops the startup attempts when unwatched before the desktop comes up', async () => {
    readiness.isDesktopReady = false;
    const desktopActions = makeDesktopActions();
    const view = render(
      <AssistantDesktopPane assistant={makeAssistant()} desktopActions={desktopActions} isVisible />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(desktopActions.wakeAssistantSession).toHaveBeenCalledTimes(1);

    await toggleWatch(view);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    // No second wake, and nothing tried to resolve a URL for a desktop nobody
    // is waiting for. Nothing was ever open, so there is no stop to send.
    expect(desktopActions.wakeAssistantSession).toHaveBeenCalledTimes(1);
    expect(desktopActions.getLiveviewUrl).not.toHaveBeenCalled();
    expect(shareEvents(desktopActions, 'assistant_screen_share_stopped')).toHaveLength(0);
    expect(view.getByTestId('desktop-not-watching')).toBeTruthy();
  });

  it('clears the unwatch when the active assistant changes', async () => {
    const { view, desktopActions, assistant } = await renderReadyPane();

    await toggleWatch(view);
    view.rerender(
      <AssistantDesktopPane
        assistant={makeAssistant('43')}
        desktopActions={desktopActions}
        isVisible
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(view.container.querySelector('iframe')).not.toBeNull();
    const started = shareEvents(desktopActions, 'assistant_screen_share_started');
    expect(started).toHaveLength(2);
    expect(started[1][0]).toBe('43');
    expect(assistant.agentId).toBe('42');
  });
});
