// src/app/(home)/admin/page.tsx
import * as React from 'react';
import Main from '@/components/Admin/Main';
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user/user";
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { Terminal } from 'lucide-react';
import { 
    listUsersForApproval, 
    generateOneTimeApprovalLink, 
    updateUserApprovalStatus,
    listOneTimeApprovalLinks,
    deleteOneTimeApprovalLink
} from '@/lib/admin/approval';
import { AdminApprovalActions } from '@/types/admin';

const AdminPage = async ({ searchParams }: { searchParams: { token?: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login'); 
    }
    
    const isAdmin = user.organization?.level === "admin" || user.organization?.level === "owner"; 

    const adminApprovalActions: AdminApprovalActions = {
        listUsers: await listUsersForApproval(),
        updateUserStatus: await updateUserApprovalStatus(),
        generateOneTimeLink: await generateOneTimeApprovalLink(),
        listOneTimeLinks: await listOneTimeApprovalLinks(),
        deleteOneTimeLink: await deleteOneTimeApprovalLink(),
    };

    return (
        <div className="flex w-full h-full"> 
            {isAdmin ? (
                <Main adminApprovalActions={adminApprovalActions} />
            ) : (
                <div className="flex items-center justify-center h-screen p-4">
                    <Alert variant="destructive" className="w-auto max-w-md">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You do not have permission to view this page.
                        </AlertDescription>
                    </Alert>
                </div>
            )}
        </div>
    );
}

export default AdminPage;