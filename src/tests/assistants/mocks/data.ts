import { faker } from '@faker-js/faker';
import type {
  Assistant,
  AssistantStatus,
  AssistantPreset,
  VoiceOption,
  AvailablePhoneCountry,
  AvailableSocialPlatform,
} from '@/types/assistants/assistant';
import { SupportedLanguage, Gender } from '@cartesia/cartesia-js/api';

/**
 * Creates a mock assistant object with realistic fake data.
 */
export function createMockAssistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    agentId: faker.string.uuid(),
    userId: faker.string.uuid(), // ID of the user who created this assistant
    organizationId: null, // null for personal workspace assistants
    userFirstName: 'Test', // Owner's first name for transcript context
    userLastName: 'Owner', // Owner's last name for transcript context
    firstName: faker.person.firstName(),
    surname: faker.person.lastName(),
    email: faker.internet.email().toLowerCase(),
    phone: faker.phone.number(),
    assistantWhatsappNumber: faker.phone.number(),
    profilePhoto: faker.image.avatar(),
    profileVideo: null,
    age: faker.number.int({ min: 20, max: 50 }),
    nationality: 'United States',
    about: faker.lorem.paragraph(),
    phoneCountry: 'US',
    timezone: 'UTC',
    voiceId: `v_${faker.string.alphanumeric(10)}`,
    voiceProvider: 'elevenlabs',
    voiceMode: 'tts',
    userPhone: null,
    userWhatsappNumber: null,
    weeklyLimit: 40,
    maxParallel: 10,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

// --- Exported Mock Data ---

export const mockAssistants: Assistant[] = [
  createMockAssistant({
    agentId: '1',
    firstName: 'Jane',
    surname: 'Doe',
    email: 'jane.doe@example.com',
  }),
  createMockAssistant({
    agentId: '2',
    firstName: 'John',
    surname: 'Smith',
    email: 'john.smith@example.com',
    phone: null,
    assistantWhatsappNumber: null,
  }),
];

export const mockAssistantWithoutSocials: Assistant = createMockAssistant({
  agentId: '3',
  firstName: 'Alex',
  surname: 'Ray',
  email: null,
  phone: null,
  assistantWhatsappNumber: null,
});

export const mockStatuses = new Map<string, AssistantStatus | null>();
mockStatuses.set('1', { running: true } as AssistantStatus);
mockStatuses.set('2', { running: false } as AssistantStatus);

export const mockVoices: VoiceOption[] = [
  {
    voiceId: 'voice_1',
    name: 'Alice (US)',
    description: 'Friendly American female',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
    isPreset: true,
    isUserVoiceInOrchestra: false,
  },
  {
    voiceId: 'voice_2',
    name: 'Bob (UK)',
    description: 'Professional British male',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
    isPreset: true,
    isUserVoiceInOrchestra: false,
  },
  {
    voiceId: 'voice_3',
    name: 'Speedy (OpenAI)',
    description: 'Low latency voice',
    gender: 'male',
    language: 'en',
    provider: 'openai',
    isPreset: true,
    isUserVoiceInOrchestra: false,
  },
];

export const mockPresets: AssistantPreset[] = [
  {
    firstName: 'Sarah',
    surname: 'Connor',
    age: 28,
    nationality: 'United States',
    about: 'Experienced scheduler.',
    profilePhoto: 'https://example.com/photo1.jpg',
    profileVideo: null,
    phoneCountry: 'US',
    timezone: 'America/New_York',
    gender: 'female',
    voiceIds: {
      elevenlabs: 'voice_1',
      openai: 'voice_3',
      cartesia: null,
    },
    language: 'en',
    voiceMode: 'tts',
  },
  {
    firstName: 'James',
    surname: 'Bond',
    age: 40,
    nationality: 'United Kingdom',
    about: 'Secret agent assistant.',
    profilePhoto: 'https://example.com/photo2.jpg',
    profileVideo: null,
    phoneCountry: 'GB',
    timezone: 'Europe/London',
    gender: 'male',
    voiceIds: {
      elevenlabs: 'voice_2',
      openai: 'voice_3', // Reuse same openai voice for simplicity
      cartesia: null,
    },
    language: 'en',
    voiceMode: 'tts',
  },
];

export const mockPhoneCountries: AvailablePhoneCountry[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
];

export const mockSocialPlatforms: AvailableSocialPlatform[] = [
  { name: 'whatsapp', cost: 5.0 },
  { name: 'telegram', cost: 0.0 },
];
