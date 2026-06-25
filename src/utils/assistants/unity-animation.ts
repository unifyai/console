// Canonical implementation lives in the shared brand submodule (@unity/brand).
// The speech-driven animation helpers belong to the droid character, so they
// keep their Droid-prefixed names in the brand package and are re-exported here.
export {
  getSpeakingEyes,
  clampDroidSpeechLevel as clampUnitySpeechLevel,
  getDroidSpeechTransform as getUnitySpeechTransform,
} from '@unity/brand/droid';
