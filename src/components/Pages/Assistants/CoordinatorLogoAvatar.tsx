import { cn } from '@/lib/utils';
import { TeammateCreature } from '@/components/Brand';

interface CoordinatorLogoAvatarProps {
  className?: string;
  logoClassName?: string;
}

export function CoordinatorLogoAvatar({ className, logoClassName }: CoordinatorLogoAvatarProps) {
  return (
    <span
      data-testid="coordinator-logo-avatar"
      className={cn('flex items-center justify-center overflow-visible', className)}
    >
      <TeammateCreature className={cn('h-full w-full', logoClassName)} label="Unity" />
    </span>
  );
}
