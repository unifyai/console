import type { Voice, VoiceOption } from '@/types/assistants/assistant';

type ApprovedVoiceMetadata = Pick<
  Voice,
  'name' | 'description' | 'gender' | 'language' | 'provider'
>;

export const approvedCharacterVoiceMetadata: Record<string, ApprovedVoiceMetadata> = {
  cgSgspJ2msm6clMCkdW9: {
    name: 'Sparkle Scout',
    description: 'Bright, playful, and upbeat for cheerful customer-facing teammates.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  FGY2WhTYpPnrIDTdsKH5: {
    name: 'Sunny Sprite',
    description: 'Confident, quirky, and energetic with a warm animated feel.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  ThT5KcBeYPX3keUQqHPh: {
    name: 'Cozy Button',
    description: 'Gentle, sweet, and organized for calm everyday help.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  MF3mGyEYCl7XYWbV9V6O: {
    name: 'Velvet Glimmer',
    description: 'Soft, expressive, and friendly with a polished character tone.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  AZnzlk1XvdvUeBnXmlld: {
    name: 'Bubble Builder',
    description: 'Cute, lively, and animated for tiny mascot energy.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  zrHiDhphv9ZnVXBqCLjz: {
    name: 'Pip Pop',
    description: 'Bright, enthusiastic, and bouncy for playful helper personas.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  CYw3kZ02Hs0563khs1Fj: {
    name: 'Chatter Chip',
    description: 'Light, conversational, and personable with cartoon-sidekick warmth.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  IKne3meq5aSn9XLyUdCD: {
    name: 'Zippy Spark',
    description: 'Energetic, animated, and confident without feeling too deep.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  TX3LPaxmHKxFdv7VOQHJ: {
    name: 'Warm Widget',
    description: 'Warm, friendly, and upbeat for approachable helper characters.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  bVMeCyTHy58xNoL34h3p: {
    name: 'Jolly Rocket',
    description: 'Excited, bright, and playful for high-energy teammates.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  iP95p4xoKVk53GoZ742B: {
    name: 'Friendly Flicker',
    description: 'Natural, casual, and upbeat for grounded helper personalities.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  cjVigY5qzO86Huf0OWal: {
    name: 'Velvet Captain',
    description: 'Smooth, polished, and friendly while still feeling characterful.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
};

export const defaultCharacterVoiceId = 'cgSgspJ2msm6clMCkdW9';
export const coordinatorFixedVoiceId = 'cjVigY5qzO86Huf0OWal';

export const approvedCharacterVoiceIds = new Set(Object.keys(approvedCharacterVoiceMetadata));

export function applyApprovedCharacterVoiceMetadata<T extends Voice | VoiceOption>(voice: T): T {
  const metadata = approvedCharacterVoiceMetadata[voice.voiceId];
  return metadata ? ({ ...voice, ...metadata } as T) : voice;
}
