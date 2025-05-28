'use client';

import * as React from 'react';
import { UserApprovalFilters } from '@/components/Admin/UserApproval/UserApprovalFilters';
import { UserApprovalTable } from '@/components/Admin/UserApproval/UserApprovalTable';
import { GenerateOneTimeLinkButton } from '@/components/Admin/UserApproval/GenerateOneTimeLinkButton';
import { OneTimeLinkTable } from '@/components/Admin/OneTimeLink/OneTimeLinkTable';
import { Alert, AlertDescription, AlertTitle } from "@/components/UI/alert";
import { Button } from "@/components/UI/button";
import { Terminal, RefreshCw } from "lucide-react";
import { Toaster } from "sonner";
import { useUserApprovals } from "@/hooks/Admin/useUserApprovals";
import { useOneTimeApprovalLink } from "@/hooks/Admin/useOneTimeApprovalLink";
import { useOneTimeApprovalLinksManager } from "@/hooks/Admin/useOneTimeApprovalLinksManager";
import { AdminApprovalActions } from '@/types/admin';

interface MainProps {
    adminApprovalActions: AdminApprovalActions
}

export default function Main({ 
    adminApprovalActions
}: MainProps) {

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
        isLoading: isLoadingLinkGeneration,
        generateLink,
    } = useOneTimeApprovalLink(adminApprovalActions);

    const {
        links: oneTimeLinks,
        isLoading: isLoadingOneTimeLinks,
        isLoadingMore: isLoadingMoreOneTimeLinks,
        hasMore: hasMoreOneTimeLinks,
        error: oneTimeLinksError,
        refreshLinks,
        deleteLink: deleteOneTimeLinkAction,
        loadMoreLinks,
    } = useOneTimeApprovalLinksManager(adminApprovalActions);


    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col w-full">
            <Toaster richColors position="top-right" />
            <header className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b flex-shrink-0">
                <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
                </div>
            </header>

            <div className="flex-1 py-6 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
                {/* Left Column: User Approvals */}
                <section className="bg-card rounded-lg border shadow-sm flex flex-col overflow-hidden h-full">
                    <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                        <h2 className="text-xl font-semibold">User Hiring Approvals</h2>
                        <div className="flex items-center gap-2">
                            <UserApprovalFilters
                                statusFilter={statusFilter}
                                setStatusFilter={setStatusFilter}
                                disabled={isLoadingUsers || isLoadingMoreUsers}
                            />
                            <Button variant="outline" onClick={refreshUsers} disabled={isLoadingUsers || isLoadingMoreUsers}>
                                <RefreshCw className={`h-4 w-4 ${isLoadingUsers && !isLoadingMoreUsers ? 'animate-spin' : ''}`} />
                                <span className="ml-2 sm:inline hidden">Refresh</span>
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
                    <div className="flex-1 min-h-0 p-4"> {/* Container for TableVirtuoso height */}
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
                <section className="bg-card rounded-lg border shadow-sm flex flex-col overflow-hidden h-full">
                    <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                        <h2 className="text-xl font-semibold">One-Time Approval Links</h2>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={refreshLinks} disabled={isLoadingOneTimeLinks || isLoadingMoreOneTimeLinks}>
                                <RefreshCw className={`h-4 w-4 ${isLoadingOneTimeLinks && !isLoadingMoreOneTimeLinks ? 'animate-spin' : ''}`} />
                                <span className="ml-2 sm:inline hidden">Refresh</span>
                            </Button>
                            <GenerateOneTimeLinkButton
                                onGenerateLink={generateLink}
                                isLoading={isLoadingLinkGeneration}
                            />
                        </div>
                    </div>
                    {oneTimeLinksError && !isLoadingOneTimeLinks && (
                        <Alert variant="destructive" className="m-4">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>Error Loading Links</AlertTitle>
                            <AlertDescription>{oneTimeLinksError}</AlertDescription>
                        </Alert>
                    )}
                    <div className="flex-1 min-h-0 p-4">  {/* Container for TableVirtuoso height */}
                        <OneTimeLinkTable
                            links={oneTimeLinks}
                            onDeleteLink={deleteOneTimeLinkAction}
                            isLoading={isLoadingOneTimeLinks && oneTimeLinks.length === 0} // For initial skeleton
                            isLoadingMore={isLoadingMoreOneTimeLinks}
                            hasMore={hasMoreOneTimeLinks}
                            loadMoreLinks={loadMoreLinks}
                            onRefreshLinks={refreshLinks}
                        />
                    </div>
                </section>
            </div>
        </div>
    );
}