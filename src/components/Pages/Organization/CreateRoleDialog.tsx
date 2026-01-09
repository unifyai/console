"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/UI/dialog";
import { Input } from "@/components/UI/input";
import PrimaryButton from "@/components/Common/Buttons/Primary";
import SecondaryButton from "@/components/Common/Buttons/Secondary";
import { Plus } from "lucide-react";
import { Button } from "@/components/UI/button";
import { Permission } from "@/types/role";
import { Checkbox } from "@/components/UI/checkbox";
import { Label } from "@/components/UI/label";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

interface CreateRoleDialogProps {
  onCreate: (name: string, description: string, permissionIds: number[]) => void;
  availablePermissions: Permission[];
}

const CreateRoleDialog = ({ onCreate, availablePermissions }: CreateRoleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name, desc, selectedPermissions);
      setOpen(false);
      setName("");
      setDesc("");
      setSelectedPermissions([]);
    }
  };

  const togglePermission = (id: number) => {
    setSelectedPermissions(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Create new role">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Create new role</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-4">
            <div className="space-y-4">
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
            </div>
            <div className="border rounded-md p-2">
                <p className="text-sm font-medium mb-2 text-muted-foreground">Permissions</p>
                <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                        {availablePermissions.map(p => (
                            <div key={p.id} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={`perm-${p.id}`} 
                                    checked={selectedPermissions.includes(p.id)}
                                    onCheckedChange={() => togglePermission(p.id)}
                                />
                                <Label htmlFor={`perm-${p.id}`} className="text-sm cursor-pointer">
                                    {p.name} <span className="text-xs text-muted-foreground">({p.resourceType}:{p.action})</span>
                                </Label>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <SecondaryButton label="Cancel" onClick={() => setOpen(false)} />
            <PrimaryButton label="Create" type="submit" disabled={!name.trim()} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoleDialog;