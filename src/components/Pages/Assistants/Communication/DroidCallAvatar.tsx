'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { TeammateCreature } from '@/components/Brand';
import type { BrandRole, CreatureShape } from '@/components/Brand/shapes';
import type {
  CreatureEyes,
  CreatureMood,
  CreatureMouthShape,
} from '@/components/Brand/TeammateCreature';
import { cn } from '@/lib/utils';
import { useDroidEyeExpression } from '@/hooks/Assistants/useDroidEyeExpression';
import { clampDroidSpeechLevel, getDroidSpeechTransform } from '@/utils/assistants/droid-animation';

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
  shape?: CreatureShape;
  color?: BrandRole;
  baseEyes?: CreatureEyes;
  label?: string;
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
  shape = 'clawd',
  color = 'green',
  baseEyes = 'up',
  label = 'Coordinator Droid',
}: DroidCallAvatarProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const displayedSpeechLevel = clampDroidSpeechLevel(speechLevel ?? 0);
  const displayedMouthShape =
    mouthShape ?? (displayedSpeechLevel > 0.08 && isSpeaking ? 'narrow' : 'closed');
  const animatedEyes = useDroidEyeExpression({
    baseEyes,
    isCallActive,
    isSpeaking,
    isUserSpeaking,
    speechLevel: displayedSpeechLevel,
  });
  const displayedCreatureEyes = isHovered ? 'square' : animatedEyes;
  const animatedVisualStyle = {
    '--droid-speech-level': displayedSpeechLevel.toFixed(3),
    transform: animateBodyMotion ? getDroidSpeechTransform(displayedSpeechLevel * 0.45) : undefined,
  } as React.CSSProperties;

  return (
    <motion.span
      className={cn('flex h-full w-full items-center justify-center overflow-visible', className)}
      layoutId={layoutId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={animatedVisualStyle}
      transition={layoutTransition}
    >
      <TeammateCreature
        className={cn('h-full w-full', creatureClassName)}
        color={color}
        eyes={displayedCreatureEyes}
        label={label}
        mood={mood}
        mouthShape={displayedMouthShape}
        shape={shape}
      />
    </motion.span>
  );
}
