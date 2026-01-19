'use client';

import * as React from 'react';
import { UserApprovalFilters } from '@/components/Pages/Admin/UserApproval/UserApprovalFilters';
import { UserApprovalTable } from '@/components/Pages/Admin/UserApproval/UserApprovalTable';
import { GenerateOneTimeLinkButton } from '@/components/Pages/Admin/UserApproval/GenerateOneTimeLinkButton';
import { OneTimeLinkTable } from '@/components/Pages/Admin/OneTimeLink/OneTimeLinkTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { Button } from '@/components/UI/button';
import { Terminal, RefreshCw } from 'lucide-react';
import { Toaster } from 'sonner';
import { useUserApprovals } from '@/hooks/Admin/useUserApprovals';
import { useApprovalLinks } from '@/hooks/Admin/useApprovalLinks';
import { AdminApprovalActions } from '@/types/admin';

interface MainProps {
  adminApprovalActions: AdminApprovalActions;
}

export default function Main({ adminApprovalActions }: MainProps) {
  const {
    users,
    isLoading: isLoadingUsers,
    isLoadingMore: isLoadingMoreUsers,
    hasMore: hasMoreUsers,
    error: usersError,
    statusFilter,
    setStatusFilter,
    updateUserStatus,
    refreshUsers,
    loadMoreUsers,
  } = useUserApprovals(adminApprovalActions);

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
  } = useApprovalLinks(adminApprovalActions);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 flex-shrink-0 border-b backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden px-4 py-6 sm:px-6 lg:grid-cols-2 lg:px-8">
        {/* Left Column: User Approvals */}
        <section className="flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="flex flex-shrink-0 items-center justify-between border-b p-4">
            <h2 className="text-xl font-semibold">User Hiring Approvals</h2>
            <div className="flex items-center gap-2">
              <UserApprovalFilters
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                disabled={isLoadingUsers || isLoadingMoreUsers}
              />
              <Button
                variant="outline"
                onClick={refreshUsers}
                disabled={isLoadingUsers || isLoadingMoreUsers}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoadingUsers && !isLoadingMoreUsers ? 'animate-spin' : ''}`}
                />
                <span className="ml-2 hidden sm:inline">Refresh Users</span>
              </Button>
            </div>
          </div>

          {usersError && !isLoadingUsers && (
            <Alert variant="destructive" className="m-4">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error Loading Users</AlertTitle>
              <AlertDescription>{usersError}</AlertDescription>
            </Alert>
          )}
          <div className="min-h-0 flex-1 p-4">
            {' '}
            {/* Container for TableVirtuoso height */}
            <UserApprovalTable
              users={users}
              onUpdateStatus={updateUserStatus}
              isLoading={isLoadingUsers && users.length === 0} // For initial skeleton
              isLoadingMore={isLoadingMoreUsers}
              hasMore={hasMoreUsers}
              loadMoreUsers={loadMoreUsers}
            />
          </div>
        </section>

        {/* Right Column: One-Time Links */}
        <section className="flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="flex flex-shrink-0 items-center justify-between border-b p-4">
            <h2 className="text-xl font-semibold">One-Time Approval Links</h2>
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
          <div className="min-h-0 flex-1 p-4">
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
    </div>
  );
}
