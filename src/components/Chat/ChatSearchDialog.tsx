import * as React from 'react';
import { Search, Loader2, Phone, MessageSquare, Calendar as CalendarIcon } from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Badge } from '@/components/UI/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Calendar } from '@/components/UI/calendar';
import { cn } from '@/lib/utils';
import type {
  ChatSearchResult,
  ChatSearchMedium,
  ChatSearchSender,
  AttachmentType,
} from '@/types/assistants/chat';
import type { UseChatSearchReturn } from '@/hooks/Assistants/useChatSearch';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';

interface ChatSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchState: UseChatSearchReturn;
  assistantName: string;
  onGoToMessage: (result: ChatSearchResult) => void;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  let lastIndex = 0;

  let searchIndex = lowerText.indexOf(lowerQuery);
  while (searchIndex !== -1) {
    if (searchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, searchIndex));
    }
    parts.push(
      <mark key={searchIndex} className="rounded-sm bg-muted px-0.5 text-foreground">
        {text.slice(searchIndex, searchIndex + lowerQuery.length)}
      </mark>
    );
    lastIndex = searchIndex + lowerQuery.length;
    searchIndex = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

function formatResultTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDateForButton(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

const MEDIUM_OPTIONS: { value: ChatSearchMedium; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'chat', label: 'Chat' },
  { value: 'call', label: 'Call' },
];

const SENDER_OPTIONS: { value: ChatSearchSender; label: string; dynamicLabel?: true }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'assistant', label: 'Assistant', dynamicLabel: true },
  { value: 'me', label: 'Me' },
];

const ATTACHMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'Any' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Spreadsheet' },
  { value: 'code', label: 'Code' },
  { value: 'archive', label: 'Archive' },
];

export function ChatSearchDialog({
  open,
  onOpenChange,
  searchState,
  assistantName,
  onGoToMessage,
}: ChatSearchDialogProps) {
  const {
    filters,
    setQuery,
    setMedium,
    setSender,
    setAttachmentType,
    setDateRange,
    results,
    isSearching,
    hasSearched,
    hasMore,
    search,
    loadMore,
  } = searchState;

  // Local input state avoids re-rendering the parent chat panel on every keystroke
  const [localQuery, setLocalQuery] = React.useState(filters.query);
  const [selectedResultId, setSelectedResultId] = React.useState<string | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setLocalQuery(filters.query);
      setSelectedResultId(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, filters.query]);

  const handleSearch = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      setSelectedResultId(null);
      setQuery(localQuery);
      search();
    },
    [search, setQuery, localQuery]
  );

  const handleGoToMessage = React.useCallback(() => {
    const result = results.find((r) => r.id === selectedResultId);
    if (result) {
      onGoToMessage(result);
      onOpenChange(false);
    }
  }, [results, selectedResultId, onGoToMessage, onOpenChange]);

  // Infinite scroll via IntersectionObserver on a sentinel at the bottom
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isSearching) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isSearching, loadMore]);

  const selectedResult = results.find((r) => r.id === selectedResultId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[700px]"
        data-testid="chat-search-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search Conversation
          </DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder={tabSearchPlaceholder('chat')}
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            data-testid="chat-search-input"
          />
          <Button type="submit" disabled={isSearching} data-testid="chat-search-button">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </form>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* In: Chat | Call | All */}
          <div className="flex items-center gap-1">
            <span className="text-caption text-muted-foreground">In:</span>
            <Select value={filters.medium} onValueChange={(v) => setMedium(v as ChatSearchMedium)}>
              <SelectTrigger
                className="text-caption h-7 w-[80px]"
                data-testid="search-filter-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEDIUM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Includes: attachment type */}
          <div className="flex items-center gap-1">
            <span className="text-caption text-muted-foreground">Includes:</span>
            <Select
              value={filters.attachmentType || 'none'}
              onValueChange={(v) => setAttachmentType(v === 'none' ? null : (v as AttachmentType))}
            >
              <SelectTrigger
                className="text-caption h-7 w-[100px]"
                data-testid="search-filter-attachment"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTACHMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From: sender */}
          <div className="flex items-center gap-1">
            <span className="text-caption text-muted-foreground">From:</span>
            <Select value={filters.sender} onValueChange={(v) => setSender(v as ChatSearchSender)}>
              <SelectTrigger
                className="text-caption h-7 w-[110px]"
                data-testid="search-filter-sender"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.dynamicLabel && opt.value === 'assistant' ? assistantName : opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1">
            <span className="text-caption text-muted-foreground">Date:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-caption h-7 gap-1 font-normal"
                  data-testid="search-filter-date"
                >
                  <CalendarIcon className="h-3 w-3" />
                  {filters.startDate && filters.endDate
                    ? `${formatDateForButton(filters.startDate)} - ${formatDateForButton(filters.endDate)}`
                    : filters.startDate
                      ? `From ${formatDateForButton(filters.startDate)}`
                      : 'Any time'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={
                    filters.startDate
                      ? { from: filters.startDate, to: filters.endDate || undefined }
                      : undefined
                  }
                  onSelect={(range) => setDateRange(range?.from || null, range?.to || null)}
                  numberOfMonths={1}
                />
                {filters.startDate && (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-caption h-7 w-full"
                      onClick={() => setDateRange(null, null)}
                    >
                      Clear dates
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Results — scrollable area between filters and footer */}
        <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {!hasSearched ? (
            <div className="text-caption py-12 text-center text-muted-foreground">
              Enter a search term or apply filters to find messages.
            </div>
          ) : isSearching && results.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} />
            </div>
          ) : results.length === 0 ? (
            <div className="text-caption py-12 text-center text-muted-foreground">
              No messages found.
            </div>
          ) : (
            <div className="space-y-1" data-testid="chat-search-results">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => setSelectedResultId(result.id)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-left transition-colors',
                    selectedResultId === result.id
                      ? 'bg-primary/5 border-primary'
                      : 'border-transparent hover:bg-muted'
                  )}
                  data-testid="chat-search-result-item"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-semibold">
                      {result.role === 'assistant' ? assistantName : 'You'}
                    </span>
                    <Badge variant="outline" className="h-4 gap-0.5 px-1 text-[10px]">
                      {result.medium === 'unify_meet' ? (
                        <>
                          <Phone className="h-2.5 w-2.5" /> Call
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-2.5 w-2.5" /> Chat
                        </>
                      )}
                    </Badge>
                    <time className="ml-auto text-[10px] text-muted-foreground">
                      {formatResultTime(result.timestamp)}
                    </time>
                  </div>
                  <p className="text-caption mt-0.5 line-clamp-2 text-muted-foreground">
                    <HighlightedText text={result.content} query={filters.query} />
                  </p>
                </button>
              ))}
              {isSearching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {hasMore && !isSearching && <div ref={sentinelRef} className="h-1" />}
            </div>
          )}
        </div>

        {/* Go to message footer — always visible below the scroll area */}
        {selectedResult && (
          <div className="flex shrink-0 items-center justify-end border-t pt-3">
            <Button
              size="sm"
              onClick={handleGoToMessage}
              disabled={!selectedResult.messageId}
              data-testid="chat-search-go-to-message"
            >
              Go To Message
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
