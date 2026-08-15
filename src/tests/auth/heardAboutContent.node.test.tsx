/**
 * Heard-about step — the self-reported channel goes to Orchestra together
 * with the first touch the browser remembered, and the memory is spent
 * only once the step has actually saved.
 */

import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HeardAboutContent from '@/components/Pages/Onboarding/HeardAboutContent';
import { clearFirstTouch, readFirstTouch, rememberFirstTouch } from '@/utils/user/firstTouch';

type Props = React.ComponentProps<typeof HeardAboutContent>;

function renderStep(onUpdateOnboarding: Props['onUpdateOnboarding']) {
  const onPatchSession = vi.fn<Props['onPatchSession']>(() => new Promise<never>(() => {}));
  render(
    <HeardAboutContent onUpdateOnboarding={onUpdateOnboarding} onPatchSession={onPatchSession} />
  );
  return onPatchSession;
}

describe('HeardAboutContent first touch', () => {
  beforeEach(() => {
    clearFirstTouch();
    window.history.replaceState({}, '', '/login?utm_source=x&utm_campaign=kpi');
    rememberFirstTouch();
  });

  it('sends the remembered first touch beside the answer and forgets it once saved', async () => {
    const onUpdateOnboarding = vi.fn<Props['onUpdateOnboarding']>().mockResolvedValue(null);
    const onPatchSession = renderStep(onUpdateOnboarding);

    fireEvent.click(screen.getByTestId('heard-about-search'));
    fireEvent.click(screen.getByTestId('heard-about-continue'));

    await waitFor(() => expect(onPatchSession).toHaveBeenCalled());
    expect(onUpdateOnboarding).toHaveBeenCalledWith({
      currentStep: 'workspace_setup',
      stepData: {
        heardAbout: 'search',
        utmSource: 'x',
        utmCampaign: 'kpi',
        landingUrl: '/login?utm_source=x&utm_campaign=kpi',
      },
    });
    expect(readFirstTouch()).toBeNull();
  });

  it('keeps the first touch when the step fails to save', async () => {
    const onUpdateOnboarding = vi
      .fn<Props['onUpdateOnboarding']>()
      .mockResolvedValue({ detail: 'Nope', status: 500 });
    renderStep(onUpdateOnboarding);

    fireEvent.click(screen.getByTestId('heard-about-search'));
    fireEvent.click(screen.getByTestId('heard-about-continue'));

    await screen.findByTestId('heard-about-error');
    expect(readFirstTouch()?.utmSource).toBe('x');
  });
});
