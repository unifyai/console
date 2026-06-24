import * as React from 'react';
import { cn } from '@/lib/utils';
import { TeammateCreature } from '@/components/Brand';
import type { CreatureEyes } from '@/components/Brand/TeammateCreature';
import { TWIN_CREATURE_APPEARANCE } from '@droid/brand/components';

interface CoordinatorLogoAvatarProps {
  className?: string;
  logoClassName?: string;
  eyes?: CreatureEyes;
}

function getHoverEyes(eyes: CreatureEyes): CreatureEyes {
  return eyes === 'square' ? 'up' : 'square';
}

export function CoordinatorLogoAvatar({
  className,
  logoClassName,
  eyes = 'up',
}: CoordinatorLogoAvatarProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <span
      data-testid="coordinator-logo-avatar"
      className={cn('flex items-center justify-center overflow-visible', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <TeammateCreature
        antenna={TWIN_CREATURE_APPEARANCE.antenna}
        className={cn('h-full w-full', logoClassName)}
        eyes={isHovered ? getHoverEyes(eyes) : eyes}
        label="T-W1N"
      />
    </span>
  );
}
