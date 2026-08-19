/**
 * The teammate-desktop list on a Meet-stage call.
 *
 * What this replaced: a start control and a stop control, each opening its own
 * subset of the teammates, neither saying which desktops were actually up, and
 * both hidden from everyone but the host — so a share could outlive the host
 * with nobody left able to reach the switch. It is now one list of names with
 * its own state on every row, open to anyone on the call.
 */
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@livekit/components-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@livekit/components-react')>();
  return {
    ...actual,
    useTracks: () => [],
    useIsSpeaking: () => false,
    useMediaDeviceSelect: () => ({
      devices: [],
      activeDeviceId: '',
      setActiveMediaDevice: vi.fn(),
    }),
  };
});

const { OrgCallMeetStage } = await import('@/components/Pages/Assistants/OrgChat/OrgCallMeetStage');

function assistant(agentId: string, name: string) {
  return {
    agentId,
    name,
    image: null,
    ownerUserId: 'owner',
    organizationId: 1,
    desktopMode: 'ubuntu' as const,
    managedDesktopStatus: 'active' as const,
  };
}

function renderStage({
  toggles,
  onToggle = vi.fn(async () => true),
  currentUserId = 'guest',
}: {
  toggles: Array<{ agentId: string; name: string; sharing?: boolean; available?: boolean }>;
  onToggle?: (assistantId: string, next: boolean) => Promise<boolean>;
  currentUserId?: string;
}) {
  const desktopToggles = toggles.map((t) => ({
    assistant: assistant(t.agentId, t.name),
    sharing: t.sharing ?? false,
    available: t.available ?? true,
  }));
  const result = render(
    <OrgCallMeetStage
      call={
        {
          callId: 'call-1',
          roomName: 'org_call_room',
          status: 'active',
          scope: 'group',
          // Someone else opened this call: every assertion below is made as a
          // guest, because the control is no longer the host's alone.
          createdByUserId: 'host',
          callerUserId: 'host',
          calleeUserId: null,
          teamId: null,
          groupId: 3,
          organizationId: 1,
          createdByAssistantId: null,
          threadId: null,
          userIds: ['host', 'guest'],
          assistantIds: desktopToggles.map((t) => Number(t.assistant.agentId)),
          participants: [
            { userId: 'host', role: 'host', status: 'joined' },
            { userId: 'guest', role: 'guest', status: 'joined' },
          ],
          roster: [],
        } as never
      }
      room={null}
      roomEpoch={0}
      currentUserId={currentUserId}
      humansById={{}}
      assistantsById={{}}
      localName="Me"
      localImage={null}
      micEnabled
      camEnabled={false}
      screenShareEnabled={false}
      isHost={false}
      addableAssistants={[]}
      desktopToggles={desktopToggles}
      onToggleAssistantDesktop={onToggle}
      onToggleMic={vi.fn()}
      onToggleCam={vi.fn()}
      onToggleScreenShare={vi.fn()}
      onMinimize={vi.fn()}
      onLeave={vi.fn()}
      onEnd={vi.fn()}
      onAddAssistant={vi.fn()}
    />
  );
  return { ...result, onToggle };
}

async function openList() {
  fireEvent.click(screen.getByTestId('org-call-assistant-desktops'));
  await waitFor(() =>
    expect(screen.getAllByTestId('org-call-assistant-desktop-option')).not.toHaveLength(0)
  );
  return screen.getAllByTestId('org-call-assistant-desktop-option');
}

describe('teammate desktops on a Meet-stage call', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists every teammate on the call, sharing or not', async () => {
    renderStage({
      toggles: [
        { agentId: '42', name: 'Ava', sharing: true },
        { agentId: '77', name: 'Bo' },
      ],
    });

    const rows = await openList();

    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Ava'),
      expect.stringContaining('Bo'),
    ]);
    // The state is on the row, which is the whole point of one list: reading it
    // no longer means noticing which of two buttons a name appeared under.
    expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
    expect(rows[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('lets a guest put a desktop up', async () => {
    const { onToggle } = renderStage({ toggles: [{ agentId: '42', name: 'Ava' }] });

    const rows = await openList();
    fireEvent.click(rows[0]);

    expect(onToggle).toHaveBeenCalledWith('42', true);
  });

  it('lets a guest take down a desktop somebody else put up', async () => {
    const { onToggle } = renderStage({
      toggles: [{ agentId: '42', name: 'Ava', sharing: true }],
    });

    const rows = await openList();
    fireEvent.click(rows[0]);

    // The case host-only could not serve: the share stays reachable after
    // whoever started it has gone.
    expect(onToggle).toHaveBeenCalledWith('42', false);
  });

  it('shows a teammate with no desktop, and refuses to toggle it', async () => {
    const { onToggle } = renderStage({
      toggles: [{ agentId: '99', name: 'Cy', available: false }],
    });

    const rows = await openList();

    expect(rows[0]).toBeDisabled();
    expect(rows[0].textContent).toContain('No desktop');
    fireEvent.click(rows[0]);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('holds the row until the room answers, not until the request returns', async () => {
    let release: (accepted: boolean) => void = () => {};
    const onToggle = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve;
        })
    );
    renderStage({ toggles: [{ agentId: '42', name: 'Ava' }], onToggle });

    const rows = await openList();
    fireEvent.click(rows[0]);

    await waitFor(() =>
      expect(screen.getAllByTestId('org-call-assistant-desktop-option')[0]).toBeDisabled()
    );

    // Accepting is not arriving: the desktop mounts when the runtime broadcast
    // lands, so the row stays held.
    release(true);
    await waitFor(() =>
      expect(screen.getAllByTestId('org-call-assistant-desktop-option')[0]).toBeDisabled()
    );
  });

  it('releases the row when the runtime refuses', async () => {
    const onToggle = vi.fn(async () => false);
    renderStage({ toggles: [{ agentId: '42', name: 'Ava' }], onToggle });

    const rows = await openList();
    fireEvent.click(rows[0]);

    await waitFor(() =>
      expect(screen.getAllByTestId('org-call-assistant-desktop-option')[0]).toBeEnabled()
    );
  });

  it('renders no control when the call carries no teammates', () => {
    renderStage({ toggles: [] });

    expect(screen.queryByTestId('org-call-assistant-desktops')).toBeNull();
  });
});
