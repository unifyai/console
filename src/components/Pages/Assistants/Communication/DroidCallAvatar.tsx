'use client';

import * as React from 'react';
import {
  AnimatedDroid,
  TWIN_CREATURE_APPEARANCE,
  getCreatureAccent,
  getDroidBodyForm,
} from '@droid/brand/components';
import type { BrandRole } from '@/components/Brand/shapes';
import type { DroidBody, DroidOutfit } from '@/components/Brand/droidAppearance';
import type {
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
  antenna?: CreatureAntenna;
  body?: DroidBody;
  color?: BrandRole;
  baseEyes?: CreatureEyes;
  outfit?: DroidOutfit;
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
  antenna = TWIN_CREATURE_APPEARANCE.antenna,
  body = 'standard',
  color = 'green',
  baseEyes = 'up',
  outfit = 'none',
  label = 'T-W1N',
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
      form={getDroidBodyForm(body)}
      emotion={mood}
      isSpeaking={isSpeaking}
      isUserSpeaking={isUserSpeaking}
      restingEyes={isHovered ? 'square' : baseEyes}
      stableBox
      speechLevel={displayedSpeechLevel}
      mouthShape={displayedMouthShape}
      skin={outfit}
    />
  );

  return (
    <span
      className={cn('flex h-full w-full items-center justify-center overflow-visible', className)}
      aria-label={label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="img"
      style={animatedVisualStyle}
    >
      {teleportInOnMount ? (
        <DroidTeleportFizzle mode="in" className="flex h-full w-full items-center justify-center">
          {droid}
        </DroidTeleportFizzle>
      ) : (
        droid
      )}
    </span>
  );
}
