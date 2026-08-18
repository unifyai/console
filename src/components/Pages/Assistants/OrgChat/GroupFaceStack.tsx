'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
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
  className?: string;
  sizeClassName?: string;
}

function FaceCell({ member, className }: { member: GroupFaceStackMember; className?: string }) {
  return (
    <div className={cn('relative min-h-0 min-w-0 overflow-hidden bg-muted', className)}>
      {member.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed profile URLs; matches AvatarImage
        <img src={member.image} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-[length:max(5px,28cqw)] font-semibold leading-none text-primary-foreground"
          style={{ backgroundColor: profileAvatarTone(member.name) }}
        >
          {profileInitials(member.name)}
        </div>
      )}
    </div>
  );
}

function EmptyCell({ className }: { className?: string }) {
  return <div className={cn('min-h-0 min-w-0 bg-muted', className)} />;
}

/** Fixed-size 2×2 face collage for chat-group rows and switcher faces. */
export function GroupFaceStack({
  members,
  icon = null,
  className,
  sizeClassName = 'h-7 w-7',
}: GroupFaceStackProps) {
  if (icon) {
    return (
      <div
        className={cn(
          '@container rounded-control flex shrink-0 items-center justify-center bg-muted',
          sizeClassName,
          className
        )}
        aria-hidden="true"
      >
        <span className="text-[length:max(11px,58cqw)] leading-none">{icon}</span>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <Avatar className={cn('rounded-control shrink-0', sizeClassName, className)}>
        <AvatarFallback className="rounded-control bg-muted text-[10px] font-semibold text-muted-foreground">
          G
        </AvatarFallback>
      </Avatar>
    );
  }

  if (members.length === 1) {
    const member = members[0];
    return (
      <Avatar className={cn('rounded-control shrink-0', sizeClassName, className)}>
        {member.image ? <AvatarImage src={member.image} alt={member.name} /> : null}
        <AvatarFallback
          className="rounded-control text-[10px] font-semibold text-primary-foreground"
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
        '@container rounded-control grid shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-border',
        sizeClassName,
        className
      )}
      aria-hidden="true"
    >
      {faces[0] ? (
        <FaceCell member={faces[0]} className="col-start-1 row-start-1" />
      ) : (
        <EmptyCell className="col-start-1 row-start-1" />
      )}
      {faces[1] ? (
        <FaceCell member={faces[1]} className="col-start-1 row-start-2" />
      ) : (
        <EmptyCell className="col-start-1 row-start-2" />
      )}
      {faces[2] ? (
        <FaceCell member={faces[2]} className="col-start-2 row-start-1" />
      ) : (
        <EmptyCell className="col-start-2 row-start-1" />
      )}
      {overflow > 0 ? (
        <div className="col-start-2 row-start-2 flex min-h-0 min-w-0 items-center justify-center bg-muted text-[length:max(5px,28cqw)] font-semibold leading-none text-muted-foreground">
          +{overflow}
        </div>
      ) : (
        <EmptyCell className="col-start-2 row-start-2" />
      )}
    </div>
  );
}
