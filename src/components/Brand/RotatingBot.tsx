// Canonical implementation lives in the shared brand submodule (@unity/brand).
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
} from '@unity/brand/components';
