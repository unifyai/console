'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { TeammateCreature } from '@/components/Brand';
import type { CreatureEyes, CreatureMouthShape } from '@/components/Brand/TeammateCreature';
import { cn } from '@/lib/utils';
import { useMartianEyeExpression } from '@/hooks/Assistants/useMartianEyeExpression';
import {
  clampMartianSpeechLevel,
  getMartianSpeechTransform,
} from '@/utils/assistants/martian-animation';

interface MartyCallAvatarProps {
  isSpeaking: boolean;
  isCallActive?: boolean;
  isUserSpeaking?: boolean;
  animateBodyMotion?: boolean;
  mouthShape?: CreatureMouthShape;
  speechLevel?: number;
  className?: string;
  creatureClassName?: string;
  layoutId?: string;
  layoutTransition?: Transition;
}

export function MartyCallAvatar({
  isSpeaking,
  isCallActive = false,
  isUserSpeaking = false,
  animateBodyMotion = true,
  mouthShape,
  speechLevel,
  className,
  creatureClassName,
  layoutId,
  layoutTransition,
}: MartyCallAvatarProps) {
  const baseEyes = 'up' satisfies CreatureEyes;
  const [isHovered, setIsHovered] = React.useState(false);
  const displayedSpeechLevel = clampMartianSpeechLevel(speechLevel ?? 0);
  const displayedMouthShape =
    mouthShape ?? (displayedSpeechLevel > 0.08 && isSpeaking ? 'narrow' : 'closed');
  const animatedEyes = useMartianEyeExpression({
    baseEyes,
    isCallActive,
    isSpeaking,
    isUserSpeaking,
    speechLevel: displayedSpeechLevel,
  });
  const displayedCreatureEyes = isHovered ? 'square' : animatedEyes;
  const animatedVisualStyle = {
    '--martian-speech-level': displayedSpeechLevel.toFixed(3),
    transform: animateBodyMotion
      ? getMartianSpeechTransform(displayedSpeechLevel * 0.45)
      : undefined,
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
        eyes={displayedCreatureEyes}
        label="Marty"
        mouthShape={displayedMouthShape}
      />
    </motion.span>
  );
}
