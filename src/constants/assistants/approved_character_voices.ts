import type { Voice, VoiceOption } from '@/types/assistants/assistant';

type ApprovedVoiceMetadata = Pick<
  Voice,
  'name' | 'description' | 'gender' | 'language' | 'provider'
>;

export const approvedCharacterVoiceMetadata: Record<string, ApprovedVoiceMetadata> = {
  cgSgspJ2msm6clMCkdW9: {
    name: 'Nova Guide',
    description: 'Bright, polished, and upbeat for cheerful customer-facing teammates.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  FGY2WhTYpPnrIDTdsKH5: {
    name: 'Solar Cadence',
    description: 'Confident, offbeat, and energetic with a warm animated edge.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  ThT5KcBeYPX3keUQqHPh: {
    name: 'Orbit Liaison',
    description: 'Gentle, composed, and organized for calm everyday guidance.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  MF3mGyEYCl7XYWbV9V6O: {
    name: 'Velvet Signal',
    description: 'Soft, expressive, and friendly with a polished signal-operator tone.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  AZnzlk1XvdvUeBnXmlld: {
    name: 'Vector Pilot',
    description: 'Lively, animated, and clear for high-presence operational teammates.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  zrHiDhphv9ZnVXBqCLjz: {
    name: 'Echo Pulse',
    description: 'Bright, enthusiastic, and quick-moving for high-energy helper personas.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  CYw3kZ02Hs0563khs1Fj: {
    name: 'Comms Relay',
    description: 'Light, conversational, and personable with approachable comms-officer warmth.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  IKne3meq5aSn9XLyUdCD: {
    name: 'Vector Pulse',
    description: 'Energetic, animated, and confident with a bright sci-fi edge.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  TX3LPaxmHKxFdv7VOQHJ: {
    name: 'Beacon Operator',
    description: 'Warm, friendly, and upbeat for approachable support teammates.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  bVMeCyTHy58xNoL34h3p: {
    name: 'Launch Control',
    description: 'Excited, bright, and mission-ready for high-energy teammates.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  iP95p4xoKVk53GoZ742B: {
    name: 'Field Signal',
    description: 'Natural, casual, and upbeat for grounded field-assistant personalities.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  cjVigY5qzO86Huf0OWal: {
    name: 'Velvet Command',
    description: 'Smooth, polished, and friendly with a command-deck presence.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
};

export const defaultCharacterVoiceId = 'cgSgspJ2msm6clMCkdW9';
// The Coordinator uses this voice by default when seeded or created; it is
// fully selectable afterwards like every other droid's voice.
export const coordinatorDefaultVoiceId = 'iP95p4xoKVk53GoZ742B';

export const approvedCharacterVoiceIds = new Set(Object.keys(approvedCharacterVoiceMetadata));

export function applyApprovedCharacterVoiceMetadata<T extends Voice | VoiceOption>(voice: T): T {
  const metadata = approvedCharacterVoiceMetadata[voice.voiceId];
  return metadata ? ({ ...voice, ...metadata } as T) : voice;
}
