import { faker } from '@faker-js/faker';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';

/**
 * Creates a mock assistant object with realistic fake data.
 * @param overrides - An object with properties to override the generated defaults.
 * @returns A mock Assistant object.
 */
export function createMockAssistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    agent_id: faker.string.uuid(),
    first_name: faker.person.firstName(),
    surname: faker.person.lastName(),
    email: faker.internet.email().toLowerCase(),
    phone: faker.phone.number(),
    assistant_whatsapp_number: faker.phone.number(),
    profile_photo: faker.image.avatar(),
    profile_video: null,
    age: faker.number.int({ min: 20, max: 50 }),
    nationality: faker.location.country(),
    about: faker.lorem.paragraph(),
    phone_country: 'US',
    timezone: faker.location.timeZone(),
    voice_id: `v_${faker.string.alphanumeric(10)}`,
    voice_provider: 'elevenlabs',
    voice_mode: 'tts',
    user_phone: null,
    user_whatsapp_number: null,
    weekly_limit: 40,
    max_parallel: 10,
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides, // Apply any specific overrides for the test case
  };
}

// --- Exported Mock Data ---

// A consistent set of assistants for our tests
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