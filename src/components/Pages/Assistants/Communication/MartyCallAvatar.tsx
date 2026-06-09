'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { TeammateCreature } from '@/components/Brand';
import type { CreatureEyes } from '@/components/Brand/TeammateCreature';
import { cn } from '@/lib/utils';
import {
  clampMartianSpeechLevel,
  getMartianSpeechTransform,
  getSpeakingEyes,
} from '@/utils/assistants/martian-animation';

interface MartyCallAvatarProps {
  isSpeaking: boolean;
  isCallActive?: boolean;
  isUserSpeaking?: boolean;
  animateBodyMotion?: boolean;
  speechLevel?: number;
  className?: string;
  creatureClassName?: string;
  layoutId?: string;
}

export function MartyCallAvatar({
  isSpeaking,
  isCallActive = false,
  isUserSpeaking = false,
  animateBodyMotion = true,
  speechLevel,
  className,
  creatureClassName,
  layoutId,
}: MartyCallAvatarProps) {
  const baseEyes = 'up' satisfies CreatureEyes;
  const [eyeFrame, setEyeFrame] = React.useState(0);
  const [animatedSpeechLevel, setAnimatedSpeechLevel] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const displayedSpeechLevel =
    speechLevel === undefined ? animatedSpeechLevel : clampMartianSpeechLevel(speechLevel);
  const shouldAnimateCreatureEyes = isSpeaking;
  const displayedCreatureEyes = isHovered
    ? 'square'
    : shouldAnimateCreatureEyes
      ? getSpeakingEyes(baseEyes, eyeFrame)
      : isCallActive || isUserSpeaking
        ? 'square'
        : baseEyes;
  const animatedVisualStyle = {
    '--martian-speech-level': displayedSpeechLevel.toFixed(3),
    transform: animateBodyMotion ? getMartianSpeechTransform(displayedSpeechLevel) : undefined,
  } as React.CSSProperties;

  React.useEffect(() => {
    if (!shouldAnimateCreatureEyes) {
      setEyeFrame(0);
      return;
    }

    const eyeTimer = window.setInterval(() => {
      setEyeFrame((current) => (current + 1) % 4);
    }, 2000);

    return () => window.clearInterval(eyeTimer);
  }, [shouldAnimateCreatureEyes]);

  React.useEffect(() => {
    if (speechLevel !== undefined) return;

    if (!isSpeaking) {
      setAnimatedSpeechLevel(0);
      return;
    }

    let frame = 0;
    setAnimatedSpeechLevel(0.65);
    const speechTimer = window.setInterval(() => {
      frame += 1;
      setAnimatedSpeechLevel(
        clampMartianSpeechLevel(0.24 + Math.abs(Math.sin(frame * 0.82)) * 0.76)
      );
    }, 80);

    return () => window.clearInterval(speechTimer);
  }, [isSpeaking, speechLevel]);

  return (
    <motion.span
      className={cn('flex h-full w-full items-center justify-center overflow-visible', className)}
      layoutId={layoutId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={animatedVisualStyle}
    >
      <TeammateCreature
        className={cn('h-full w-full', creatureClassName)}
        eyes={displayedCreatureEyes}
        label="Marty"
      />
    </motion.span>
  );
}
