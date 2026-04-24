import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Button } from '@/components/UI/button';
import { Mail, Phone, Copy, Check, PenLine } from 'lucide-react';
import { WhatsApp } from '@mui/icons-material';
import { FaDiscord } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';

export interface AssistantInfoSidePanelContentProps {
  assistant: Assistant;
  onEditProfile?: (assistant: Assistant) => void;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  className?: string;
}

/**
 * Body of the chat-tab assistant info side panel. Lays out an
 * Avatar / identity header followed by two sectioned blocks ("Profile"
 * and "Contacts"), each with an inline edit affordance. The panel itself
 * (border, mobile-overlay behavior, Escape-to-close) is owned by
 * `ChatSidePanel`; this component only supplies the content.
 *
 * This is the single source of truth for displaying assistant identity
 * + contacts in the assistants page — the previous list-item hover card
 * was removed once this panel landed, since the info button on the chat
 * sub-header gives users a more deliberate way to surface the same data.
 */
export function AssistantInfoSidePanelContent({
  assistant,
  onEditProfile,
  onOpenContactManager,
  className,
}: AssistantInfoSidePanelContentProps) {
  const [isIdCopied, setIsIdCopied] = React.useState(false);

  const displayName = `${assistant.firstName} ${assistant.surname}`;
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto || undefined;
  const supervisorName = [assistant.userFirstName, assistant.userLastName]
    .filter(Boolean)
    .join(' ');

  const copyId = () => {
    navigator.clipboard.writeText(assistant.agentId);
    setIsIdCopied(true);
    setTimeout(() => setIsIdCopied(false), 2000);
  };

  return (
    <ScrollArea className={cn('flex-1', className)}>
      <div className="flex flex-col gap-5 px-4 py-4">
        <IdentityHeader
          name={displayName}
          photoSrc={photoSrc}
          initials={`${assistant.firstName?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
          supervisorName={supervisorName}
          isIdCopied={isIdCopied}
          onCopyId={copyId}
        />

        <Section
          title="Profile"
          editLabel="Edit profile"
          onEdit={onEditProfile ? () => onEditProfile(assistant) : undefined}
          editTestId="assistant-info-edit-profile"
        >
          {assistant.jobTitle && (
            <Field label="Job Title" value={assistant.jobTitle} testId="assistant-info-job-title" />
          )}
          <Field label="About" value={assistant.about} multiline />
        </Section>

        <Section
          title="Contacts"
          editLabel="Manage contact details"
          onEdit={() => onOpenContactManager(assistant)}
          editTestId="assistant-info-manage-contacts"
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <ContactRow
              icon={<Phone className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Phone"
              value={assistant.phone}
              onAdd={() => onOpenContactManager(assistant, 'phone')}
            />
            <ContactRow
              icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Email"
              value={assistant.email}
              renderValue={(v) => (
                <a href={`mailto:${v}`} className="text-link min-w-0 truncate">
                  {v}
                </a>
              )}
              onAdd={() => onOpenContactManager(assistant, 'email')}
            />
            <ContactRow
              icon={<WhatsApp sx={{ fontSize: '14px', flexShrink: 0 }} aria-hidden="true" />}
              label="WhatsApp"
              value={assistant.assistantWhatsappNumber}
              onAdd={() => onOpenContactManager(assistant, 'whatsapp')}
            />
            <ContactRow
              icon={<FaDiscord className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Discord"
              value={assistant.assistantDiscordBotId}
              onAdd={() => onOpenContactManager(assistant, 'discord')}
            />
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// Internal building blocks
// ---------------------------------------------------------------------------

interface IdentityHeaderProps {
  name: string;
  photoSrc: string | undefined;
  initials: string;
  supervisorName: string;
  isIdCopied: boolean;
  onCopyId: () => void;
}

function IdentityHeader({
  name,
  photoSrc,
  initials,
  supervisorName,
  isIdCopied,
  onCopyId,
}: IdentityHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-14 w-14 flex-shrink-0 rounded-md">
        <AvatarImage src={photoSrc} alt={name} className="rounded-md" />
        <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-title truncate" data-testid="assistant-info-name">
          {name}
        </div>
        {supervisorName && (
          <div className="text-caption truncate text-muted-foreground">
            <span className="opacity-70">Supervisor: </span>
            <span>{supervisorName}</span>
          </div>
        )}
        <button
          type="button"
          onClick={onCopyId}
          className="group/id text-caption flex min-w-0 cursor-pointer items-center gap-1 text-muted-foreground"
          data-testid="assistant-info-copy-id"
          aria-label="Copy assistant ID"
        >
          <span className="opacity-70">Assistant ID</span>
          {isIdCopied ? (
            <Check className="h-3 w-3 flex-shrink-0 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 flex-shrink-0 opacity-70 transition-opacity group-hover/id:opacity-100" />
          )}
        </button>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  editLabel: string;
  onEdit?: () => void;
  editTestId?: string;
  children: React.ReactNode;
}

function Section({ title, editLabel, onEdit, editTestId, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between border-b pb-1.5">
        <h3 className="text-label text-semibold">{title}</h3>
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-caption -mr-2 h-7 gap-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            data-testid={editTestId}
            aria-label={editLabel}
          >
            <PenLine className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
  testId?: string;
}

function Field({ label, value, multiline = false, testId }: FieldProps) {
  const isEmpty = !value || value.trim() === '';
  return (
    <div className="flex flex-col gap-0.5" data-testid={testId}>
      <div className="text-caption text-muted-foreground">{label}</div>
      <div
        className={cn(
          'text-sm',
          multiline ? 'whitespace-pre-wrap' : 'truncate',
          isEmpty && 'text-muted-foreground/60 italic'
        )}
      >
        {isEmpty ? 'Not set' : value}
      </div>
    </div>
  );
}

interface ContactRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  /** Custom renderer for the populated value (e.g. mailto link). */
  renderValue?: (value: string) => React.ReactNode;
  onAdd: () => void;
}

function ContactRow({ icon, label, value, renderValue, onAdd }: ContactRowProps) {
  const isSet = !!value && value.trim() !== '';
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      {isSet ? (
        renderValue ? (
          renderValue(value as string)
        ) : (
          <span className="min-w-0 truncate">{value}</span>
        )
      ) : (
        <Button
          type="button"
          variant="link"
          className="text-link h-auto p-0 text-sm font-normal"
          onClick={onAdd}
        >
          Add {label.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
