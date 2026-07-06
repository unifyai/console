const ELEVENLABS_TWIN_PRONUNCIATION_PATTERN = /t-w1n/gi;
const ELEVENLABS_TWIN_PRONUNCIATION_REPLACEMENT = 'Twin';

/** Rewrites the coordinator marker so ElevenLabs pronounces it as "Twin". */
export function normalizeElevenLabsTwinPronunciation(text: string): string {
  return text.replace(
    ELEVENLABS_TWIN_PRONUNCIATION_PATTERN,
    ELEVENLABS_TWIN_PRONUNCIATION_REPLACEMENT
  );
}
