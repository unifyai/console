'use client';

import * as React from 'react';
import { GenerateOneTimeLinkButton } from '@/components/Pages/Links/OneTimeLink/GenerateOneTimeLinkButton';
import { OneTimeLinkTable } from '@/components/Pages/Links/OneTimeLink/OneTimeLinkTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { Button } from '@/components/UI/button';
import { Terminal, RefreshCw } from 'lucide-react';

import { useApprovalLinks } from '@/hooks/Links/useOneTimeCreditLinks';
import { AdminCreditGrantActions } from '@/types/admin';

interface MainProps {
  adminCreditGrantActions: AdminCreditGrantActions;
}

export default function Main({ adminCreditGrantActions }: MainProps) {
  const {
    isGeneratingLink,
    generateNewLink,
    links,
    isLoadingLinks,
    isLoadingMoreLinks,
    hasMoreLinks,
    linksError,
    refreshLinksList,
    deleteLink,
    loadMoreLinksToList,
  } = useApprovalLinks(adminCreditGrantActions);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-hidden bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      {/* Credit Grant Links */}
      <section className="flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="flex flex-shrink-0 items-center justify-between border-b p-4">
          <h2 className="text-title text-semibold">Credit Grant Links</h2>
          <div className="flex gap-2">
            <GenerateOneTimeLinkButton
              onGenerateLink={generateNewLink}
              isLoading={isGeneratingLink}
            />
            <Button
              variant="outline"
              onClick={refreshLinksList}
              disabled={isLoadingLinks || isLoadingMoreLinks}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoadingLinks && !isLoadingMoreLinks ? 'animate-spin' : ''}`}
              />
              <span className="ml-2 hidden sm:inline">Refresh Links</span>
            </Button>
          </div>
        </div>
        {linksError && !isLoadingLinks && (
          <Alert variant="destructive" className="m-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error Loading Links</AlertTitle>
            <AlertDescription>{linksError}</AlertDescription>
          </Alert>
        )}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-auto p-4">
          {' '}
          {/* Container for TableVirtuoso height */}
          <OneTimeLinkTable
            links={links}
            onDeleteLink={deleteLink}
            isLoading={isLoadingLinks && links.length === 0}
            isLoadingMore={isLoadingMoreLinks}
            hasMore={hasMoreLinks}
            loadMoreLinks={loadMoreLinksToList}
            onRefreshLinks={refreshLinksList}
          />
        </div>
      </section>
    </div>
  );
}
