import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const subscribeMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/client/assistant-action-stream', () => ({
  subscribeToAssistantActionStream: subscribeMock,
}));

import { useConsoleScriptStream } from '@/hooks/Assistants/useConsoleScriptStream';
import { writeAgentNavigationEnabled } from '@/hooks/Assistants/useAgentNavigationPermission';
import type { TargetNavigator } from '@/lib/agent-guidance/consoleTargets';

/** Hand the hook a script the way the SSE stream would. */
function emitScript(targets: string[]): void {
  const onMessage = subscribeMock.mock.calls.at(-1)?.[1]?.onMessage as (d: string) => void;
  onMessage(
    JSON.stringify({
      type: 'ConsoleScript',
      data: { steps: targets.map((target) => ({ target })) },
    })
  );
}

function navSpy() {
  const sections: Array<string | null | undefined> = [];
  const nav: TargetNavigator = {
    navigateTo: vi.fn(),
    navigateToAssistants: (o) => sections.push(o?.sectionId),
  };
  return { nav, sections };
}

beforeEach(() => {
  window.localStorage.clear();
  subscribeMock.mockReset();
  subscribeMock.mockReturnValue(() => {});
});

afterEach(() => {
  window.localStorage.clear();
});

/**
 * Withholding the catalogue stops the assistant asking, but a script can
 * already be in flight when the user unticks. This is the second layer.
 */
describe('running a script under the navigation permission', () => {
  it('runs the moves while permission is granted', async () => {
    const { nav, sections } = navSpy();
    renderHook(() => useConsoleScriptStream({ assistantId: '123', nav }));

    emitScript(['section:integrations']);

    await waitFor(() => expect(sections).toEqual(['integrations']));
  });

  it('runs nothing at all once the user has opted out', async () => {
    writeAgentNavigationEnabled(false);
    const { nav, sections } = navSpy();
    renderHook(() => useConsoleScriptStream({ assistantId: '123', nav }));

    emitScript(['section:integrations', 'section:tasks']);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(sections).toEqual([]);
  });

  it('abandons the rest of a sequence when permission is withdrawn part-way', async () => {
    // The permission is read per step, so a script that arrived while it was on
    // stops where the user turned it off rather than running to completion.
    const { nav, sections } = navSpy();
    renderHook(() => useConsoleScriptStream({ assistantId: '123', nav }));

    emitScript(['section:integrations', 'section:tasks', 'section:contacts']);

    await waitFor(() => expect(sections).toEqual(['integrations']));
    writeAgentNavigationEnabled(false);

    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(sections).toEqual(['integrations']);
  });

  it('ignores frames that are not a script', async () => {
    const { nav, sections } = navSpy();
    renderHook(() => useConsoleScriptStream({ assistantId: '123', nav }));

    const onMessage = subscribeMock.mock.calls.at(-1)?.[1]?.onMessage as (d: string) => void;
    onMessage(JSON.stringify({ type: 'VoiceEnrollmentSuggested', data: { numSpeakers: 2 } }));
    onMessage('not json');

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(sections).toEqual([]);
  });

  it('does not subscribe without a teammate to listen for', () => {
    const { nav } = navSpy();
    renderHook(() => useConsoleScriptStream({ assistantId: null, nav }));
    expect(subscribeMock).not.toHaveBeenCalled();
  });
});

/**
 * The stream reaches every open tab. Only one should act, or a tab the user was
 * reading jumps somewhere else behind their back — and the teammate hears the
 * same outcome once per tab.
 */
describe('when several tabs receive the same script', () => {
  it('acts in the tab holding the claim', async () => {
    const { claimActiveConsoleTab } = await import('@/hooks/Assistants/useActiveTabClaim');
    claimActiveConsoleTab();

    const { nav, sections } = navSpy();
    renderHook(() => useConsoleScriptStream({ assistantId: '123', nav }));

    emitScript(['section:integrations']);

    await waitFor(() => expect(sections).toEqual(['integrations']));
  });

  it('stands down in a tab that does not hold it', async () => {
    const { ACTIVE_TAB_STORAGE_KEY } = await import('@/hooks/Assistants/useActiveTabClaim');
    window.localStorage.setItem(
      ACTIVE_TAB_STORAGE_KEY,
      JSON.stringify({ tabId: 'a-different-tab', at: Date.now() })
    );

    const { nav, sections } = navSpy();
    renderHook(() => useConsoleScriptStream({ assistantId: '123', nav }));

    emitScript(['section:integrations', 'section:tasks']);

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(sections).toEqual([]);
  });

  it('reports nothing from a tab that stood down', async () => {
    // Otherwise the teammate is told the same outcome once per open tab.
    const { ACTIVE_TAB_STORAGE_KEY } = await import('@/hooks/Assistants/useActiveTabClaim');
    const { reportConsoleScriptResult } = await import('@/lib/client/console-script-result');
    const send = vi.spyOn({ reportConsoleScriptResult }, 'reportConsoleScriptResult');
    window.localStorage.setItem(
      ACTIVE_TAB_STORAGE_KEY,
      JSON.stringify({ tabId: 'a-different-tab', at: Date.now() })
    );

    const { nav } = navSpy();
    renderHook(() => useConsoleScriptStream({ assistantId: '123', nav }));
    emitScript(['section:integrations']);

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(send).not.toHaveBeenCalled();
  });

  it('finishes a sequence it started even if the user switches away', async () => {
    // The sequence was addressed to this tab; abandoning half of it partway
    // leaves the user with a move described and not made.
    const { claimActiveConsoleTab, ACTIVE_TAB_STORAGE_KEY } =
      await import('@/hooks/Assistants/useActiveTabClaim');
    claimActiveConsoleTab();

    const { nav, sections } = navSpy();
    renderHook(() => useConsoleScriptStream({ assistantId: '123', nav }));
    emitScript(['section:integrations', 'section:tasks']);

    await waitFor(() => expect(sections).toEqual(['integrations']));
    window.localStorage.setItem(
      ACTIVE_TAB_STORAGE_KEY,
      JSON.stringify({ tabId: 'a-different-tab', at: Date.now() })
    );

    await waitFor(() => expect(sections).toEqual(['integrations', 'tasks']), { timeout: 3000 });
  });
});
