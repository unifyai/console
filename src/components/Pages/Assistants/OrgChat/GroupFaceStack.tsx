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
  maxVisible?: number;
  className?: string;
  sizeClassName?: string;
}

/** Overlapping avatar stack used for chat-group rows and switcher faces. */
export function GroupFaceStack({
  members,
  maxVisible = 3,
  className,
  sizeClassName = 'h-7 w-7',
}: GroupFaceStackProps) {
  const visible = members.slice(0, maxVisible);
  const overflow = Math.max(0, members.length - visible.length);

  if (visible.length === 0) {
    return (
      <Avatar className={cn('rounded-control shrink-0', sizeClassName, className)}>
        <AvatarFallback className="rounded-control bg-muted text-[10px] font-semibold text-muted-foreground">
          G
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <div className={cn('flex shrink-0 items-center', className)} aria-hidden="true">
      {visible.map((member, index) => (
        <Avatar
          key={member.id}
          className={cn(
            'rounded-control border-2 border-background',
            sizeClassName,
            index > 0 && '-ml-2'
          )}
          style={{ zIndex: visible.length - index }}
        >
          {member.image ? <AvatarImage src={member.image} alt={member.name} /> : null}
          <AvatarFallback
            className="rounded-control text-[10px] font-semibold text-primary-foreground"
            style={{ backgroundColor: profileAvatarTone(member.name) }}
          >
            {profileInitials(member.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            'rounded-control -ml-2 flex items-center justify-center border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground',
            sizeClassName
          )}
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
