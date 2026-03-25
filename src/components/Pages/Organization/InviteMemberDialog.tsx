'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/UI/dialog';
import { Input } from '@/components/UI/input';
import PrimaryButton from '@/components/Common/Buttons/Primary';
import SecondaryButton from '@/components/Common/Buttons/Secondary';
import { UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Button } from '@/components/UI/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { OrganizationMember, OrganizationRole } from '@/types/organization';
import { Label } from '@/components/UI/label';

interface InviteMemberDialogProps {
  onInvite: (email: string, roleId?: number) => Promise<{ success: boolean; error?: string }>;
  existingMembers: OrganizationMember[];
  roles: OrganizationRole[];
}

const InviteMemberDialog = ({ onInvite, existingMembers, roles }: InviteMemberDialogProps) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assignableRoles = roles.filter((r) => r.name !== 'Owner');
  const defaultRole = assignableRoles.find((r) => r.name === 'Member');

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
      const roleId = selectedRoleId ? Number(selectedRoleId) : defaultRole?.id;
      const result = await onInvite(trimmedEmail, roleId);
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
      setSelectedRoleId('');
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

      <DialogContent>
        <div className="flex flex-col gap-2">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-4" noValidate>
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                className={error ? 'border-destructive focus-visible:ring-destructive' : ''}
              />

              {error && (
                <div className="text-body text-error mt-1 flex items-center duration-200 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="mr-1.5 h-3 w-3 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Role Selector */}
            {assignableRoles.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={selectedRoleId || String(defaultRole?.id ?? '')}
                  onValueChange={setSelectedRoleId}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((role) => (
                      <SelectItem key={role.id} value={String(role.id)}>
                        {role.name}
                        {role.description ? ` — ${role.description}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
