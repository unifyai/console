/**
 * Unit tests for useAssistants hook.
 *
 * Tests cover:
 * - Initial data loading
 * - Batched URL fetching (single setAssistants call for all URLs)
 * - Error handling
 * - Delete and update operations
 *
 * Key behavior tested:
 * - Photo and video URLs are fetched in parallel and applied in a single batch
 * - This prevents cascading re-renders from multiple setAssistants calls
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAssistants } from '@/hooks/Assistants/useAssistants';
import { AssistantActions, Assistant } from '@/types/assistants/assistant';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock GCS utility
vi.mock('@/utils/assistants/gcs-utils', () => ({
  isGcsPhoto: (url: string) => url?.startsWith('gs://'),
}));

// Mock client fetch module
const mockFetchAssistants = vi.fn();
const mockFetchMediaSignedUrls = vi.fn();
const mockReadCachedMediaSignedUrls = vi.fn();
const mockSeedMediaSignedUrls = vi.fn();
vi.mock('@/lib/client/assistant', () => ({
  fetchAssistants: (...args: any[]) => mockFetchAssistants(...args),
  fetchMediaSignedUrls: (...args: any[]) => mockFetchMediaSignedUrls(...args),
  readCachedMediaSignedUrls: (...args: any[]) => mockReadCachedMediaSignedUrls(...args),
  seedMediaSignedUrls: (...args: any[]) => mockSeedMediaSignedUrls(...args),
}));

// Create stable mock functions at module level to prevent re-render loops
const mockDeleteAction = vi.fn();
const mockUpdateAction = vi.fn();
const mockCheckAction = vi.fn();
const mockDownloadAction = vi.fn();

// Create a stable mock actions object (not recreated on each render)
const mockActions: AssistantActions = {
  assistant: {
    delete: mockDeleteAction,
    update: mockUpdateAction,
    check: mockCheckAction,
    create: vi.fn(),
  },
  photo: {
    downloadMedia: mockDownloadAction,
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

// Mock assistant data
const createMockAssistant = (id: string, hasPhoto = true, hasVideo = false): Assistant =>
  ({
    agentId: id,
    firstName: `Assistant${id}`,
    surname: 'Test',
    profilePhoto: hasPhoto ? `gs://bucket/photo-${id}.jpg` : undefined,
    profileVideo: hasVideo ? `gs://bucket/video-${id}.mp4` : undefined,
  }) as Assistant;

describe('useAssistants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockFetchAssistants.mockResolvedValue([]);
    mockFetchMediaSignedUrls.mockResolvedValue({});
    mockReadCachedMediaSignedUrls.mockReturnValue({});
    mockSeedMediaSignedUrls.mockImplementation(() => {});
    mockDeleteAction.mockResolvedValue({});
    mockUpdateAction.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Initial Loading
  // ===========================================================================

  describe('initial loading', () => {
    it('starts with loading state true and empty assistants', () => {
      mockFetchAssistants.mockReturnValue(new Promise(() => {}));
      const { result, unmount } = renderHook(() => useAssistants(mockActions, false));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.assistants).toEqual([]);

      unmount();
    });

    it('fetches assistants on mount', async () => {
      mockFetchAssistants.mockResolvedValue([]);
      renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(mockFetchAssistants).toHaveBeenCalledTimes(1);
      });
    });

    it('sets assistants after successful fetch', async () => {
      const assistants = [createMockAssistant('1', false), createMockAssistant('2', false)];
      mockFetchAssistants.mockResolvedValue(assistants);

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.assistants).toHaveLength(2);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('handles 403 error as empty list (user not approved)', async () => {
      mockFetchAssistants.mockResolvedValue({ detail: 'Forbidden', status: 403 });

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.assistants).toEqual([]);
        expect(result.current.error).toBeNull();
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('sets error state on fetch failure', async () => {
      mockFetchAssistants.mockResolvedValue({ detail: 'Server error' });

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.error).toBe('Server error');
        expect(result.current.assistants).toEqual([]);
      });
    });
  });

  // ===========================================================================
  // Batched URL Fetching (Key optimization test)
  // ===========================================================================

  describe('batched URL fetching', () => {
    it('batch-fetches photo URLs for all assistants with GCS photos', async () => {
      const assistants = [
        createMockAssistant('1', true, false),
        createMockAssistant('2', true, false),
        createMockAssistant('3', true, false),
      ];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockFetchMediaSignedUrls.mockResolvedValue({
        'gs://bucket/photo-1.jpg': 'https://signed/photo-1.jpg',
        'gs://bucket/photo-2.jpg': 'https://signed/photo-2.jpg',
        'gs://bucket/photo-3.jpg': 'https://signed/photo-3.jpg',
      });

      renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(mockFetchMediaSignedUrls).toHaveBeenCalledWith([
          'gs://bucket/photo-1.jpg',
          'gs://bucket/photo-2.jpg',
          'gs://bucket/photo-3.jpg',
        ]);
      });
    });

    it('batch-fetches both photo and video URLs when both exist', async () => {
      const assistants = [createMockAssistant('1', true, true)];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockFetchMediaSignedUrls.mockResolvedValue({
        'gs://bucket/photo-1.jpg': 'https://signed/photo-1.jpg',
        'gs://bucket/video-1.mp4': 'https://signed/video-1.mp4',
      });

      renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(mockFetchMediaSignedUrls).toHaveBeenCalledWith([
          'gs://bucket/photo-1.jpg',
          'gs://bucket/video-1.mp4',
        ]);
      });
    });

    it('updates assistants with signed URLs after batch fetch completes', async () => {
      const assistants = [
        createMockAssistant('1', true, true),
        createMockAssistant('2', true, false),
      ];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockFetchMediaSignedUrls.mockResolvedValue({
        'gs://bucket/photo-1.jpg': 'https://signed/photo-1.jpg',
        'gs://bucket/video-1.mp4': 'https://signed/video-1.mp4',
        'gs://bucket/photo-2.jpg': 'https://signed/photo-2.jpg',
      });

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        const assistant1 = result.current.assistants.find((a) => a.agentId === '1');
        const assistant2 = result.current.assistants.find((a) => a.agentId === '2');

        expect(assistant1?.signedProfilePhotoUrl).toBe('https://signed/photo-1.jpg');
        expect(assistant1?.signedProfileVideoUrl).toBe('https://signed/video-1.mp4');
        expect(assistant2?.signedProfilePhotoUrl).toBe('https://signed/photo-2.jpg');
        expect(assistant2?.signedProfileVideoUrl).toBeUndefined();
      });
    });

    it('handles partial URL fetch failures gracefully', async () => {
      const assistants = [
        createMockAssistant('1', true, false),
        createMockAssistant('2', true, false),
      ];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockFetchMediaSignedUrls.mockResolvedValue({
        'gs://bucket/photo-1.jpg': 'https://signed/photo-1.jpg',
      });

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        const assistant1 = result.current.assistants.find((a) => a.agentId === '1');
        const assistant2 = result.current.assistants.find((a) => a.agentId === '2');
        expect(assistant1?.signedProfilePhotoUrl).toBe('https://signed/photo-1.jpg');
        expect(assistant2?.signedProfilePhotoUrl).toBeUndefined();
      });
    });

    it('skips URL fetching for non-GCS photos', async () => {
      const assistants = [
        {
          ...createMockAssistant('1', false, false),
          profilePhoto: 'https://external-url.com/photo.jpg',
        } as Assistant,
      ];
      mockFetchAssistants.mockResolvedValue(assistants);

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.assistants).toHaveLength(1);
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchMediaSignedUrls).not.toHaveBeenCalled();
    });

    it('handles empty URL response gracefully', async () => {
      const assistants = [createMockAssistant('1', true, false)];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockFetchMediaSignedUrls.mockResolvedValue({});

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.assistants).toHaveLength(1);
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.assistants[0].signedProfilePhotoUrl).toBeUndefined();
    });

    it('applies cached signed URLs immediately and fetches only unresolved paths', async () => {
      const assistants = [
        createMockAssistant('1', true, false),
        createMockAssistant('2', true, false),
      ];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockReadCachedMediaSignedUrls.mockReturnValue({
        'gs://bucket/photo-1.jpg': 'https://signed/cached-photo-1.jpg',
      });
      mockFetchMediaSignedUrls.mockResolvedValue({
        'gs://bucket/photo-2.jpg': 'https://signed/fresh-photo-2.jpg',
      });

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        const assistant1 = result.current.assistants.find((a) => a.agentId === '1');
        const assistant2 = result.current.assistants.find((a) => a.agentId === '2');
        expect(assistant1?.signedProfilePhotoUrl).toBe('https://signed/cached-photo-1.jpg');
        expect(assistant2?.signedProfilePhotoUrl).toBe('https://signed/fresh-photo-2.jpg');
      });

      expect(mockFetchMediaSignedUrls).toHaveBeenCalledWith(['gs://bucket/photo-2.jpg']);
    });

    it('preserves signed URLs across refresh when media paths are unchanged', async () => {
      const assistants = [createMockAssistant('1', true, false)];
      mockFetchAssistants.mockResolvedValueOnce(assistants).mockResolvedValueOnce(assistants);
      mockReadCachedMediaSignedUrls
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ 'gs://bucket/photo-1.jpg': 'https://signed/photo-1.jpg' });
      mockFetchMediaSignedUrls.mockResolvedValue({
        'gs://bucket/photo-1.jpg': 'https://signed/photo-1.jpg',
      });

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.assistants[0]?.signedProfilePhotoUrl).toBe(
          'https://signed/photo-1.jpg'
        );
      });

      await act(async () => {
        await result.current.refreshAssistants(false);
      });

      await waitFor(() => {
        expect(result.current.assistants[0]?.signedProfilePhotoUrl).toBe(
          'https://signed/photo-1.jpg'
        );
      });

      expect(mockFetchMediaSignedUrls).toHaveBeenCalledTimes(1);
      expect(mockSeedMediaSignedUrls).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Delete Assistant
  // ===========================================================================

  describe('deleteAssistant', () => {
    it('removes assistant from list on successful delete', async () => {
      const assistants = [createMockAssistant('1', false), createMockAssistant('2', false)];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockDeleteAction.mockResolvedValue({});

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.assistants).toHaveLength(2);
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.deleteAssistant(assistants[0]);
      });

      expect(success).toBe(true);
      expect(result.current.assistants).toHaveLength(1);
      expect(result.current.assistants[0].agentId).toBe('2');
    });

    it('returns false and keeps assistant on delete failure', async () => {
      const assistants = [createMockAssistant('1', false)];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockDeleteAction.mockResolvedValue({ detail: 'Delete failed' });

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.assistants).toHaveLength(1);
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.deleteAssistant(assistants[0]);
      });

      expect(success).toBe(false);
      expect(result.current.assistants).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Update Assistant
  // ===========================================================================

  describe('updateAssistantProfile', () => {
    it('updates assistant in list on successful update', async () => {
      const assistants = [createMockAssistant('1', false)];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockUpdateAction.mockResolvedValue({});

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.assistants).toHaveLength(1);
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.updateAssistantProfile('1', { about: 'Updated bio' });
      });

      expect(success).toBe(true);
      expect(result.current.assistants[0].about).toBe('Updated bio');
    });

    it('fetches new signed URL when photo is updated', async () => {
      const assistants = [createMockAssistant('1', false)];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockUpdateAction.mockResolvedValue({});
      mockFetchMediaSignedUrls.mockResolvedValue({
        'gs://bucket/new-photo.jpg': 'https://new-signed-url.com',
      });

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.assistants).toHaveLength(1);
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateAssistantProfile('1', {
          profilePhoto: 'gs://bucket/new-photo.jpg',
        });
      });

      await waitFor(() => {
        expect(mockFetchMediaSignedUrls).toHaveBeenCalledWith(['gs://bucket/new-photo.jpg']);
        expect(result.current.assistants[0].signedProfilePhotoUrl).toBe(
          'https://new-signed-url.com'
        );
      });
    });

    it('returns false on update failure', async () => {
      const assistants = [createMockAssistant('1', false)];
      mockFetchAssistants.mockResolvedValue(assistants);
      mockUpdateAction.mockResolvedValue({ detail: 'Update failed' });

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(result.current.assistants).toHaveLength(1);
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.updateAssistantProfile('1', { about: 'Updated bio' });
      });

      expect(success).toBe(false);
    });
  });

  // ===========================================================================
  // Refresh Assistants
  // ===========================================================================

  describe('refreshAssistants', () => {
    it('refetches assistants when called', async () => {
      mockFetchAssistants.mockResolvedValue([]);

      const { result } = renderHook(() => useAssistants(mockActions, false));

      await waitFor(() => {
        expect(mockFetchAssistants).toHaveBeenCalledTimes(1);
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshAssistants(false);
      });

      expect(mockFetchAssistants).toHaveBeenCalledTimes(2);
    });
  });
});
