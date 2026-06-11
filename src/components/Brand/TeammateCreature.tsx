import { cn } from '@/lib/utils';
import {
  getRotatingBotEyePoints,
  getRotatingBotViewBox,
  RotatingBot,
  type BotAntennaStyle,
  type BotEyeStyle,
  type FormName,
} from './RotatingBot';
import type { BrandRole, CreatureShape } from './shapes';

export type CreatureEyes = 'up' | 'down' | 'square' | 'blink';
export type CreatureAntenna = BotAntennaStyle;
export type CreatureMood = 'happy' | 'sad' | 'frustrated' | 'apologetic' | 'bored';
export type CreatureMouthShape =
  | 'amplitude'
  | 'closed'
  | 'pinched'
  | 'wide'
  | 'open'
  | 'round'
  | 'narrow';

type TeammateCreatureProps = {
  className?: string;
  color?: BrandRole;
  antenna?: CreatureAntenna;
  eyes?: CreatureEyes;
  label?: string;
  mood?: CreatureMood;
  mouthShape?: CreatureMouthShape;
  shape?: CreatureShape;
};

const FORM_FOR_SHAPE: Record<CreatureShape, FormName> = {
  clawd: 'unit',
  notch: 'console',
  runner: 'unit',
  wide: 'wide',
  tall: 'tower',
  sprout: 'sprout',
  hopper: 'sprout',
  pebble: 'unit',
};

export const DEFAULT_ANTENNA_FOR_SHAPE: Record<CreatureShape, CreatureAntenna> = {
  clawd: 'ball',
  notch: 'none',
  runner: 'ball',
  wide: 'twin',
  tall: 'rod',
  sprout: 'bigball',
  hopper: 'bigball',
  pebble: 'ball',
};

const ACCENT_FOR_ROLE: Record<BrandRole, string> = {
  green: '#2f9d97',
  blue: '#4f7fa8',
  orange: '#cf9a3e',
  purple: '#8f6fa6',
  yellow: '#ffb24a',
  teal: '#2f9d97',
  pink: '#c95f5a',
  cyan: '#4f7fa8',
};

function eyeStyleFromCreatureEyes(eyes: CreatureEyes): BotEyeStyle {
  if (eyes === 'down') return 'down';
  return eyes === 'square' || eyes === 'blink' ? 'square' : 'up';
}

export function getCreatureMetrics(
  shape: CreatureShape,
  antenna = DEFAULT_ANTENNA_FOR_SHAPE[shape]
) {
  const form = FORM_FOR_SHAPE[shape];
  const viewBox = getRotatingBotViewBox(form, undefined, undefined, undefined, antenna);
  const eyePoints = getRotatingBotEyePoints(form);
  const eyeY = eyePoints.reduce((sum, [, y]) => sum + y, 0) / eyePoints.length - viewBox.minY;

  return {
    width: viewBox.w,
    height: viewBox.h,
    eyeY,
  };
}

export function TeammateCreature({
  antenna,
  className,
  color = 'green',
  eyes = 'up',
  label = 'Unify droid',
  shape = 'clawd',
}: TeammateCreatureProps) {
  const resolvedAntenna = antenna ?? DEFAULT_ANTENNA_FOR_SHAPE[shape];

  return (
    <span aria-label={label} className={cn('block overflow-visible', className)} role="img">
      <RotatingBot
        accent={ACCENT_FOR_ROLE[color]}
        antenna={resolvedAntenna}
        className="h-full w-full"
        eyeDir={eyeStyleFromCreatureEyes(eyes)}
        fixed={1}
        form={FORM_FOR_SHAPE[shape]}
      />
    </span>
  );
}
