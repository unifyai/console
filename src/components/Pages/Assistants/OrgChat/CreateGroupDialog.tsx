'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Checkbox } from '@/components/UI/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { useResolvedProfileImage } from '@/hooks/User/useProfileImageResolver';
import { ScrollArea } from '@/components/UI/scroll-area';
import type { RosterGroup, RosterHuman } from '@/types/orgChat';
import { parseRosterGroup } from '@/types/orgChat';
import { profileAvatarTone, profileInitials } from '@/utils/user/profileDisplay';
import { toast } from 'sonner';

export interface GroupDialogAssistantOption {
  agentId: string;
  name: string;
  image?: string | null;
}

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  currentUserId: string | null;
  humans: RosterHuman[];
  assistants: GroupDialogAssistantOption[];
  /** When set, the dialog edits an existing group instead of creating one. */
  editingGroup?: RosterGroup | null;
  onCreated?: (group: RosterGroup) => void;
  onUpdated?: (group: RosterGroup) => void;
}

/**
 * Create / manage-members dialog for org chat groups: optional name plus
 * multi-select of humans and assistants. The creator is always a member
 * (server-enforced) and shown locked when creating.
 */
export function CreateGroupDialog({
  open,
  onOpenChange,
  orgId,
  currentUserId,
  humans,
  assistants,
  editingGroup = null,
  onCreated,
  onUpdated,
}: CreateGroupDialogProps) {
  const isEdit = Boolean(editingGroup);
  const [name, setName] = React.useState('');
  const [selectedUserIds, setSelectedUserIds] = React.useState<Set<string>>(new Set());
  const [selectedAssistantIds, setSelectedAssistantIds] = React.useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editingGroup) {
      setName(editingGroup.name);
      setSelectedUserIds(new Set(editingGroup.memberUserIds));
      setSelectedAssistantIds(new Set(editingGroup.assistantMemberIds));
      return;
    }
    setName('');
    setSelectedUserIds(new Set(currentUserId ? [currentUserId] : []));
    setSelectedAssistantIds(new Set());
  }, [open, editingGroup, currentUserId]);

  const selectableHumans = React.useMemo(
    () => humans.filter((human) => human.userId !== currentUserId),
    [humans, currentUserId]
  );

  const toggleUser = (userId: string) => {
    if (userId === currentUserId && !isEdit) return;
    if (isEdit && userId === editingGroup?.createdByUserId) return;
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAssistant = (assistantId: number) => {
    setSelectedAssistantIds((prev) => {
      const next = new Set(prev);
      if (next.has(assistantId)) next.delete(assistantId);
      else next.add(assistantId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!orgId) return;
    const otherUserIds = [...selectedUserIds].filter((id) => id !== currentUserId);
    if (!isEdit && otherUserIds.length === 0 && selectedAssistantIds.size === 0) {
      toast('Pick at least one teammate for the group.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEdit && editingGroup) {
        const response = await fetch(`/api/organizations/${orgId}/groups/${editingGroup.groupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim() || editingGroup.name,
            userIds: [...selectedUserIds],
            assistantIds: [...selectedAssistantIds],
          }),
        });
        if (!response.ok) throw new Error('update failed');
        const data = await response.json();
        onUpdated?.(parseRosterGroup(data));
        onOpenChange(false);
        return;
      }

      const response = await fetch(`/api/organizations/${orgId}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          userIds: otherUserIds,
          assistantIds: [...selectedAssistantIds],
        }),
      });
      if (!response.ok) throw new Error('create failed');
      const data = await response.json();
      onCreated?.(parseRosterGroup(data));
      onOpenChange(false);
    } catch {
      console.error(isEdit ? 'Failed to update chat group' : 'Failed to create chat group');
      toast(
        isEdit
          ? 'Could not update group. Please try again.'
          : 'Could not create group. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentUser = humans.find((h) => h.userId === currentUserId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="create-group-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Manage members' : 'New group'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="group-name" className="text-label text-semibold">
              Name <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design sync"
              data-testid="create-group-name-input"
            />
          </div>

          <div className="space-y-2">
            <div className="text-label text-semibold">People</div>
            <ScrollArea className="h-44 rounded-md border">
              <div className="space-y-0.5 p-2">
                {currentUser ? (
                  <MemberRow
                    name={`${currentUser.name?.trim() || currentUser.email || 'You'} (you)`}
                    image={currentUser.image}
                    checked
                    disabled
                    onToggle={() => undefined}
                    testId={`create-group-human-${currentUser.userId}`}
                  />
                ) : null}
                {selectableHumans.map((human) => {
                  const locked = isEdit && human.userId === editingGroup?.createdByUserId;
                  return (
                    <MemberRow
                      key={human.userId}
                      name={human.name?.trim() || human.email || human.userId}
                      image={human.image}
                      checked={selectedUserIds.has(human.userId)}
                      disabled={locked}
                      onToggle={() => toggleUser(human.userId)}
                      testId={`create-group-human-${human.userId}`}
                    />
                  );
                })}
                {selectableHumans.length === 0 && !currentUser ? (
                  <p className="text-caption px-2 py-3 text-muted-foreground">
                    No people available.
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <div className="text-label text-semibold">Assistants</div>
            <ScrollArea className="h-36 rounded-md border">
              <div className="space-y-0.5 p-2">
                {assistants.length === 0 ? (
                  <p className="text-caption px-2 py-3 text-muted-foreground">
                    No assistants available.
                  </p>
                ) : (
                  assistants.map((assistant) => (
                    <MemberRow
                      key={assistant.agentId}
                      name={assistant.name}
                      image={assistant.image}
                      checked={selectedAssistantIds.has(Number(assistant.agentId))}
                      onToggle={() => toggleAssistant(Number(assistant.agentId))}
                      testId={`create-group-assistant-${assistant.agentId}`}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            data-testid="create-group-submit"
          >
            {isSubmitting ? 'Saving…' : isEdit ? 'Save' : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({
  name,
  image,
  checked,
  disabled,
  onToggle,
  testId,
}: {
  name: string;
  image?: string | null;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  testId: string;
}) {
  const imageUrl = useResolvedProfileImage(image);
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted disabled:cursor-default disabled:opacity-70"
    >
      <Checkbox checked={checked} disabled={disabled} aria-hidden="true" tabIndex={-1} />
      <Avatar className="rounded-control h-7 w-7">
        <AvatarImage src={imageUrl ?? undefined} alt={name} />
        <AvatarFallback
          className="rounded-control text-[10px] font-semibold text-primary-foreground"
          style={{ backgroundColor: profileAvatarTone(name) }}
        >
          {profileInitials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-body truncate">{name}</span>
    </button>
  );
}
