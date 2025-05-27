import * as React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/UI/table";
import { Button } from '@/components/UI/button';
import { Badge } from "@/components/UI/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/UI/dropdown-menu";
import { UserApprovalEntry, AssistantHiringApprovalAction, ASSISTANT_HIRING_APPROVAL_ACTIONS, ASSISTANT_HIRING_APPROVAL_DISPLAY } from '@/types/admin';
import { MoreHorizontal, Loader2, CheckCircle, XCircle, HelpCircle, CircleSlash } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/UI/alert-dialog";

interface UserApprovalTableProps {
    users: UserApprovalEntry[];
    onUpdateStatus: (userId: string, newStatus: AssistantHiringApprovalAction) => Promise<boolean>;
    isLoading: boolean; // For loading state of the table data itself
}

const statusColors: Record<string, string> = {
    approved: "bg-green-100 text-green-800 border-green-300",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
    revoked: "bg-orange-100 text-orange-800 border-orange-300",
    none: "bg-gray-100 text-gray-800 border-gray-300",
};

const statusIcons: Record<string, React.ElementType> = {
    approved: CheckCircle,
    pending: HelpCircle,
    rejected: XCircle,
    revoked: CircleSlash,
    none: HelpCircle,
};


export function UserApprovalTable({ users, onUpdateStatus, isLoading }: UserApprovalTableProps) {
    const [updatingStatusForUser, setUpdatingStatusForUser] = React.useState<Record<string, boolean>>({});
    const [confirmAction, setConfirmAction] = React.useState<{ userId: string; newStatus: AssistantHiringApprovalAction; userName: string; } | null>(null);


    const handleUpdate = async (userId: string, newStatus: AssistantHiringApprovalAction) => {
        setConfirmAction(null); // Close confirmation dialog
        setUpdatingStatusForUser(prev => ({ ...prev, [userId]: true }));
        await onUpdateStatus(userId, newStatus);
        setUpdatingStatusForUser(prev => ({ ...prev, [userId]: false }));
    };
    
    const openConfirmationDialog = (userId: string, newStatus: AssistantHiringApprovalAction, userEmail: string, userName?: string | null) => {
        const displayName = userName || userEmail;
        setConfirmAction({ userId, newStatus, userName: displayName });
    };


    const availableActions = Object.values(ASSISTANT_HIRING_APPROVAL_ACTIONS);

    return (
        <>
        <div className="overflow-x-auto w-full"> 
            <Table className="w-full"> 
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[35%] min-w-[200px]">User</TableHead>
                        <TableHead className="w-[35%] min-w-[200px]">Email</TableHead>
                        <TableHead className="text-center w-[20%] min-w-[120px]">Current Status</TableHead>
                        <TableHead className="text-right w-[10%] min-w-[80px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        [...Array(5)].map((_, i) => (
                            <TableRow key={`skeleton-${i}`}>
                                <TableCell><div className="h-4 bg-muted rounded w-3/4"></div></TableCell>
                                <TableCell><div className="h-4 bg-muted rounded w-full"></div></TableCell>
                                <TableCell className="text-center"><div className="h-6 bg-muted rounded w-20 mx-auto"></div></TableCell>
                                <TableCell className="text-right"><div className="h-8 bg-muted rounded w-8 ml-auto"></div></TableCell>
                            </TableRow>
                        ))
                    ) : users.length > 0 ? (
                        users.map((user) => {
                            const isUserUpdating = updatingStatusForUser[user.id];
                            const currentStatusKey = user.assistant_hiring_approval || "none";
                            const StatusIcon = statusIcons[currentStatusKey] || HelpCircle;

                            return (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium truncate" title={user.name || user.email}>
                                        {user.name || <span className="italic text-muted-foreground">No name</span>}
                                    </TableCell>
                                    <TableCell className="truncate" title={user.email}>{user.email}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "capitalize text-xs px-2 py-0.5 whitespace-nowrap",
                                                statusColors[currentStatusKey] || statusColors.none
                                            )}
                                        >
                                            <StatusIcon className="h-3 w-3 mr-1.5"/>
                                            {ASSISTANT_HIRING_APPROVAL_DISPLAY[currentStatusKey as keyof typeof ASSISTANT_HIRING_APPROVAL_DISPLAY] || user.assistant_hiring_approval || "None"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {isUserUpdating ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                                        ) : (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {availableActions.map(action => (
                                                        <DropdownMenuItem
                                                            key={action}
                                                            onClick={() => openConfirmationDialog(user.id, action, user.email, user.name)}
                                                            disabled={user.assistant_hiring_approval === action}
                                                            className={cn(user.assistant_hiring_approval === action && "opacity-50 cursor-not-allowed")}
                                                        >
                                                            Set to {ASSISTANT_HIRING_APPROVAL_DISPLAY[action]}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                No users found matching your criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
        {confirmAction && (
            <AlertDialog open={!!confirmAction} onOpenChange={(isOpen) => !isOpen && setConfirmAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to set the assistant hiring approval status for <strong>{confirmAction.userName}</strong> to <strong>{ASSISTANT_HIRING_APPROVAL_DISPLAY[confirmAction.newStatus]}</strong>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmAction(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleUpdate(confirmAction.userId, confirmAction.newStatus)}>
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
        </>
    );
}