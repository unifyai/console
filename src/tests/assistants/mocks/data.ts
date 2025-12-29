import { faker } from '@faker-js/faker';
import type { Assistant, AssistantStatus, AssistantPreset, VoiceOption, AvailablePhoneCountry, AvailableSocialPlatform } from '@/types/assistants/assistant';
import { SupportedLanguage, Gender } from '@cartesia/cartesia-js/api';

/**
 * Creates a mock assistant object with realistic fake data.
 */
export function createMockAssistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    agent_id: faker.string.uuid(),
    user_id: faker.string.uuid(), // ID of the user who created this assistant
    organization_id: null, // null for personal workspace assistants
    first_name: faker.person.firstName(),
    surname: faker.person.lastName(),
    email: faker.internet.email().toLowerCase(),
    phone: faker.phone.number(),
    assistant_whatsapp_number: faker.phone.number(),
    profile_photo: faker.image.avatar(),
    profile_video: null,
    age: faker.number.int({ min: 20, max: 50 }),
    nationality: 'United States',
    about: faker.lorem.paragraph(),
    phone_country: 'US',
    timezone: 'UTC',
    voice_id: `v_${faker.string.alphanumeric(10)}`,
    voice_provider: 'elevenlabs',
    voice_mode: 'tts',
    user_phone: null,
    user_whatsapp_number: null,
    weekly_limit: 40,
    max_parallel: 10,
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}

// --- Exported Mock Data ---

export const mockAssistants: Assistant[] = [
  createMockAssistant({ agent_id: '1', first_name: 'Jane', surname: 'Doe', email: 'jane.doe@example.com' }),
  createMockAssistant({ agent_id: '2', first_name: 'John', surname: 'Smith', email: 'john.smith@example.com', phone: null, assistant_whatsapp_number: null }),
];

export const mockAssistantWithoutSocials: Assistant = createMockAssistant({
    agent_id: '3',
    first_name: 'Alex',
    surname: 'Ray',
    email: null,
    phone: null,
    assistant_whatsapp_number: null,
});

export const mockStatuses = new Map<string, AssistantStatus | null>();
mockStatuses.set('1', { running: true } as AssistantStatus);
mockStatuses.set('2', { running: false } as AssistantStatus);

export const mockVoices: VoiceOption[] = [
    {
        voice_id: 'voice_1',
        name: 'Alice (US)',
        description: 'Friendly American female',
        gender: 'female',
        language: 'en',
        provider: 'elevenlabs',
        is_preset: true,
        isUserVoiceInOrchestra: false
    },
    {
        voice_id: 'voice_2',
        name: 'Bob (UK)',
        description: 'Professional British male',
        gender: 'male',
        language: 'en',
        provider: 'elevenlabs',
        is_preset: true,
        isUserVoiceInOrchestra: false
    },
    {
        voice_id: 'voice_3',
        name: 'Speedy (OpenAI)',
        description: 'Low latency voice',
        gender: 'male',
        language: 'en',
        provider: 'openai',
        is_preset: true,
        isUserVoiceInOrchestra: false
    }
];

export const mockPresets: AssistantPreset[] = [
    {
        first_name: 'Sarah',
        surname: 'Connor',
        age: 28,
        nationality: 'United States',
        about: 'Experienced scheduler.',
        profile_photo: 'https://example.com/photo1.jpg',
        profile_video: null,
        phone_country: 'US',
        timezone: 'America/New_York',
        gender: 'female',
        voice_ids: {
            elevenlabs: 'voice_1',
            openai: 'voice_3',
            cartesia: null
        },
        language: 'en',
        voice_mode: 'tts'
    },
    {
        first_name: 'James',
        surname: 'Bond',
        age: 40,
        nationality: 'United Kingdom',
        about: 'Secret agent assistant.',
        profile_photo: 'https://example.com/photo2.jpg',
        profile_video: null,
        phone_country: 'GB',
        timezone: 'Europe/London',
        gender: 'male',
        voice_ids: {
            elevenlabs: 'voice_2',
            openai: 'voice_3', // Reuse same openai voice for simplicity
            cartesia: null
        },
        language: 'en',
        voice_mode: 'tts'
    }
];

export const mockPhoneCountries: AvailablePhoneCountry[] = [
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' }
];

export const mockSocialPlatforms: AvailableSocialPlatform[] = [
    { name: 'whatsapp', cost: 5.00 },
    { name: 'telegram', cost: 0.00 }
];