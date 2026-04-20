export const ASSISTANT_ONBOARDING_FEE = 10;

export const PHOTO_OPERATION_COST = 0.05;
export const VIDEO_ANIMATION_COST = 0.2;
export const MIN_TTS_PROMPT_LENGTH = 10; // Minimum characters for TTS prompt to ensure audio ≥ 3s (Replicate requirement)
export const PRE_HIRE_CHAT_MESSAGE_COST = 0.01;

export const EMAIL_DOMAIN_WITH_AT = '@unify.ai';
/* eslint-disable @typescript-eslint/naming-convention */
export const EMAIL_DOMAINS: Record<string, string> = {
  google_workspace: '@unify.ai',
  microsoft_365: '@tenant.onmicrosoft.com',
};
/* eslint-enable @typescript-eslint/naming-convention */

export const FALLBACK_DEFAULT_COUNTRY_CODE = 'GB';

export const AVAILABLE_FEATURES: Record<string, string[]> = {
  google: ['email', 'calendar', 'drive', 'contacts', 'tasks'],
  microsoft: ['email', 'teams', 'calendar', 'drive', 'contacts', 'sharepoint', 'tasks'],
};

export const REQUIRED_FEATURES: Record<string, string[]> = {
  google: ['email'],
  microsoft: ['email', 'teams'],
};

export const PRIMARY_VOICE_PROVIDER: 'cartesia' | 'elevenlabs' = 'elevenlabs';
export const DESIGN_VOICE_DESC_MIN_LENGTH = 20;
export const DESIGN_VOICE_DESC_MAX_LENGTH = 1000;
export const DESIGN_SAMPLE_TEXT_MIN_LENGTH = 100;
export const DESIGN_SAMPLE_TEXT_MAX_LENGTH = 1000;

export const ASSISTANT_CHAT_LOADED_MESSAGES_COUNT = 50;
