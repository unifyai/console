// Canonical implementation lives in the shared brand submodule (@unity/brand).
// The lipsync/emotion helpers belong to the droid character, so they keep their
// Droid-prefixed names in the brand package and are re-exported here.
export {
  DROID_IDLE_LIPSYNC_FRAME as UNIFY_IDLE_LIPSYNC_FRAME,
  getDroidSpeechLevel as getUnitySpeechLevel,
  getDroidMouthShape as getUnityMouthShape,
  getDroidLipsyncFrame as getUnityLipsyncFrame,
  getEmotionResting,
  getEmotionMouthShape,
  useDroidAudioElementLipsync as useUnityAudioElementLipsync,
  useDroidTrackLipsync as useUnityTrackLipsync,
  type DroidLipsyncFrame as UnityLipsyncFrame,
} from '@unity/brand/droid';
