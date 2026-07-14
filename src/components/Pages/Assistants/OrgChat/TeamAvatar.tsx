'use client';

import * as React from 'react';
import { Building2, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { profileAvatarTone, profileInitials } from '@/utils/user/profileDisplay';

export interface TeamAvatarProps {
  name: string;
  imageUrl?: string | null;
  /** Managed org-wide team — fixed building icon, never initials or a custom photo. */
  isOrgWideSharing?: boolean;
  className?: string;
  iconClassName?: string;
}

function useResolvedImageUrl(imageUrl: string | null | undefined): string | null {
  const [resolved, setResolved] = React.useState<string | null>(() => {
    if (!imageUrl) return null;
    return imageUrl.startsWith('gs://') ? null : imageUrl;
  });

  React.useEffect(() => {
    if (!imageUrl) {
      setResolved(null);
      return;
    }
    if (!imageUrl.startsWith('gs://')) {
      setResolved(imageUrl);
      return;
    }
    let cancelled = false;
    fetch('/api/storage/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      body: JSON.stringify({ gs_url: imageUrl }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setResolved(data.signed_url ?? null);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return resolved;
}

/**
 * Team face used in the selector, roster rows, and Teams settings table.
 * Org (managed) teams always render a building glyph; other teams use a
 * photo when present, otherwise brand-colored initials.
 */
export function TeamAvatar({
  name,
  imageUrl,
  isOrgWideSharing = false,
  className,
  iconClassName = 'h-4 w-4',
}: TeamAvatarProps) {
  const resolvedImageUrl = useResolvedImageUrl(isOrgWideSharing ? null : imageUrl);

  if (isOrgWideSharing) {
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

  const displayName = name.trim() || 'Team';
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
