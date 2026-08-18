'use client';

import React, { useState } from 'react';
import { Loader2, UserSearch } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/UI/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { useResolvedProfileImage } from '@/hooks/User/useProfileImageResolver';
import { toast } from 'sonner';
import {
  lookupImpersonationTarget,
  impersonateUser,
  type ImpersonationTarget,
} from '@/lib/admin/impersonation';
import type { ResponseProps } from '@/types/common';

function isTarget(result: ImpersonationTarget | ResponseProps): result is ImpersonationTarget {
  return typeof (result as ImpersonationTarget).id === 'string' && !('status' in result);
}

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

interface ImpersonateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImpersonateDialog({ open, onOpenChange }: ImpersonateDialogProps) {
  const [email, setEmail] = useState('');
  const [target, setTarget] = useState<ImpersonationTarget | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const targetImageUrl = useResolvedProfileImage(target?.image);

  const reset = () => {
    setEmail('');
    setTarget(null);
    setIsLooking(false);
    setIsStarting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleLookup = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setIsLooking(true);
    setTarget(null);
    try {
      const result = await lookupImpersonationTarget(trimmed);
      if (isTarget(result)) {
        setTarget(result);
      } else {
        toast.error('No user found with that email.');
      }
    } catch (error) {
      console.error('Impersonation lookup failed', error);
      toast.error('Could not look up that user. Please try again.');
    } finally {
      setIsLooking(false);
    }
  };

  const handleConfirm = async () => {
    if (!target) return;
    setIsStarting(true);
    try {
      const result = await impersonateUser(target.email);
      if (result) {
        toast.error('Could not start viewing as that user. Please try again.');
        setIsStarting(false);
        return;
      }
      // Full reload so every server component re-resolves under the new session.
      window.location.assign('/');
    } catch (error) {
      console.error('Impersonation failed', error);
      toast.error('Could not start viewing as that user. Please try again.');
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="impersonate-dialog">
        <DialogHeader>
          <DialogTitle>View as user</DialogTitle>
          <DialogDescription>
            Sign in as another user to see the platform from their perspective. Your own session is
            restored when you stop viewing.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleLookup();
          }}
        >
          <div className="flex-1">
            <label
              className="text-caption mb-1 block text-muted-foreground"
              htmlFor="impersonate-email"
            >
              User email
            </label>
            <Input
              id="impersonate-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setTarget(null);
              }}
              data-testid="impersonate-email-input"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={isLooking || !email.trim()}
            data-testid="impersonate-lookup"
          >
            {isLooking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserSearch className="h-4 w-4" />
            )}
          </Button>
        </form>

        {target && (
          <div
            className="bg-muted/40 flex items-center gap-3 rounded-md border border-border p-3"
            data-testid="impersonate-target"
          >
            <Avatar className="rounded-control h-8 w-8">
              <AvatarImage src={targetImageUrl ?? undefined} alt="" />
              <AvatarFallback className="rounded-control text-label bg-primary text-primary-foreground">
                {getInitials(target.name || target.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-body truncate font-medium">{target.name || target.email}</p>
              <p className="text-caption truncate text-muted-foreground">{target.email}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isStarting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!target || isStarting}
            data-testid="impersonate-confirm"
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Switching…
              </>
            ) : (
              'View as user'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
