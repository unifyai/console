import * as React from 'react';
import { cn } from '@/lib/utils';
import { TeammateCreature } from '@/components/Brand';
import type { CreatureEyes } from '@/components/Brand/TeammateCreature';

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
        className={cn('h-full w-full', logoClassName)}
        eyes={isHovered ? getHoverEyes(eyes) : eyes}
        label="Coordinator Droid"
      />
    </span>
  );
}
