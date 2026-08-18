'use client';

import * as React from 'react';
import { Building2, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { fetchProfileSignedUrls, readProfileSignedUrls } from '@/lib/client/profileMedia';
import { profileAvatarTone, profileInitials } from '@/utils/user/profileDisplay';

export interface TeamAvatarProps {
  name: string;
  imageUrl?: string | null;
  /** Managed org-wide team — building icon fallback when no org/team photo. */
  isOrgWideSharing?: boolean;
  className?: string;
  iconClassName?: string;
}

/** Cached signed URL, or the URL itself when it needs no signing. */
function readResolvedImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (!imageUrl.startsWith('gs://')) return imageUrl;
  return readProfileSignedUrls([imageUrl])[imageUrl] ?? null;
}

/**
 * Faces are pre-resolved in bulk when the roster loads, so the cache read in
 * the state initialiser almost always hits and the avatar paints on its first
 * frame. The fetch below is the cold path — a team whose photo changed since
 * the last roster poll, or an avatar rendered outside a roster surface.
 */
function useResolvedImageUrl(imageUrl: string | null | undefined): string | null {
  const [resolved, setResolved] = React.useState<string | null>(() =>
    readResolvedImageUrl(imageUrl)
  );

  React.useEffect(() => {
    const cached = readResolvedImageUrl(imageUrl);
    setResolved(cached);
    if (cached || !imageUrl) return;

    let cancelled = false;
    fetchProfileSignedUrls([imageUrl]).then((signedUrls) => {
      if (!cancelled) setResolved(signedUrls[imageUrl] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return resolved;
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
  const resolvedImageUrl = useResolvedImageUrl(imageUrl);
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
