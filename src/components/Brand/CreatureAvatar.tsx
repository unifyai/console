import * as React from 'react';
import { cn } from '@/lib/utils';
import { TeammateCreature } from './TeammateCreature';
import { parseCreatureSentinel, type CreatureAppearance } from './creatureAppearance';

interface CreatureAvatarProps {
  /** A parsed appearance, or a raw `appearance://` sentinel string. */
  appearance: CreatureAppearance | string;
  className?: string;
  /** Inner creature sizing; defaults to filling most of the box. */
  creatureClassName?: string;
  label?: string;
}

/**
 * Renders a droid avatar from an appearance descriptor (or a
 * `appearance://` sentinel string) on a neutral, rounded backdrop so it sits
 * consistently wherever assistant photos appear.
 */
export function CreatureAvatar({
  appearance,
  className,
  creatureClassName,
  label,
}: CreatureAvatarProps) {
  const resolved = typeof appearance === 'string' ? parseCreatureSentinel(appearance) : appearance;
  if (!resolved) return null;

  return (
    <span
      className={cn(
        'flex h-full w-full items-center justify-center overflow-hidden bg-muted',
        className
      )}
    >
      <TeammateCreature
        className={cn('h-[72%] w-[72%]', creatureClassName)}
        antenna={resolved.antenna}
        shape={resolved.shape}
        color={resolved.color}
        eyes={resolved.eyes}
        label={label}
      />
    </span>
  );
}
