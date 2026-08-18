'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { useProfileImageResolver } from '@/hooks/User/useProfileImageResolver';
import { cn } from '@/lib/utils';
import { profileAvatarTone, profileInitials } from '@/utils/user/profileDisplay';

export interface GroupFaceStackMember {
  id: string;
  name: string;
  image?: string | null;
}

interface GroupFaceStackProps {
  members: GroupFaceStackMember[];
  /** Emoji the group chose for itself; it stands in for the whole collage. */
  icon?: string | null;
  /** Type-ramp step for that emoji, chosen to suit `sizeClassName`. */
  iconClassName?: string;
  className?: string;
  sizeClassName?: string;
}

/**
 * A cell is a quarter of a rail tile, so it carries a single initial: two
 * letters only fit here by shrinking below the point either is readable.
 */
function faceInitial(name: string): string {
  return profileInitials(name).slice(0, 1);
}

function FaceCell({
  member,
  imageUrl,
  className,
}: {
  member: GroupFaceStackMember;
  imageUrl: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn('h-full min-h-0 w-full min-w-0 rounded-none', className)}>
      {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
      <AvatarFallback
        className="text-caption-sm rounded-none font-semibold leading-none text-primary-foreground"
        style={{ backgroundColor: profileAvatarTone(member.name) }}
      >
        {faceInitial(member.name)}
      </AvatarFallback>
    </Avatar>
  );
}

function EmptyCell({ className }: { className?: string }) {
  return <div className={cn('min-h-0 min-w-0 bg-muted', className)} />;
}

/** Fixed-size 2×2 face collage for chat-group rows and switcher faces. */
export function GroupFaceStack({
  members,
  icon = null,
  iconClassName = 'text-base',
  className,
  sizeClassName = 'h-7 w-7',
}: GroupFaceStackProps) {
  const resolveFace = useProfileImageResolver(members.map((member) => member.image));

  if (icon) {
    return (
      <div
        className={cn(
          'rounded-control flex shrink-0 items-center justify-center overflow-hidden bg-muted',
          sizeClassName,
          className
        )}
        aria-hidden="true"
      >
        <span className={cn('leading-none', iconClassName)}>{icon}</span>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <Avatar className={cn('rounded-control shrink-0', sizeClassName, className)}>
        <AvatarFallback className="text-caption-sm rounded-control bg-muted font-semibold text-muted-foreground">
          G
        </AvatarFallback>
      </Avatar>
    );
  }

  if (members.length === 1) {
    const member = members[0];
    const imageUrl = resolveFace(member.image);
    return (
      <Avatar className={cn('rounded-control shrink-0', sizeClassName, className)}>
        {imageUrl ? <AvatarImage src={imageUrl} alt={member.name} /> : null}
        <AvatarFallback
          className="text-caption-sm rounded-control font-semibold text-primary-foreground"
          style={{ backgroundColor: profileAvatarTone(member.name) }}
        >
          {profileInitials(member.name)}
        </AvatarFallback>
      </Avatar>
    );
  }

  const faces = members.slice(0, 3);
  const overflow = Math.max(0, members.length - 3);

  return (
    <div
      className={cn(
        'rounded-control grid shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-border',
        sizeClassName,
        className
      )}
      aria-hidden="true"
    >
      {faces[0] ? (
        <FaceCell
          member={faces[0]}
          imageUrl={resolveFace(faces[0].image)}
          className="col-start-1 row-start-1"
        />
      ) : (
        <EmptyCell className="col-start-1 row-start-1" />
      )}
      {faces[1] ? (
        <FaceCell
          member={faces[1]}
          imageUrl={resolveFace(faces[1].image)}
          className="col-start-1 row-start-2"
        />
      ) : (
        <EmptyCell className="col-start-1 row-start-2" />
      )}
      {faces[2] ? (
        <FaceCell
          member={faces[2]}
          imageUrl={resolveFace(faces[2].image)}
          className="col-start-2 row-start-1"
        />
      ) : (
        <EmptyCell className="col-start-2 row-start-1" />
      )}
      {overflow > 0 ? (
        <div className="text-caption-sm col-start-2 row-start-2 flex min-h-0 min-w-0 items-center justify-center bg-muted font-semibold leading-none text-muted-foreground">
          +{overflow}
        </div>
      ) : (
        <EmptyCell className="col-start-2 row-start-2" />
      )}
    </div>
  );
}
