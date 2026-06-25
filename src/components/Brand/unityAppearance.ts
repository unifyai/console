// Canonical implementation lives in the shared brand submodule (@unity/brand).
// These appearance helpers belong to the droid character, so they keep their
// Droid-prefixed names in the brand package and are re-exported here.
export {
  droidAntennaOptions as unityAntennaOptions,
  droidBodyForms as unityBodyForms,
  droidBodyOptions as unityBodyOptions,
  droidColorOptions as unityColorOptions,
  droidOutfitOptions as unityOutfitOptions,
  getDroidBodyForm as getUnityBodyForm,
  type DroidAntenna as UnityAntenna,
  type DroidBody as UnityBody,
  type DroidColor as UnityColor,
  type DroidOutfit as UnityOutfit,
} from '@unity/brand/components';
