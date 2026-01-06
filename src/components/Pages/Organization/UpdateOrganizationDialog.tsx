"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/UI/dialog";
import { Input } from "@/components/UI/input";
import PrimaryButton from "@/components/Common/Buttons/Primary";
import SecondaryButton from "@/components/Common/Buttons/Secondary";
import { Pencil } from "lucide-react";
import { Button } from "@/components/UI/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

interface UpdateOrgDialogProps {
  currentName: string;
  onUpdate: (name: string) => void;
}

const UpdateOrgDialog = ({ currentName, onUpdate }: UpdateOrgDialogProps) => {
  const [open, setOpen] = useState(false);
  const [orgName, setOrgName] = useState(currentName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orgName.trim() && orgName !== currentName) {
      onUpdate(orgName);
      setOpen(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
      setOpen(isOpen);
      if(isOpen) setOrgName(currentName);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Update organization">
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
            <p className="text-sm text-muted-foreground">
              Enter a new name for your organization.
            </p>
          </div>
          <Input
            id="name"
            placeholder="Organization Name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="col-span-3"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <SecondaryButton label="Cancel" onClick={() => setOpen(false)} />
            <PrimaryButton label="Update" type="submit" disabled={!orgName.trim() || orgName === currentName} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateOrgDialog;