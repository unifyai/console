"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/UI/dialog";
import { Input } from "@/components/UI/input";
import PrimaryButton from "@/components/Common/Buttons/Primary";
import SecondaryButton from "@/components/Common/Buttons/Secondary";

interface UpdateRoleDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  initialName: string;
  initialDescription: string;
  onUpdate: (name: string, description: string) => void;
}

const UpdateRoleDialog = ({ open, setOpen, initialName, initialDescription, onUpdate }: UpdateRoleDialogProps) => {
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDescription);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDesc(initialDescription || "");
    }
  }, [open, initialName, initialDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onUpdate(name, desc);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          <h3 className="text-lg font-medium">Update Role</h3>
          <Input
            placeholder="Role Name"
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
            <PrimaryButton label="Update" type="submit" disabled={!name.trim()} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateRoleDialog;