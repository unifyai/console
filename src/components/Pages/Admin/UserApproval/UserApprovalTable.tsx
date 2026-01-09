import * as React from 'react';
import { TableVirtuoso, TableVirtuosoHandle, TableComponents } from 'react-virtuoso';
import {
    Table,
    TableCell,
    TableHead,
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
    isLoading: boolean; 
    isLoadingMore: boolean;
    hasMore: boolean;
    loadMoreUsers: () => void;
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

const SkeletonRow = () => (
    <TableRow>
        <TableCell><div className="h-4 bg-muted rounded w-3/4"></div></TableCell>
        <TableCell><div className="h-4 bg-muted rounded w-full"></div></TableCell>
        <TableCell className="text-center"><div className="h-6 bg-muted rounded w-20 mx-auto"></div></TableCell>
        <TableCell className="text-right"><div className="h-8 bg-muted rounded w-8 ml-auto"></div></TableCell>
    </TableRow>
);

const LOADING_MORE_USERS_ID = "___LOADING_MORE_USERS___";

const VirtuosoShadcnTable: TableComponents<UserApprovalEntry>['Table'] = React.forwardRef(
    ({ style, children, ...props }, ref) => {
        return (
            <Table
                ref={ref as React.Ref<HTMLTableElement>}
                style={style}
                {...props}
                className="w-full"
            >
                {children}
            </Table>
        );
    }
);
VirtuosoShadcnTable.displayName = "VirtuosoShadcnTableForUserApproval";


export function UserApprovalTable({ users, onUpdateStatus, isLoading, isLoadingMore, hasMore, loadMoreUsers }: UserApprovalTableProps) {
    const [updatingStatusForUser, setUpdatingStatusForUser] = React.useState<Record<string, boolean>>({});
    const [confirmAction, setConfirmAction] = React.useState<{ userId: string; newStatus: AssistantHiringApprovalAction; userName: string; } | null>(null);
    const virtuosoRef = React.useRef<TableVirtuosoHandle>(null);


    const handleUpdate = async (userId: string, newStatus: AssistantHiringApprovalAction) => {
        setConfirmAction(null); 
        setUpdatingStatusForUser(prev => ({ ...prev, [userId]: true }));
        await onUpdateStatus(userId, newStatus); 
        setUpdatingStatusForUser(prev => ({ ...prev, [userId]: false }));
    };
    
    const openConfirmationDialog = (userId: string, newStatus: AssistantHiringApprovalAction, userEmail: string, userName?: string | null) => {
        const displayName = userName || userEmail;
        setConfirmAction({ userId, newStatus, userName: displayName });
    };

    const availableActions = Object.values(ASSISTANT_HIRING_APPROVAL_ACTIONS);

    const tableData = React.useMemo(() => {
        if (isLoadingMore) {
            return [...users, { id: LOADING_MORE_USERS_ID } as UserApprovalEntry];
        }
        return users;
    }, [users, isLoadingMore]);

    if (isLoading && users.length === 0 && !isLoadingMore) {
        return (
             <Table className="w-full">
                <thead> 
                    <TableRow>
                        <TableHead className="w-[35%] min-w-[200px]">User</TableHead>
                        <TableHead className="w-[35%] min-w-[200px]">Email</TableHead>
                        <TableHead className="text-center w-[20%] min-w-[120px]">Current Status</TableHead>
                        <TableHead className="text-right w-[10%] min-w-[80px]">Actions</TableHead>
                    </TableRow>
                </thead>
                <tbody>
                    {[...Array(10)].map((_, i) => <SkeletonRow key={`skeleton-${i}`} />)}
                </tbody>
            </Table>
        );
    }
    
    if (!isLoading && users.length === 0 && !isLoadingMore) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                No users found matching your criteria.
            </div>
        );
    }

    return (
        <>
            <TableVirtuoso
                ref={virtuosoRef}
                style={{ height: '100%' }} 
                data={tableData}
                endReached={() => {
                    if (hasMore && !isLoadingMore && !isLoading) {
                        loadMoreUsers();
                    }
                }}
                overscan={20}
                components={{
                    Table: VirtuosoShadcnTable,
                }}
                fixedHeaderContent={() => (
                    <TableRow> 
                        <TableHead className="w-[35%] min-w-[200px]">User</TableHead>
                        <TableHead className="w-[35%] min-w-[200px]">Email</TableHead>
                        <TableHead className="text-center w-[20%] min-w-[120px]">Current Status</TableHead>
                        <TableHead className="text-right w-[10%] min-w-[80px]">Actions</TableHead>
                    </TableRow>
                )}
                itemContent={(_index, user) => {
                    if (user.id === LOADING_MORE_USERS_ID) {
                        return ( 
                            <TableCell colSpan={4} className="text-center p-4 h-[57px]"> 
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                            </TableCell>
                        );
                    }

                    const isUserUpdating = updatingStatusForUser[user.id];
                    const currentStatusKey = user.assistantHiringApproval || "none";
                    const StatusIcon = statusIcons[currentStatusKey] || HelpCircle;

                    return (
                        <>
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
                                    {ASSISTANT_HIRING_APPROVAL_DISPLAY[currentStatusKey as keyof typeof ASSISTANT_HIRING_APPROVAL_DISPLAY] || user.assistantHiringApproval || "None"}
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
                                                    disabled={user.assistantHiringApproval === action}
                                                    className={cn(user.assistantHiringApproval === action && "opacity-50 cursor-not-allowed")}
                                                >
                                                    Set to {ASSISTANT_HIRING_APPROVAL_DISPLAY[action]}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </TableCell>
                        </>
                    );
                }}
            />
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