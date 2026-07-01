'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { useResolvedStorageUrl } from '@/hooks/Common/useResolvedStorageUrl';
import {
  assistantProfilePhotoSrc,
  contactIsAssistantSelf,
  contactIsBoss,
} from '@/utils/assistants/contactAvatar';
import { cn } from '@/lib/utils';
import type { Assistant } from '@/types/assistants/assistant';

interface ContactAvatarProps {
  assistant: Assistant;
  contactId: number | null | undefined;
  displayName: string;
  initials: string;
  toneColor: string;
  className?: string;
  textClassName?: string;
  shape?: 'rounded' | 'circle';
}

/**
 * Avatar for a Contacts/Transcripts row keyed by Orchestra contact id.
 * Resolves the assistant self photo, the owning user's photo, or initials.
 */
export function ContactAvatar({
  assistant,
  contactId,
  displayName,
  initials,
  toneColor,
  className,
  textClassName,
  shape = 'rounded',
}: ContactAvatarProps) {
  const isSelf = contactIsAssistantSelf(assistant, contactId);
  const isBoss = contactIsBoss(assistant, contactId);
  const rawAssistantPhoto = isSelf ? assistantProfilePhotoSrc(assistant) : null;
  const creatureAppearance = rawAssistantPhoto ? parseCreatureSentinel(rawAssistantPhoto) : null;
  const resolvedAssistantPhoto = useResolvedStorageUrl(
    isSelf && !creatureAppearance ? rawAssistantPhoto : null
  );
  const resolvedUserPhoto = useResolvedStorageUrl(isBoss ? assistant.userImage : null);
  const roundedClass = shape === 'circle' ? 'rounded-full' : 'rounded-[9px]';

  if (isSelf && assistant.isCoordinator) {
    return (
      <CoordinatorLogoAvatar
        className={cn('shrink-0 overflow-hidden', roundedClass, className)}
        logoClassName="h-full w-full"
      />
    );
  }

  if (isSelf && creatureAppearance) {
    return (
      <CreatureAvatar
        appearance={rawAssistantPhoto!}
        className={cn('shrink-0', roundedClass, className)}
        label={displayName}
      />
    );
  }

  const photoSrc = isSelf ? resolvedAssistantPhoto : isBoss ? resolvedUserPhoto : null;
  if (photoSrc) {
    return (
      <Avatar className={cn('shrink-0', roundedClass, className)}>
        <AvatarImage
          src={photoSrc}
          alt={displayName}
          className={cn('object-cover', roundedClass)}
        />
        <AvatarFallback className={cn('font-display font-semibold', textClassName, roundedClass)}>
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center font-display font-semibold text-primary-foreground',
        roundedClass,
        textClassName,
        className
      )}
      style={{ backgroundColor: toneColor }}
    >
      {initials}
    </span>
  );
}
