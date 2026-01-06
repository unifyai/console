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
import { Plus, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/UI/button";
import { OrganizationListItem, OrganizationListResponse } from "@/types/organization";
import { ResponseProps } from "@/types/common";

interface CreateOrgDialogProps {
  onCreate: (name: string) => void;
  checkNameAvailability: (name: string) => Promise<OrganizationListResponse | ResponseProps>;
}

const CreateOrgDialog = ({ onCreate, checkNameAvailability }: CreateOrgDialogProps) => {
  const [open, setOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = orgName.trim();
    if (!trimmedName) return;

    setIsValidating(true);

    try {
      // Validate if organization name already exists
      const result = await checkNameAvailability(trimmedName);

      if ("detail" in result) {
        setError("Failed to validate organization name. Please try again.");
        setIsValidating(false);
        return;
      }

      // Check for exact match (backend does partial match)
      const exists = (result.organizations as OrganizationListItem[]).some(
        (org) => org.name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (exists) {
        setError("An organization with this name already exists.");
        setIsValidating(false);
        return;
      }

      // If valid, proceed with creation
      onCreate(trimmedName);
      setOpen(false);
      setOrgName("");
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setOrgName("");
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus className="mr-2 h-4 w-4" />
          Create organization
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-4">
          <div className="space-y-2">
            <Input
                id="name"
                placeholder="Acme Corp"
                value={orgName}
                onChange={(e) => {
                    setOrgName(e.target.value);
                    if (error) setError(null);
                }}
                className={error ? "border-destructive focus-visible:ring-destructive" : ""}
                autoFocus
                disabled={isValidating}
            />
            {error && (
                <div className="flex items-center text-destructive text-sm animate-in slide-in-from-top-1 fade-in duration-200">
                    <AlertCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <SecondaryButton label="Cancel" onClick={() => handleOpenChange(false)} disabled={isValidating} />
            <PrimaryButton 
                label={isValidating ? "Checking..." : "Create"} 
                type="submit" 
                disabled={!orgName.trim() || isValidating} 
                icon={isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrgDialog;