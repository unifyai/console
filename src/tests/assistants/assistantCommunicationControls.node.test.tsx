/**
 * In-call toolbar guards for the assistant screen-share (remote control) toggle.
 *
 * The regression covered here: the toggle used to be enabled for any assistant
 * on a connected call, including one with no Computer at all, so clicking it
 * only ever produced "the assistant could not share their screen" or an endless
 * "starting up" spinner. Entitlement now disables the control, and its label
 * takes precedence over the join/readiness labels — an assistant that has no
 * desktop will not grow one by joining.
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssistantCommunicationControls } from '@/components/Pages/Assistants/Communication/AssistantCommunicationControls';

function renderControls(
  overrides: Partial<React.ComponentProps<typeof AssistantCommunicationControls>> = {}
) {
  return render(
    <AssistantCommunicationControls
      isMicOn
      micButtonProps={{}}
      isCameraOn={false}
      cameraButtonProps={{}}
      isScreenShareOn={false}
      onToggleScreenShare={vi.fn()}
      onHangUp={vi.fn()}
      onToggleChat={vi.fn()}
      onToggleSettings={vi.fn()}
      isRemoteControlActive={false}
      onToggleRemoteControl={vi.fn()}
      isRemoteControlLoading={false}
      isRemoteControlInteractive={false}
      onToggleRemoteControlInteractive={vi.fn()}
      isConnectionEstablished
      isAssistantJoined
      isDesktopEnabled
      isDesktopReady
      callType="audio"
      {...overrides}
    />
  );
}

describe('AssistantCommunicationControls — assistant screen share', () => {
  it('offers the toggle when the assistant has a desktop', () => {
    renderControls();

    const toggle = screen.getByTestId('call-toggle-assistant-screen');
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveAttribute('aria-label', 'Show assistant screen');
  });

  it('disables the toggle when the assistant has no Computer', () => {
    renderControls({ isDesktopEnabled: false });

    const toggle = screen.getByTestId('call-toggle-assistant-screen');
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('aria-label', 'Computer not enabled for this teammate');
  });

  it('reports the missing Computer rather than the join state', () => {
    renderControls({ isDesktopEnabled: false, isAssistantJoined: false });

    const toggle = screen.getByTestId('call-toggle-assistant-screen');
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('aria-label', 'Computer not enabled for this teammate');
  });

  it('still gates on the assistant joining once a desktop exists', () => {
    renderControls({ isAssistantJoined: false });

    const toggle = screen.getByTestId('call-toggle-assistant-screen');
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('aria-label', 'Available after assistant joins');
  });
});
