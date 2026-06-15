'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { AnimatedDroid, getCreatureAccent, getCreatureForm } from '@droid/brand/components';
import type { BrandRole, CreatureShape } from '@/components/Brand/shapes';
import type {
  BotSkin,
  CreatureAntenna,
  CreatureEyes,
  CreatureMood,
  CreatureMouthShape,
} from '@/components/Brand/TeammateCreature';
import { cn } from '@/lib/utils';
import { clampDroidSpeechLevel } from '@/utils/assistants/droid-animation';
import { DroidTeleportFizzle } from '@/components/Pages/Assistants/Communication/DroidTeleportFizzle';

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
  skin?: BotSkin;
  label?: string;
  /** When true the droid rests in an isometric 3/4 view and turns to camera while the call is active. */
  isometricRest?: boolean;
  /** Fade in once when the avatar first mounts. Set by the coordinator
   *  onboarding handoff so the docked droid reappears after the intro fade-out. */
  teleportInOnMount?: boolean;
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
  skin,
  label = 'Marty',
  isometricRest = false,
  teleportInOnMount = false,
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

  const droid = (
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
      skin={skin}
    />
  );

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
      {teleportInOnMount ? (
        <DroidTeleportFizzle mode="in" className="flex h-full w-full items-center justify-center">
          {droid}
        </DroidTeleportFizzle>
      ) : (
        droid
      )}
    </motion.span>
  );
}
