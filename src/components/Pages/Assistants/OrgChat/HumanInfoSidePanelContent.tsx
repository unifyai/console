'use client';

import * as React from 'react';
import { Clock, Mail, Phone, X } from 'lucide-react';
import { WhatsApp } from '@mui/icons-material';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Button } from '@/components/UI/button';
import { useResolvedProfileImage } from '@/hooks/User/useProfileImageResolver';
import { ScrollArea } from '@/components/UI/scroll-area';
import type { RosterHuman } from '@/types/orgChat';
import { profileAvatarTone, profileInitials } from '@/utils/user/profileDisplay';
import { PresenceStatusDot } from '@/components/Pages/Assistants/Common/PresenceStatusDot';

interface HumanInfoSidePanelContentProps {
  human: RosterHuman;
  onClose: () => void;
  hideHeaderActions?: boolean;
  className?: string;
}

function formatLastSeen(lastSeenAt: string | null): string | null {
  if (!lastSeenAt) return null;
  const date = new Date(lastSeenAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-caption text-muted-foreground">{label}</div>
        <div className="text-body truncate text-foreground">{trimmed}</div>
      </div>
    </div>
  );
}

/** Read-only profile side panel for a human org member. */
export function HumanInfoSidePanelContent({
  human,
  onClose,
  hideHeaderActions = false,
  className,
}: HumanInfoSidePanelContentProps) {
  const displayName = human.name?.trim() || human.email || 'Team member';
  const imageUrl = useResolvedProfileImage(human.image);
  const bio = human.bio?.trim() || null;
  const jobTitle = human.jobTitle?.trim() || null;
  const lastSeenLabel = formatLastSeen(human.lastSeenAt);
  const presenceLabel = human.online
    ? 'Online'
    : lastSeenLabel
      ? `Last seen ${lastSeenLabel}`
      : 'Offline';
  const contactRows = [
    { icon: <Mail className="h-3.5 w-3.5" />, label: 'Email', value: human.email },
    { icon: <Phone className="h-3.5 w-3.5" />, label: 'Phone', value: human.phoneNumber },
    {
      icon: <WhatsApp sx={{ fontSize: '14px' }} />,
      label: 'WhatsApp',
      value: human.whatsappNumber,
    },
    { icon: <Clock className="h-3.5 w-3.5" />, label: 'Timezone', value: human.timezone },
  ].filter((row) => Boolean(row.value?.trim()));

  return (
    <ScrollArea className={cn('flex-1', className)} data-testid="human-info-panel">
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <Avatar className="h-14 w-14 rounded-md">
              <AvatarImage src={imageUrl ?? undefined} alt={displayName} className="rounded-md" />
              <AvatarFallback
                className="text-semibold rounded-md text-primary-foreground"
                style={{ backgroundColor: profileAvatarTone(displayName) }}
              >
                {profileInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <PresenceStatusDot online={human.online} className="h-3 w-3" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-title truncate" data-testid="human-info-name">
              {displayName}
            </div>
            {jobTitle ? (
              <div className="text-caption truncate text-muted-foreground">{jobTitle}</div>
            ) : null}
            {human.roleName ? (
              <div className="text-caption truncate text-muted-foreground">{human.roleName}</div>
            ) : null}
            <div className="text-caption text-muted-foreground">{presenceLabel}</div>
          </div>
          {!hideHeaderActions && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              aria-label="Close profile"
              data-testid="human-info-close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {bio ? (
          <section className="space-y-1">
            <h3 className="text-label text-semibold">About</h3>
            <p className="text-body whitespace-pre-wrap text-muted-foreground">{bio}</p>
          </section>
        ) : null}

        {contactRows.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-label text-semibold">Contact</h3>
            <div className="flex flex-col gap-3">
              {contactRows.map((row) => (
                <DetailRow key={row.label} icon={row.icon} label={row.label} value={row.value} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}
