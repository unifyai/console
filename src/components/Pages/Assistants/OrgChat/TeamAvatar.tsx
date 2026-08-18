'use client';

import * as React from 'react';
import { Building2, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { useResolvedProfileImage } from '@/hooks/User/useProfileImageResolver';
import { profileAvatarTone, profileInitials } from '@/utils/user/profileDisplay';

export interface TeamAvatarProps {
  name: string;
  imageUrl?: string | null;
  /** Managed org-wide team — building icon fallback when no org/team photo. */
  isOrgWideSharing?: boolean;
  className?: string;
  iconClassName?: string;
}

/**
 * Team face used in the selector, roster rows, and Teams settings table.
 * Org (managed) teams use the organization profile photo when present,
 * otherwise a building glyph. Other teams use a photo when present,
 * otherwise brand-colored initials.
 */
export function TeamAvatar({
  name,
  imageUrl,
  isOrgWideSharing = false,
  className,
  iconClassName = 'h-4 w-4',
}: TeamAvatarProps) {
  const resolvedImageUrl = useResolvedProfileImage(imageUrl);
  const displayName = name.trim() || (isOrgWideSharing ? 'Organization' : 'Team');

  if (isOrgWideSharing) {
    if (resolvedImageUrl) {
      return (
        <Avatar className={cn('rounded-control shrink-0', className)} data-testid="org-team-avatar">
          <AvatarImage src={resolvedImageUrl} alt={displayName} className="rounded-control" />
          <AvatarFallback className="rounded-control flex items-center justify-center border border-border bg-muted text-muted-foreground">
            <Building2 className={iconClassName} aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
      );
    }
    return (
      <span
        className={cn(
          'rounded-control flex shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground',
          className
        )}
        aria-hidden="true"
        data-testid="org-team-avatar"
      >
        <Building2 className={iconClassName} />
      </span>
    );
  }

  return (
    <Avatar className={cn('rounded-control shrink-0', className)}>
      {resolvedImageUrl ? (
        <AvatarImage src={resolvedImageUrl} alt={displayName} className="rounded-control" />
      ) : null}
      <AvatarFallback
        className="rounded-control text-semibold text-primary-foreground"
        style={{ backgroundColor: profileAvatarTone(displayName) }}
      >
        {profileInitials(displayName) || <UsersRound className={iconClassName} />}
      </AvatarFallback>
    </Avatar>
  );
}
