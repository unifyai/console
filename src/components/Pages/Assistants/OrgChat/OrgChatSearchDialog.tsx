'use client';

import * as React from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import { Input } from '@/components/UI/input';
import { cn } from '@/lib/utils';
import { OrgChatSearchResult, parseOrgChatSearchResult } from '@/types/orgChat';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { isImeComposing } from '@/utils/keyboard';

interface OrgChatSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  scope: 'dm' | 'team' | 'group';
  scopeId: string | number;
  peerName: string;
  onGoToMessage: (result: OrgChatSearchResult) => void;
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

/** Simple in-conversation search for org DM / team chat. */
export function OrgChatSearchDialog({
  open,
  onOpenChange,
  orgId,
  scope,
  scopeId,
  peerName,
  onGoToMessage,
}: OrgChatSearchDialogProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<OrgChatSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
    }
  }, [open]);

  const runSearch = React.useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        q,
        scope,
        id: String(scopeId),
      });
      const response = await fetch(
        `/api/organizations/${orgId}/org-chat/search?${params.toString()}`
      );
      if (!response.ok) {
        setResults([]);
        return;
      }
      const data = await response.json();
      const next: OrgChatSearchResult[] = Array.isArray(data?.results)
        ? data.results.map((row: Record<string, unknown>) => parseOrgChatSearchResult(row))
        : [];
      setResults(next);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [orgId, query, scope, scopeId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0" data-testid="org-chat-search-dialog">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-title">Search in {peerName}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (isImeComposing(e)) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                void runSearch();
              }
            }}
            placeholder={tabSearchPlaceholder('chat')}
            className="border-0 shadow-none focus-visible:ring-0"
            data-testid="org-chat-search-input"
            autoFocus
          />
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!hasSearched ? (
            <p className="text-body-muted px-2 py-6 text-center text-sm">
              Type a query and press Enter
            </p>
          ) : results.length === 0 ? (
            <p className="text-body-muted px-2 py-6 text-center text-sm">No messages found</p>
          ) : (
            <ul className="space-y-1">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted'
                    )}
                    onClick={() => onGoToMessage(result)}
                    data-testid={`org-chat-search-result-${result.id}`}
                  >
                    <div className="text-caption text-muted-foreground">{result.senderName}</div>
                    <div className="text-sm">
                      <HighlightedText text={result.content} query={query} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
