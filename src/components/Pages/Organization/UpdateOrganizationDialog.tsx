'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/UI/dialog';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import PrimaryButton from '@/components/Common/Buttons/Primary';
import SecondaryButton from '@/components/Common/Buttons/Secondary';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';

interface UpdateOrgDialogProps {
  currentName: string;
  currentTimezone?: string | null;
  onUpdate: (name: string, timezone?: string | null) => void;
}

const UpdateOrgDialog = ({ currentName, currentTimezone, onUpdate }: UpdateOrgDialogProps) => {
  const [open, setOpen] = useState(false);
  const [orgName, setOrgName] = useState(currentName);
  const [timezone, setTimezone] = useState(currentTimezone || '');

  const timezoneOptions = useMemo(() => generateTimezoneOptions(), []);

  const hasChanges = orgName !== currentName || timezone !== (currentTimezone || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orgName.trim() && hasChanges) {
      onUpdate(orgName, timezone || null);
      setOpen(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setOrgName(currentName);
      setTimezone(currentTimezone || '');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Update organization"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Update organization</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              placeholder="Organization Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select a timezone..." />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-caption text-muted-foreground">
              This timezone will be used for organization-wide scheduling and reporting.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <SecondaryButton label="Cancel" onClick={() => setOpen(false)} />
            <PrimaryButton label="Update" type="submit" disabled={!orgName.trim() || !hasChanges} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateOrgDialog;
