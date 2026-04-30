'use client';

import {
  MoreHorizontal,
  User,
  Shield,
  LogOut,
  CheckCircle,
  HelpCircle,
  Send,
  AlertTriangle,
  Infinity,
  Camera,
  Lock,
  Copy,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
} from '@/components/UI/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/alert-dialog';
import { TableRow, TableCell } from '@/components/UI/table';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/UI/avatar';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { OrganizationRole, SpendingDisplayProps } from '@/types/organization';
import { UnifiedMember } from '@/hooks/Organizations/useOrganization';
import { MemberAssistantInfo } from './Main';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { formatSpendAmount } from '@/types/assistants/spending';

/** Member spending information for display */
export interface MemberSpendingInfo {
  /** Current month's cumulative spend */
  currentSpend: number;
  /** Monthly spending limit (null = unlimited) */
  limit: number | null;
  /** Display properties for visualization */
  display: SpendingDisplayProps | null;
  /** Whether spending data is loading */
  isLoading?: boolean;
}

interface MemberRowProps {
  member: UnifiedMember;
  userTeams?: string[];
  memberAssistants?: MemberAssistantInfo[];
  roles: OrganizationRole[];
  currentUserId: string;
  canManageMembers: boolean;
  isOrgOwner: boolean;
  onRemove: (id: string) => void;
  onUpdateRole: (id: string, roleId: number, roleName: string) => void;
  onTransferOwnership: (id: string) => void;
  onCancelInvite: (id: string) => void;
  onResendInvite: (email: string) => void;
  /** Optional spending information for the member */
  spendingInfo?: MemberSpendingInfo;
  /** Whether spending columns should be displayed */
  showSpending?: boolean;
  /** Callback when user wants to edit spending limit */
  onEditSpendingLimit?: (userId: string) => void;
  /** Whether the organization is in free trial mode */
  freeTrial?: boolean;
}

const getRoleBadgeColor = (roleName: string) => {
  const normalized = roleName.toLowerCase();
  if (normalized === 'owner')
    return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
  if (normalized === 'admin')
    return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
  if (normalized === 'manager')
    return 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800';
  if (normalized === 'member')
    return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
};

const FREE_TRIAL_CONTACT_URL = 'https://cal.com/danlenton/15min';

const FreeTrialBadge = () => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-body-muted inline-flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Trial
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>
          Billing is available beyond the free trial.{' '}
          <a
            href={FREE_TRIAL_CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            Get in touch
          </a>{' '}
          to unlock.
        </p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const MemberRow = ({
  member,
  userTeams,
  memberAssistants,
  roles,
  currentUserId,
  canManageMembers,
  isOrgOwner,
  onRemove,
  onUpdateRole,
  onTransferOwnership,
  onCancelInvite,
  onResendInvite,
  spendingInfo,
  showSpending = false,
  onEditSpendingLimit,
  freeTrial = false,
}: MemberRowProps) => {
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEmailCopied, setIsEmailCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy the row's email to the clipboard. Swallowing the error keeps
  // the UI quiet on browsers/contexts where clipboard access is denied
  // (e.g. insecure context, embedded iframe) — the toast surfaces the
  // failure so the user knows to copy manually.
  const handleCopyEmail = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!member.email) return;
      try {
        await navigator.clipboard.writeText(member.email);
        setIsEmailCopied(true);
        toast.success('Email copied to clipboard.');
        setTimeout(() => setIsEmailCopied(false), 1500);
      } catch {
        toast.error('Failed to copy email.');
      }
    },
    [member.email]
  );

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/user/photo/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      setResolvedImageUrl(URL.createObjectURL(file));
      toast.success('Profile photo updated.');
    } catch {
      toast.error('Failed to upload photo.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    const image = member.image;
    if (!image) {
      setResolvedImageUrl(null);
      return;
    }
    if (!image.startsWith('gs://')) {
      setResolvedImageUrl(image);
      return;
    }
    let cancelled = false;
    fetch('/api/storage/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      body: JSON.stringify({ gs_url: image }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setResolvedImageUrl(data.signed_url);
      })
      .catch(() => {
        if (!cancelled) setResolvedImageUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [member.image]);

  const isSelf = member.userId === currentUserId;
  const currentRoleName = member.role || 'Member';
  const badgeColor = getRoleBadgeColor(currentRoleName);

  const isTargetOwner = currentRoleName === 'Owner';

  return (
    <>
      <TableRow className="hover:bg-muted/50 group">
        {/* User */}
        <TableCell className="font-medium">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn('group/avatar relative flex-shrink-0', isSelf && 'cursor-pointer')}
              onClick={isSelf ? () => fileInputRef.current?.click() : undefined}
            >
              <Avatar
                className={cn(
                  'h-9 w-9 border',
                  member.status === 'pending' ? 'border-yellow-200 bg-yellow-100/50' : 'bg-muted'
                )}
              >
                {resolvedImageUrl && <AvatarImage src={resolvedImageUrl} alt={member.name} />}
                <AvatarFallback
                  className={cn(member.status === 'pending' ? 'bg-yellow-100/50' : 'bg-muted')}
                >
                  <User
                    className={cn(
                      'h-4 w-4',
                      member.status === 'pending' ? 'text-yellow-600' : 'text-muted-foreground'
                    )}
                  />
                </AvatarFallback>
              </Avatar>
              {isSelf && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-all group-hover/avatar:bg-black/40 group-hover/avatar:opacity-100">
                  {isUploading ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Camera className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
              )}
            </div>
            {isSelf && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-title truncate leading-none">
                {isSelf ? (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href="/account" className="hover:underline">
                          {member.name}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Go to Account settings</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  member.name
                )}
                {isSelf && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">(You)</span>
                )}
                {member.status === 'pending' && (
                  <span className="ml-1 text-xs font-normal italic text-muted-foreground">
                    (Invited)
                  </span>
                )}
              </span>
            </div>
          </div>
        </TableCell>

        {/* Email */}
        <TableCell className="hidden lg:table-cell">
          {member.email ? (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    aria-label={isEmailCopied ? 'Email copied' : `Copy ${member.email}`}
                    className="text-body-muted group/email inline-flex max-w-full items-center gap-1.5 rounded text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate">{member.email}</span>
                    {isEmailCopied ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/email:opacity-100" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isEmailCopied ? 'Copied!' : `Copy ${member.email}`}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-body-muted block truncate">—</span>
          )}
        </TableCell>

        {/* Assistants */}
        <TableCell className="text-center">
          <div className="flex h-full min-h-[36px] flex-wrap items-center justify-center gap-1">
            {member.status === 'active' && memberAssistants && memberAssistants.length > 0 ? (
              memberAssistants.map((a) => (
                <TooltipProvider key={a.agentId} delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href={`/assistants?profile=${a.agentId}`}>
                        <Badge className="hover:bg-muted/80 h-5 cursor-pointer border-transparent bg-muted px-1 py-0 text-[10px] font-normal text-muted-foreground">
                          {a.firstName} {a.surname}
                        </Badge>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Open {a.firstName} {a.surname}&apos;s profile
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))
            ) : (
              <span className="text-caption">-</span>
            )}
          </div>
        </TableCell>

        {/* Teams - Aligned Center */}
        <TableCell className="text-center">
          <div className="flex h-full min-h-[36px] flex-wrap items-center justify-center gap-1">
            {member.status === 'active' && userTeams && userTeams.length > 0 ? (
              userTeams.map((t) => (
                <TooltipProvider key={t} delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/organizations?tab=teams">
                        <Badge className="hover:bg-muted/80 h-5 cursor-pointer border-transparent bg-muted px-1 py-0 text-[10px] font-normal text-muted-foreground">
                          {t}
                        </Badge>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Go to Teams page</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))
            ) : (
              <span className="text-caption">-</span>
            )}
          </div>
        </TableCell>

        {/* Role - Aligned Center */}
        <TableCell className="text-center">
          <div className="flex justify-center">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/organizations?tab=roles">
                    <Badge
                      variant="outline"
                      className={cn(
                        'cursor-pointer whitespace-nowrap px-2 py-0.5 text-xs font-normal capitalize hover:opacity-80',
                        badgeColor
                      )}
                    >
                      {member.status === 'pending' ? (
                        <>
                          <HelpCircle className="mr-1.5 h-3 w-3" /> Pending ({currentRoleName})
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-1.5 h-3 w-3" /> {currentRoleName}
                        </>
                      )}
                    </Badge>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Go to Roles page</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </TableCell>

        {/* Monthly Limit - only shown if showSpending is true */}
        {showSpending &&
          (() => {
            if (freeTrial) {
              return (
                <TableCell className="text-center">
                  <FreeTrialBadge />
                </TableCell>
              );
            }

            const canEditLimit =
              !!onEditSpendingLimit && !!member.userId && (canManageMembers || isSelf);
            const handleClick = canEditLimit
              ? () => onEditSpendingLimit!(member.userId!)
              : undefined;
            const clickableClass = canEditLimit ? 'cursor-pointer hover:underline' : '';

            return (
              <TableCell className="text-center">
                {member.status === 'pending' ? (
                  <span className="text-caption">-</span>
                ) : spendingInfo?.isLoading ? (
                  <span className="text-caption">...</span>
                ) : spendingInfo?.limit !== null && spendingInfo?.limit !== undefined ? (
                  <span className={cn('text-sm', clickableClass)} onClick={handleClick}>
                    {formatSpendAmount(spendingInfo.limit)}
                  </span>
                ) : (
                  <span
                    className={cn(
                      'text-body-muted flex items-center justify-center gap-1',
                      clickableClass
                    )}
                    onClick={handleClick}
                  >
                    <Infinity className="h-3 w-3" />
                    <span>Unlimited</span>
                  </span>
                )}
              </TableCell>
            );
          })()}

        {/* Spent - only shown if showSpending is true */}
        {showSpending && (
          <TableCell className="text-center">
            {freeTrial ? (
              <FreeTrialBadge />
            ) : member.status === 'pending' ? (
              <span className="text-caption">-</span>
            ) : spendingInfo?.isLoading ? (
              <span className="text-caption">...</span>
            ) : (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/usage" className="flex flex-col items-center gap-0.5">
                      <span
                        className={cn(
                          'text-sm font-medium hover:underline',
                          spendingInfo?.display?.isOverLimit && 'text-destructive',
                          spendingInfo?.display?.isNearLimit &&
                            !spendingInfo?.display?.isOverLimit &&
                            'text-amber-600 dark:text-amber-500'
                        )}
                      >
                        {formatSpendAmount(spendingInfo?.currentSpend ?? 0)}
                        {spendingInfo?.display && !spendingInfo.display.isUnlimited && (
                          <span className="text-caption ml-1">
                            ({spendingInfo.display.percentUsed.toFixed(0)}%)
                          </span>
                        )}
                      </span>
                      {spendingInfo?.display?.isNearLimit &&
                        !spendingInfo?.display?.isOverLimit && (
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                        )}
                      {spendingInfo?.display?.isOverLimit && (
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View usage details</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </TableCell>
        )}

        {/* Actions */}
        <TableCell className="text-right">
          <DropdownMenu>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Manage member">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manage member</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenuContent align="end" className="w-56">
              {isSelf ? (
                <>
                  <DropdownMenuLabel>My Membership</DropdownMenuLabel>
                  {isTargetOwner ? (
                    <DropdownMenuItem disabled className="text-muted-foreground">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Owner cannot leave</span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setIsLeaveDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Leave Organization</span>
                    </DropdownMenuItem>
                  )}
                </>
              ) : (
                <>
                  {member.status === 'pending' ? (
                    canManageMembers ? (
                      <>
                        <DropdownMenuLabel>Pending Invitation</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onResendInvite(member.email)}>
                          <Send className="mr-2 h-4 w-4" />
                          <span>Resend Invite</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onCancelInvite(member.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Cancel Invite</span>
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
                    )
                  ) : (
                    <>
                      {canManageMembers && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Shield className="mr-2 h-4 w-4" />
                            <span>Update role</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuRadioGroup
                                value={member.roleId ? String(member.roleId) : undefined}
                                onValueChange={(val) => {
                                  const selectedRole = roles.find((r) => String(r.id) === val);
                                  if (selectedRole && member.userId) {
                                    onUpdateRole(member.userId, selectedRole.id, selectedRole.name);
                                  }
                                }}
                              >
                                {roles.map((role) => (
                                  <DropdownMenuRadioItem
                                    key={role.id}
                                    value={String(role.id)}
                                    disabled={role.name === 'Owner'}
                                  >
                                    {role.name}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      )}

                      {isOrgOwner && !isTargetOwner && (
                        <DropdownMenuItem onClick={() => setIsTransferDialogOpen(true)}>
                          <User className="mr-2 h-4 w-4" />
                          <span>Transfer Ownership</span>
                        </DropdownMenuItem>
                      )}

                      {(canManageMembers || isOrgOwner) && <DropdownMenuSeparator />}

                      {canManageMembers && member.userId && (
                        <DropdownMenuItem onClick={() => onRemove(member.userId!)}>
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Remove Member</span>
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* Dialogs */}
      <AlertDialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to transfer ownership of this organization to{' '}
              <strong>{member.name}</strong>. They will become the new Owner and you will be
              reassigned to the Admin role. Organization billing and credits will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (member.userId) onTransferOwnership(member.userId);
                setIsTransferDialogOpen(false);
              }}
              className="hover:bg-destructive/90 bg-destructive"
            >
              Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this organization? You will lose access to all
              resources and projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (member.userId) onRemove(member.userId);
                setIsLeaveDialogOpen(false);
              }}
              className="hover:bg-destructive/90 bg-destructive"
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MemberRow;
