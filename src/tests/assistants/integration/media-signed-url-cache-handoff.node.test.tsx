import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssistants } from '@/hooks/Assistants/useAssistants';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import {
  clearMediaSignedUrlCacheForTests,
  seedMediaSignedUrls,
} from '@/lib/client/mediaSignedUrlCache';

const mockFetchAssistants = vi.fn();

vi.mock('@/lib/client/assistant', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/client/assistant')>('@/lib/client/assistant');
  return {
    ...actual,
    fetchAssistants: (...args: any[]) => mockFetchAssistants(...args),
  };
});

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock('@/utils/assistants/gcs-utils', async () => {
  const actual = await vi.importActual<typeof import('@/utils/assistants/gcs-utils')>(
    '@/utils/assistants/gcs-utils'
  );
  return {
    ...actual,
    isGcsPhoto: (url: string) => url?.startsWith('gs://'),
  };
});

const mockActions: AssistantActions = {
  assistant: {
    delete: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    check: vi.fn(),
    create: vi.fn(),
  },
  photo: {
    downloadMedia: vi.fn(),
    uploadPhoto: vi.fn(),
    uploadVideo: vi.fn(),
    downloadPresetPhoto: vi.fn(),
    downloadPresetVideo: vi.fn(),
    generate: vi.fn(),
    edit: vi.fn(),
    animate: vi.fn(),
    getAnimation: vi.fn(),
    cancelAnimation: vi.fn(),
  },
  voice: {} as any,
  chat: {} as any,
  contact: {} as any,
  secret: {} as any,
  call: {} as any,
  desktop: {} as any,
  spending: {} as any,
} as AssistantActions;

const createAssistant = (id: string, profilePhoto: string): Assistant =>
  ({
    agentId: id,
    firstName: `Assistant${id}`,
    surname: 'Cache',
    profilePhoto,
  }) as Assistant;

function toGoogleDate(ms: number): string {
  const iso = new Date(ms).toISOString();
  const [datePart, timePart] = iso.split('T');
  return `${datePart.replaceAll('-', '')}T${timePart.slice(0, 8).replaceAll(':', '')}Z`;
}

function buildSignedUrl(pathTail: string, expiresSeconds: number = 900): string {
  return `https://storage.googleapis.com/assistant-media-staging/${pathTail}?X-Goog-Date=${toGoogleDate(
    Date.now()
  )}&X-Goog-Expires=${expiresSeconds}&X-Goog-Signature=test`;
}

describe('assistant media signed URL cache handoff integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMediaSignedUrlCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearMediaSignedUrlCacheForTests();
  });

  it('reuses signed URLs on refresh when media path is unchanged', async () => {
    const mediaPath = 'gs://bucket/1/photo/avatar.jpg';
    const signedUrl = buildSignedUrl('1/photo/avatar.jpg');
    const assistant = createAssistant('1', mediaPath);

    mockFetchAssistants.mockResolvedValueOnce([assistant]).mockResolvedValueOnce([assistant]);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          urls: { [mediaPath]: signedUrl },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { result } = renderHook(() => useAssistants(mockActions, false));

    await waitFor(() => {
      expect(result.current.assistants[0]?.signedProfilePhotoUrl).toBe(signedUrl);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refreshAssistants(false);
    });

    await waitFor(() => {
      expect(result.current.assistants[0]?.signedProfilePhotoUrl).toBe(signedUrl);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('hydrates immediately from seeded cache without requesting new signed URLs', async () => {
    const mediaPath = 'gs://bucket/2/photo/avatar.jpg';
    const seededSignedUrl = buildSignedUrl('2/photo/avatar.jpg');
    seedMediaSignedUrls({ [mediaPath]: seededSignedUrl });
    mockFetchAssistants.mockResolvedValueOnce([createAssistant('2', mediaPath)]);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ urls: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { result } = renderHook(() => useAssistants(mockActions, false));

    await waitFor(() => {
      expect(result.current.assistants[0]?.signedProfilePhotoUrl).toBe(seededSignedUrl);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
