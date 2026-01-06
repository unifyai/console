"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/UI/dialog";
import { Input } from "@/components/UI/input";
import PrimaryButton from "@/components/Common/Buttons/Primary";
import SecondaryButton from "@/components/Common/Buttons/Secondary";
import { Plus } from "lucide-react";
import { Button } from "@/components/UI/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

interface CreateTeamDialogProps {
  onCreate: (name: string, description: string) => void;
}

const CreateTeamDialog = ({ onCreate }: CreateTeamDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name, desc);
      setOpen(false);
      setName("");
      setDesc("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Create new team">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Create new team</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          <Input
            placeholder="Team Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Description (Optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <div className="flex justify-end gap-2 mt-4">
            <SecondaryButton label="Cancel" onClick={() => setOpen(false)} />
            <PrimaryButton label="Create" type="submit" disabled={!name.trim()} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTeamDialog;