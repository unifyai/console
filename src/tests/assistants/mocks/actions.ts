import { AssistantActions } from '@/types/assistants/assistant';
import {
  mockAssistants,
  mockStatuses,
  mockVoices,
  mockPhoneCountries,
  mockSocialPlatforms,
} from './data';
import { vi } from 'vitest';
import { TaskActions } from '@/types/assistants/task';

export const mockAssistantActions: any = {
  assistant: {
    list: vi.fn(async () => mockAssistants),
    check: vi.fn(async () => ({ sufficient: true })),
    create: vi.fn(async (args) => ({
      info: 'Assistant created successfully.',
      assistant: { ...mockAssistants[0], ...args, agent_id: 'new_created_id' },
    })),
    update: vi.fn(async () => ({ info: 'Updated successfully' })),
    delete: vi.fn(async () => ({ info: 'Deleted successfully' })),
    status: vi.fn((id: string) =>
      Promise.resolve(
        mockStatuses.get(id) || {
          running: false,
          uptime_seconds: 0,
          process_id: null,
          assistant_id: id,
          shutdown_reason: null,
          inactivity_timeout_minutes: 0,
          message: null,
        }
      )
    ),
  },
  photo: {
    upload: vi.fn(async () => ({ gcs_url: 'gs://bucket/photo.jpg' })),
    uploadVideo: vi.fn(async () => ({ gcs_url: 'gs://bucket/video.mp4' })),
    download: vi.fn(async () => ({ signedUrl: 'https://signed.url/photo.jpg' })),
    downloadPresetVideo: vi.fn(async () => ({
      signedUrl: 'https://signed.url/video.mp4',
      gcsUrl: 'gs://bucket/preset_assistants/test.mp4',
    })),
    generate: vi.fn(async () => ({ url: 'https://generated.photo/image.jpg' })),
    edit: vi.fn(async () => ({ url: 'https://edited.photo/image.jpg' })),
    animate: vi.fn(async () => ({
      id: 'pred_123',
      status: 'starting',
      model: 'test',
      version: '1',
      createdAt: new Date().toISOString(),
    })),
    // Default to succeeded, but tests can override via spyOn
    getAnimation: vi.fn(async () => ({
      id: 'pred_123',
      status: 'succeeded',
      output: ['https://video.mp4'],
      model: 'test',
      version: '1',
      createdAt: new Date().toISOString(),
    })),
    cancelAnimation: vi.fn(async () => ({
      id: 'pred_123',
      status: 'canceled',
      model: 'test',
      version: '1',
      createdAt: new Date().toISOString(),
    })),
  },
  voice: {
    list: vi.fn(async () => mockVoices),
    register: vi.fn(async () => ({
      voiceId: 'v_new',
      name: 'New Voice',
      description: '',
      gender: 'female',
      language: 'en',
      provider: 'elevenlabs',
    })),
    delete: vi.fn(async () => ({ info: 'Voice deleted' })),
    clone: vi.fn(async () => ({
      voiceId: 'v_cloned',
      name: 'Cloned Voice',
      description: '',
      gender: 'female',
      language: 'en',
      provider: 'elevenlabs',
      isPreset: false,
    })),
    generate: vi.fn(async () => ({
      audioBase64: 'VGhpcyBpcyBhIHRlc3Q=',
      contentType: 'audio/mp3',
    })),
    preview: vi.fn(async () => ({
      previews: [{ generatedVoiceId: 'prev_1', audioBase64: 'audio', mediaType: 'audio/mpeg' }],
      text: 'Sample text',
    })),
    design: vi.fn(async () => ({
      voiceId: 'v_designed',
      name: 'Designed Voice',
      description: '',
      gender: 'female',
      language: 'en',
      provider: 'elevenlabs',
    })),
  },
  chat: {
    getContactId: vi.fn(async (_userEmail: string, _ownerId: string, _assistantId: string) => 1), // Default to owner contact_id
    getTranscripts: vi.fn(
      async (
        _contactId: number,
        _ownerId: string,
        _assistantId: string,
        _beforeMessageId?: number
      ) => []
    ),
    message: vi.fn(async () => ({ info: 'Message sent' })),
    getAssistantOwnerById: vi.fn(async (_userId: string) => ({
      firstName: 'Test',
      lastName: 'Owner',
    })),
  },
  contact: {
    delete: vi.fn(async () => ({ info: 'Contact deleted', assistant: mockAssistants[0] })),
    listAllAssistantEmails: vi.fn(async () => ['taken@assistant.ai']),
    listAvailablePhoneCountries: vi.fn(async () => mockPhoneCountries),
    listAvailableSocialPlatforms: vi.fn(async () => mockSocialPlatforms),
    verifySocialAccount: vi.fn(async () => ({
      verification_code: '123456',
      sent_at: new Date().toISOString(),
    })),
  },
  secret: {
    get: vi.fn(async () => []),
    create: vi.fn(async () => ({ info: 'Secret created' })),
    delete: vi.fn(async () => ({ info: 'Secret deleted' })),
  },
  approval: {
    getProfile: vi.fn(() =>
      Promise.resolve({ assistant_hiring_approval: 'approved', hasClaimedApprovalLink: true })
    ),
    requestAccess: vi.fn(async () => ({
      message: 'Request submitted',
      assistant_hiring_approval: 'pending',
    })),
    claimToken: vi.fn(async () => ({
      message: 'Token claimed',
      assistant_hiring_approval: 'approved',
    })),
  },
  call: {
    getConnectionDetails: vi.fn(async () => ({
      serverUrl: 'wss://test.livekit.cloud',
      roomName: 'room_1',
      token: 'token_1',
    })),
    dispatchToCall: vi.fn(async () => ({ info: 'Dispatched' })),
    deleteRoom: vi.fn(async () => ({})),
  },
  desktop: {
    getLiveviewUrl: vi.fn(async () => ({ liveviewUrl: 'https://vnc.example.com' })),
    checkLiveviewHealth: vi.fn(async () => true),
    sendSystemEvent: vi.fn(async () => ({ info: 'Event sent' })),
    listUserDesktops: vi.fn(async () => []),
  },
};

export const mockTaskActions: any = {
  get: vi.fn(() => Promise.resolve({ logs: [], count: 0 })),
  update: vi.fn(async () => ({ info: 'Tasks updated' })),
};
