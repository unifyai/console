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
import { ScrollArea } from '@/components/UI/scroll-area';

interface MainProps {
    adminApprovalActions: AdminApprovalActions
}

export default function Main({ 
    adminApprovalActions
}: MainProps) {

    const {
        users,
        isLoading: isLoadingUsers,
        error: usersError,
        statusFilter,
        setStatusFilter,
        searchTerm,
        setSearchTerm,
        updateUserStatus,
        refreshUsers,
    } = useUserApprovals(adminApprovalActions);

    const {
        isLoading: isLoadingLinkGeneration,
        generateLink,
    } = useOneTimeApprovalLink(adminApprovalActions);

    const {
        links: oneTimeLinks,
        isLoading: isLoadingOneTimeLinks,
        error: oneTimeLinksError,
        fetchLinks: refreshOneTimeLinks,
        deleteLink: deleteOneTimeLinkAction,
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
                <section className="bg-card rounded-lg border shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                        <h2 className="text-xl font-semibold">User Hiring Approvals</h2>
                        <Button variant="outline" onClick={refreshUsers} disabled={isLoadingUsers}>
                            <RefreshCw className={`h-4 w-4 ml-2 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                            <span className="mr-2 sm:inline hidden">Refresh Users</span>
                        </Button>
                    </div>
                    <UserApprovalFilters
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        disabled={isLoadingUsers}
                    />
                    {usersError && (
                        <Alert variant="destructive" className="m-4">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>Error Loading Users</AlertTitle>
                            <AlertDescription>{usersError}</AlertDescription>
                        </Alert>
                    )}
                    <ScrollArea className="flex-1 min-h-0">
                         <div className="p-4">
                            <UserApprovalTable
                                users={users}
                                onUpdateStatus={updateUserStatus}
                                isLoading={isLoadingUsers}
                            />
                        </div>
                    </ScrollArea>
                </section>

                {/* Right Column: One-Time Links */}
                <section className="bg-card rounded-lg border shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                        <h2 className="text-xl font-semibold">One-Time Approval Links</h2>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={refreshOneTimeLinks} disabled={isLoadingOneTimeLinks}>
                                <RefreshCw className={`h-4 w-4 ml-2 ${isLoadingOneTimeLinks ? 'animate-spin' : ''}`} />
                                <span className="mr-2 sm:inline hidden">Refresh Links</span>
                            </Button>
                            <GenerateOneTimeLinkButton
                                onGenerateLink={generateLink}
                                isLoading={isLoadingLinkGeneration}
                            />
                        </div>
                    </div>
                    {oneTimeLinksError && (
                        <Alert variant="destructive" className="m-4">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>Error Loading Links</AlertTitle>
                            <AlertDescription>{oneTimeLinksError}</AlertDescription>
                        </Alert>
                    )}
                     <ScrollArea className="flex-1 min-h-0">
                         <div className="p-4">
                            <OneTimeLinkTable
                                links={oneTimeLinks}
                                onDeleteLink={deleteOneTimeLinkAction}
                                isLoading={isLoadingOneTimeLinks}
                                onRefreshLinks={refreshOneTimeLinks}
                            />
                        </div>
                    </ScrollArea>
                </section>
            </div>
        </div>
    );
}