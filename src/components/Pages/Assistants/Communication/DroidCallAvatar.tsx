'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { AnimatedDroid, getCreatureAccent, getCreatureForm } from '@droid/brand/components';
import type { BrandRole, CreatureShape } from '@/components/Brand/shapes';
import type {
  CreatureAntenna,
  CreatureEyes,
  CreatureMood,
  CreatureMouthShape,
} from '@/components/Brand/TeammateCreature';
import { cn } from '@/lib/utils';
import { clampDroidSpeechLevel } from '@/utils/assistants/droid-animation';

interface DroidCallAvatarProps {
  isSpeaking: boolean;
  isCallActive?: boolean;
  isUserSpeaking?: boolean;
  animateBodyMotion?: boolean;
  mood?: CreatureMood;
  mouthShape?: CreatureMouthShape;
  speechLevel?: number;
  className?: string;
  creatureClassName?: string;
  layoutId?: string;
  layoutTransition?: Transition;
  antenna?: CreatureAntenna;
  shape?: CreatureShape;
  color?: BrandRole;
  baseEyes?: CreatureEyes;
  label?: string;
  /** When true the droid rests in an isometric 3/4 view and turns to camera while the call is active. */
  isometricRest?: boolean;
}

export function DroidCallAvatar({
  isSpeaking,
  isCallActive = false,
  isUserSpeaking = false,
  animateBodyMotion = true,
  mood = 'happy',
  mouthShape,
  speechLevel,
  className,
  creatureClassName,
  layoutId,
  layoutTransition,
  antenna,
  shape = 'clawd',
  color = 'green',
  baseEyes = 'up',
  label = 'Coordinator Droid',
  isometricRest = false,
}: DroidCallAvatarProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const displayedSpeechLevel = clampDroidSpeechLevel(speechLevel ?? 0);
  const displayedMouthShape =
    mouthShape ?? (displayedSpeechLevel > 0.08 && isSpeaking ? 'narrow' : 'closed');
  const animatedVisualStyle = {
    '--droid-speech-level': displayedSpeechLevel.toFixed(3),
  } as React.CSSProperties;
  const active = isometricRest ? isCallActive : true;
  const fixed = isometricRest ? undefined : 1;

  return (
    <motion.span
      className={cn('flex h-full w-full items-center justify-center overflow-visible', className)}
      layoutId={layoutId}
      aria-label={label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="img"
      style={animatedVisualStyle}
      transition={layoutTransition}
    >
      <AnimatedDroid
        antenna={antenna}
        className={cn('h-full w-full', creatureClassName)}
        accent={getCreatureAccent(color)}
        active={active}
        disableSpeechMotion={!animateBodyMotion}
        fixed={fixed}
        form={getCreatureForm(shape)}
        emotion={mood}
        isSpeaking={isSpeaking}
        isUserSpeaking={isUserSpeaking}
        restingEyes={isHovered ? 'square' : baseEyes}
        stableBox
        speechLevel={displayedSpeechLevel}
        mouthShape={displayedMouthShape}
      />
    </motion.span>
  );
}
