// Canonical implementation lives in the shared brand submodule (@droid/brand).
// This re-export keeps existing `@/components/Brand/RotatingBot` imports working.
export {
  RotatingBot,
  RB_FORM,
  getRotatingBotViewBox,
  getRotatingBotEyePoints,
  getRotatingBotBodyCenter,
  getRotatingBotAnchorRatios,
  type FormName,
  type BotEyeStyle,
  type BotAntennaStyle,
  type BotSkin,
  type BotView,
  type RotatingBotAccessory,
} from '@droid/brand/components';
