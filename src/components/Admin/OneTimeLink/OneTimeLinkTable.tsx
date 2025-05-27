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
import { OneTimeLinkEntry } from '@/types/admin';
import { Trash2, Loader2, CheckCircle, HelpCircle, Copy, Check, CircleOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
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
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";


interface OneTimeLinkTableProps {
    links: OneTimeLinkEntry[];
    onDeleteLink: (linkId: string) => Promise<boolean>;
    isLoading: boolean;
    onRefreshLinks: () => void;
}

export function OneTimeLinkTable({ links, onDeleteLink, isLoading, onRefreshLinks }: OneTimeLinkTableProps) {
    const [deletingLinkId, setDeletingLinkId] = React.useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = React.useState<OneTimeLinkEntry | null>(null);
    const [copiedToken, setCopiedToken] = React.useState<string | null>(null);

    const handleDelete = async (linkId: string) => {
        setConfirmDelete(null);
        setDeletingLinkId(linkId);
        await onDeleteLink(linkId);
        setDeletingLinkId(null);
    };

    const handleCopyToClipboard = (token: string) => {
        if (typeof window !== "undefined") {
            const fullUrl = `${window.location.origin}/team?token=${token}`;
            navigator.clipboard.writeText(fullUrl).then(() => {
                setCopiedToken(token);
                toast.success("Full link copied to clipboard!");
                setTimeout(() => setCopiedToken(null), 2000);
            }).catch(err => {
                toast.error("Failed to copy link.");
                console.error('Failed to copy: ', err);
            });
        } else {
            toast.error("Cannot copy link in this environment.");
        }
    };


    return (
        <>
            <div className="overflow-x-auto w-full">
                <Table className="w-full"> 
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[30%] min-w-[200px]">Token</TableHead>
                            <TableHead className="text-center w-[20%] min-w-[120px]">Expires At</TableHead>
                            <TableHead className="text-center w-[15%] min-w-[100px]">Status</TableHead>
                            <TableHead className="w-[25%] min-w-[150px]">Claimed By (User ID)</TableHead>
                            <TableHead className="text-right w-[10%] min-w-[80px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <TableRow key={`link-skeleton-${i}`}>
                                    <TableCell><div className="h-4 bg-muted rounded w-full"></div></TableCell>
                                    <TableCell className="text-center"><div className="h-4 bg-muted rounded w-24 mx-auto"></div></TableCell>
                                    <TableCell className="text-center"><div className="h-6 bg-muted rounded w-20 mx-auto"></div></TableCell>
                                    <TableCell><div className="h-4 bg-muted rounded w-3/4"></div></TableCell>
                                    <TableCell className="text-right"><div className="h-8 bg-muted rounded w-8 ml-auto"></div></TableCell>
                                </TableRow>
                            ))
                        ) : links.length > 0 ? (
                            links.map((link) => {
                                const isDeletingThis = deletingLinkId === link.id;
                                const isExpired = new Date(link.expires_at) < new Date();
                                const isClaimed = !!link.claimed_at;
                                
                                let statusText = "Active";
                                let StatusIcon = HelpCircle;
                                let statusColor = "bg-blue-100 text-blue-800 border-blue-300";

                                if (isClaimed) {
                                    statusText = "Claimed";
                                    StatusIcon = CheckCircle;
                                    statusColor = "bg-green-100 text-green-800 border-green-300";
                                } else if (isExpired) {
                                    statusText = "Expired";
                                    StatusIcon = CircleOff; 
                                    statusColor = "bg-gray-100 text-gray-800 border-gray-300 opacity-70";
                                }

                                return (
                                    <TableRow key={link.id} className={cn((isExpired && !isClaimed) && "opacity-60")}>
                                        <TableCell className="font-mono text-xs truncate" title={link.token}>
                                            <div className="flex items-center gap-2">
                                                <span className="truncate">{link.token}</span>
                                                <TooltipProvider delayDuration={100}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 flex-shrink-0"
                                                                onClick={() => handleCopyToClipboard(link.token)}
                                                            >
                                                                {copiedToken === link.token ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">Copy Full Link</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center text-xs">
                                            {formatDistanceToNowStrict(new Date(link.expires_at), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={cn("capitalize text-xs px-2 py-0.5 whitespace-nowrap", statusColor)}>
                                                <StatusIcon className="h-3 w-3 mr-1.5" />
                                                {statusText}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs truncate" title={link.user_id || undefined}>
                                            {link.user_id || <span className="italic text-muted-foreground">N/A</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isDeletingThis ? (
                                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                                            ) : (
                                                <TooltipProvider delayDuration={150}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                                onClick={() => setConfirmDelete(link)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="left">Delete Link</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No one-time approval links found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {confirmDelete && (
                <AlertDialog open={!!confirmDelete} onOpenChange={(isOpen) => !isOpen && setConfirmDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Delete Link</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this one-time approval link?
                                <br />
                                <span className="font-mono text-xs bg-muted p-1 rounded mt-1 inline-block">{confirmDelete.token}</span>
                                <br />
                                This action cannot be undone. If the link was active and unclaimed, it will no longer work.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setConfirmDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => handleDelete(confirmDelete.id)}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                Confirm Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </>
    );
}