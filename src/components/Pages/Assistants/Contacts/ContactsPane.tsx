'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Plus, Shield, Mail, Clock, Pencil } from 'lucide-react';
// TODO(wire-backend): MessageCircle + toast are only used by the unwired
// "Message" contact action below; restore with it.
// import { MessageCircle } from 'lucide-react';
// import { toast } from 'sonner';
import { Button } from '@/components/UI/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/UI/sheet';
import { ScrollArea } from '@/components/UI/scroll-area';
import { cn } from '@/lib/utils';
import { useBrainData } from '@/hooks/Assistants/useBrainData';
import { useTabSearchCommit } from '@/hooks/Assistants/useTabSearchCommit';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import { TabToolbar } from '../Common/TabToolbar';
import { useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { BrainScopeDropdown } from '../Common/BrainScopeDropdown';
import { TabFilterDropdown } from '../Common/TabFilterDropdown';
import { TabFooter } from '../Common/TabFooter';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import {
  mapContactRow,
  filterContacts,
  collectContactTags,
  contactAvatarTone,
  type ContactCard,
} from '@/utils/assistants/contacts';
import { ContactAvatar } from '../Common/ContactAvatar';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContextRoot } from '@/lib/assistants/scope';

interface ContactsPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Opens the channel-identity provisioning dialog (the live "Contacts" action). */
  onManageContacts?: () => void;
  /** Scope override: a team root reads `Teams/{id}/…` instead of merging the
   *  assistant's readable roots. */
  root?: ContextRoot | null;
  enabled?: boolean;
}

function RespondDot({ on }: { on: boolean }) {
  return (
    <span
      title={on ? 'Auto-responds' : 'Does not auto-respond'}
      className={cn('h-2 w-2 shrink-0 rounded-full', on ? 'bg-primary' : 'bg-muted-foreground/40')}
    />
  );
}

function ContactCardAvatar({
  card,
  assistant,
  size = 'sm',
}: {
  card: ContactCard;
  assistant: Assistant;
  size?: 'sm' | 'lg';
}) {
  return (
    <ContactAvatar
      assistant={assistant}
      contactId={card.contactId}
      displayName={card.fullName}
      initials={card.initials}
      toneColor={contactAvatarTone(card.contactId, card.fullName)}
      className={size === 'lg' ? 'h-12 w-12' : 'h-9 w-9'}
      textClassName={size === 'lg' ? 'text-base' : 'text-[13px]'}
    />
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function ContactDetail({ card }: { card: ContactCard }) {
  const grid: Array<[string, string, boolean]> = [
    ['Email', card.email, false],
    ['Phone', card.phone, true],
    ['WhatsApp', card.whatsapp, true],
    ['Timezone', card.timezone, false],
    ['Discord', card.discord, true],
    ['Slack ID', card.slack, true],
  ];
  return (
    <div className="space-y-4 pr-4" data-testid="contact-detail-body">
      {card.bio && (
        <DetailField label="Bio">
          <p className="text-body whitespace-pre-wrap">{card.bio}</p>
        </DetailField>
      )}

      <div className="grid grid-cols-2 gap-4">
        {grid.map(([label, value, mono]) => (
          <DetailField key={label} label={label}>
            {value ? (
              <span className={cn('break-all', mono && 'text-code-sm')}>{value}</span>
            ) : (
              <span className="text-caption">—</span>
            )}
          </DetailField>
        ))}
      </div>

      <DetailField label="Should respond">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
            card.shouldRespond
              ? 'bg-primary-tint-10 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <RespondDot on={card.shouldRespond} />
          {card.shouldRespond ? 'Yes' : 'No'}
        </span>
      </DetailField>

      {card.responsePolicy && (
        <DetailField label="Response policy">
          <p className="text-body whitespace-pre-wrap">{card.responsePolicy}</p>
        </DetailField>
      )}

      {card.rollingSummary && (
        <DetailField label="Rolling summary">
          <p className="text-body whitespace-pre-wrap">{card.rollingSummary}</p>
        </DetailField>
      )}

      {card.tags.length > 0 && (
        <DetailField label="Tags">
          <div className="flex flex-wrap gap-1.5">
            {card.tags.map((t) => (
              <span
                key={t}
                className="bg-muted/40 text-caption rounded-md border px-2 py-0.5 text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </DetailField>
      )}
    </div>
  );
}

export function ContactsPane({
  assistant,
  ownerId,
  assistantId,
  onManageContacts,
  root = null,
  enabled = true,
}: ContactsPaneProps) {
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root });
  const { contacts, hasLoaded, isLoading, error, refetch } = useBrainData({
    assistant,
    ownerId,
    assistantId,
    root: scope.root,
    contexts: ['Contacts'] as const,
    initialContext: 'Contacts',
    enabled,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    draft: searchDraft,
    setDraft: setSearchDraft,
    committed: searchQuery,
    submit: submitSearch,
    clear: clearSearch,
  } = useTabSearchCommit();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<ContactCard | null>(null);

  const cards = useMemo(() => contacts.rows.map(mapContactRow), [contacts.rows]);
  const allTags = useMemo(() => collectContactTags(cards), [cards]);
  const selectedTags = useMemo(
    () => Array.from(selectedKeys).map((k) => k.slice(k.indexOf(':') + 1)),
    [selectedKeys]
  );
  const filtered = useMemo(
    () => filterContacts(cards, searchQuery, selectedTags),
    [cards, searchQuery, selectedTags]
  );

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // TODO(wire-backend): Message / Email contact actions are not wired to any
  // backend (this only toasts). Restore once outbound messaging/email
  // dispatch endpoints are available.
  // const notifyChatOnly = useCallback((label: string) => {
  //   toast(`${label} isn’t available from this view yet.`, {
  //     description: 'Ask your teammate in chat to reach out to this contact.',
  //   });
  // }, []);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="text-body-muted">{error}</span>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="contacts-pane">
      <TabToolbar
        testId="contacts-header"
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearchSubmit={submitSearch}
        onSearchClear={clearSearch}
        searchPlaceholder={tabSearchPlaceholder('contacts')}
        searchTestId="contacts-search"
        searchClearTestId="contacts-search-clear"
        filter={
          <TabFilterDropdown
            groups={[{ id: 'tag', label: 'Tags', values: allTags }]}
            selected={selectedKeys}
            onToggle={toggleKey}
            onClear={() => setSelectedKeys(new Set())}
            triggerTestId="contacts-filter-trigger"
            clearTestId="contacts-filter-clear"
          />
        }
        trailing={
          <>
            <BrainScopeDropdown scope={scope} />
            {onManageContacts ? (
              <Button
                size="sm"
                className="h-7 shrink-0"
                onClick={onManageContacts}
                data-testid="contacts-add"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add contact
              </Button>
            ) : null}
          </>
        }
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh contacts"
        refreshTestId="contacts-refresh"
      />

      <div className="min-h-0 flex-1" data-testid="contacts-body">
        {isLoading && !hasLoaded ? (
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3 p-3"
            data-testid="contacts-skeleton"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} lines={2} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-body-muted flex h-full items-center justify-center">
            No contacts found.
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3 p-3">
              {filtered.map((card) => (
                <button
                  key={`${card.contactId ?? card.fullName}`}
                  className="hover:bg-muted/40 flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary-tint-40"
                  onClick={() => setSelected(card)}
                  data-testid={`contact-card-${card.contactId ?? card.fullName}`}
                >
                  <div className="flex items-center gap-2.5">
                    <ContactCardAvatar card={card} assistant={assistant} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-title truncate">{card.fullName}</span>
                        {card.isSystem && (
                          <Shield
                            className="h-3 w-3 shrink-0 text-muted-foreground"
                            aria-label="System contact"
                          />
                        )}
                      </div>
                      {card.jobTitle && (
                        <div className="text-caption truncate">{card.jobTitle}</div>
                      )}
                    </div>
                  </div>
                  {card.email && (
                    <div className="text-caption flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{card.email}</span>
                    </div>
                  )}
                  {card.timezone && (
                    <div className="text-caption flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{card.timezone}</span>
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex flex-wrap gap-1">
                      {card.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="bg-muted/40 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <RespondDot on={card.shouldRespond} />
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <TabFooter
        testId="contacts-footer"
        count={filtered.length}
        total={cards.length}
        singular="contact"
        plural="contacts"
      />

      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent side="right" className="flex flex-col" data-testid="contact-detail">
          <SheetHeader className="shrink-0">
            <div className="flex items-center gap-3">
              {selected && <ContactCardAvatar card={selected} assistant={assistant} size="lg" />}
              <div className="min-w-0">
                <SheetTitle className="truncate">{selected?.fullName}</SheetTitle>
                <SheetDescription className="truncate">
                  {selected?.jobTitle}
                  {selected?.isSystem ? `${selected?.jobTitle ? ' · ' : ''}System contact` : ''}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <ScrollArea className="mt-4 min-h-0 flex-1">
            {selected && <ContactDetail card={selected} />}
          </ScrollArea>
          <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t pt-3">
            {/*
              TODO(wire-backend): Message / Email contact actions are not wired
              to a backend (notifyChatOnly only toasts). Restore once outbound
              messaging/email dispatch endpoints exist.
              <Button
                variant="outline"
                size="sm"
                onClick={() => notifyChatOnly('Messaging a contact')}
                data-testid="contact-message"
              >
                <MessageCircle className="mr-1 h-3.5 w-3.5" /> Message
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!selected?.email}
                onClick={() => notifyChatOnly('Emailing a contact')}
                data-testid="contact-email"
              >
                <Mail className="mr-1 h-3.5 w-3.5" /> Email
              </Button>
            */}
            <Button
              size="sm"
              onClick={onManageContacts}
              disabled={!onManageContacts}
              data-testid="contact-edit"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
