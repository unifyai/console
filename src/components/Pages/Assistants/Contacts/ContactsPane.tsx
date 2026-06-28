'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Plus, Shield, Mail, Clock, Pencil, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
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
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import { TabToolbar } from '../Common/TabToolbar';
import { TabFilterDropdown } from '../Common/TabFilterDropdown';
import { TabFooter } from '../Common/TabFooter';
import {
  mapContactRow,
  filterContacts,
  collectContactTags,
  contactAvatarTone,
  type ContactCard,
} from '@/utils/assistants/contacts';
import type { Assistant } from '@/types/assistants/assistant';

interface ContactsPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Opens the channel-identity provisioning dialog (the live "Contacts" action). */
  onManageContacts?: () => void;
}

function RespondDot({ on }: { on: boolean }) {
  return (
    <span
      title={on ? 'Auto-responds' : 'Does not auto-respond'}
      className={cn('h-2 w-2 shrink-0 rounded-full', on ? 'bg-primary' : 'bg-muted-foreground/40')}
    />
  );
}

function Avatar({ card, size = 'sm' }: { card: ContactCard; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-[9px] font-display font-semibold text-primary-foreground',
        size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-[13px]'
      )}
      style={{ backgroundColor: contactAvatarTone(card.contactId, card.fullName) }}
    >
      {card.initials}
    </span>
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
            card.shouldRespond ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
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
}: ContactsPaneProps) {
  const { contacts, isLoading, error, refetch } = useBrainData({
    assistant,
    ownerId,
    assistantId,
    contexts: ['Contacts'] as const,
    initialContext: 'Contacts',
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<ContactCard | null>(null);

  const cards = useMemo(() => contacts.rows.map(mapContactRow), [contacts.rows]);
  const allTags = useMemo(() => collectContactTags(cards), [cards]);
  const selectedTags = useMemo(
    () => Array.from(selectedKeys).map((k) => k.slice(k.indexOf(':') + 1)),
    [selectedKeys]
  );
  const filtered = useMemo(
    () => filterContacts(cards, query, selectedTags),
    [cards, query, selectedTags]
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

  const notifyChatOnly = useCallback((label: string) => {
    toast(`${label} isn’t available from this view yet.`, {
      description: 'Ask your digital twin in chat to reach out to this contact.',
    });
  }, []);

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
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search contacts…"
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
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh contacts"
        refreshTestId="contacts-refresh"
        addAction={
          onManageContacts && (
            <Button
              size="sm"
              className="h-7 shrink-0"
              onClick={onManageContacts}
              data-testid="contacts-add"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add contact
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1" data-testid="contacts-body">
        {isLoading && cards.length === 0 ? (
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
                  className="hover:border-primary/40 hover:bg-muted/40 flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors"
                  onClick={() => setSelected(card)}
                  data-testid={`contact-card-${card.contactId ?? card.fullName}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar card={card} />
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
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:!max-w-xl"
          data-testid="contact-detail"
        >
          <SheetHeader className="shrink-0">
            <div className="flex items-center gap-3">
              {selected && <Avatar card={selected} size="lg" />}
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
