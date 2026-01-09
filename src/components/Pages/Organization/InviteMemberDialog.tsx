'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/UI/dialog';
import { Input } from '@/components/UI/input';
import PrimaryButton from '@/components/Common/Buttons/Primary';
import SecondaryButton from '@/components/Common/Buttons/Secondary';
import { UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Button } from '@/components/UI/button';
import { OrganizationMember } from '@/types/organization';

interface InviteMemberDialogProps {
  onInvite: (email: string) => Promise<{ success: boolean; error?: string }>;
  existingMembers: OrganizationMember[];
}

const InviteMemberDialog = ({ onInvite, existingMembers }: InviteMemberDialogProps) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear error when email changes to improve UX
  // error is intentionally omitted to prevent infinite loop - we only want to clear on email change
  useEffect(() => {
    if (error) setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    // 1. Check for empty
    if (!trimmedEmail) {
      setError('Email address is required.');
      return;
    }

    // 2. Check format
    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    // 3. Check for existing member (case-insensitive)
    const isAlreadyMember = existingMembers.some(
      (m) => m.email?.toLowerCase() === trimmedEmail.toLowerCase()
    );

    if (isAlreadyMember) {
      setError('This user is already a member of the organization.');
      return;
    }

    // If valid, proceed with invite (which now checks if user is in another org)
    setIsSubmitting(true);
    try {
      const result = await onInvite(trimmedEmail);
      if (result.success) {
        setOpen(false);
        setEmail('');
        setError(null);
      } else if (result.error) {
        setError(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEmail('');
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 gap-2"
                aria-label="Invite a new member"
              >
                <UserPlus className="h-8 w-8" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Invite a new member to the organization</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-[425px]">
        <div className="flex flex-col gap-2">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-4" noValidate>
            {/* Input Container with Error Message */}
            <div className="space-y-2">
              <Input
                id="email"
                type="email"
                placeholder="colleague@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                className={error ? 'border-destructive focus-visible:ring-destructive' : ''}
              />

              {/* Validation Error Message */}
              {error && (
                <div className="mt-1 flex items-center text-sm text-destructive duration-200 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="mr-1.5 h-3 w-3 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <SecondaryButton
                label="Cancel"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              />
              <PrimaryButton
                label={isSubmitting ? 'Checking...' : 'Invite'}
                type="submit"
                disabled={isSubmitting}
                icon={isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              />
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteMemberDialog;
