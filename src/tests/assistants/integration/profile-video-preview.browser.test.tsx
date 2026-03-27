import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, waitFor } from '@/tests/render';
import { AssistantProfileInfoPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileInfoPanel';
import { createMockAssistant } from '@/tests/assistants/mocks/data';

function getProfilePhotoTrigger(container: HTMLElement): HTMLElement {
  const trigger = container.querySelector('div.group.relative.flex-shrink-0.cursor-pointer');
  if (!trigger) {
    throw new Error('Expected profile photo trigger to be present.');
  }
  return trigger as HTMLElement;
}

describe('Assistant profile video preview regressions', () => {
  const gcsVideoPath = 'gs://bucket/1132/video/alien-from-mars.mp4';
  const staleSignedUrl =
    'https://storage.googleapis.com/assistant-media-staging/1132/video/alien-from-mars.mp4?X-Goog-Expires=900&X-Goog-Date=20260327T202300Z';
  const refreshedSignedUrl =
    'https://storage.googleapis.com/assistant-media-staging/1132/video/alien-from-mars.mp4?X-Goog-Expires=900&X-Goog-Date=20260327T210100Z';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests a fresh signed URL when opening preview for a GCS-backed profile video', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ urls: { [gcsVideoPath]: refreshedSignedUrl } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const assistant = createMockAssistant({
      firstName: 'Rachel',
      surname: 'Lewis',
      profilePhoto: null,
      profileVideo: gcsVideoPath,
      signedProfileVideoUrl: staleSignedUrl,
    });

    const { container } = render(
      <AssistantProfileInfoPanel assistant={assistant} onEdit={vi.fn()} canWrite={false} />
    );

    await user.click(getProfilePhotoTrigger(container));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/assistant/media/batch-urls',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: [gcsVideoPath] }),
        })
      );
    });
  });

  it('uses the refreshed signed URL for playback instead of the stale one', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ urls: { [gcsVideoPath]: refreshedSignedUrl } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const assistant = createMockAssistant({
      firstName: 'Rachel',
      surname: 'Lewis',
      profilePhoto: null,
      profileVideo: gcsVideoPath,
      signedProfileVideoUrl: staleSignedUrl,
    });

    const { container } = render(
      <AssistantProfileInfoPanel assistant={assistant} onEdit={vi.fn()} canWrite={false} />
    );

    await user.click(getProfilePhotoTrigger(container));

    await waitFor(() => {
      const videoEl = document.querySelector('video');
      expect(videoEl).not.toBeNull();
      expect(videoEl).toHaveAttribute('src', refreshedSignedUrl);
    });
  });
});
