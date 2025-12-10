"use client";

import { Building } from "lucide-react";
import CreateOrgDialog from "./CreateOrganizationDialog";
import { OrganizationListResponse } from "@/types/organization";
import { ResponseProps } from "@/types/common";

interface PersonalWorkspaceViewProps {
  onCreateOrg: (name: string) => void;
  checkNameAvailability: (name: string) => Promise<OrganizationListResponse | ResponseProps>;
}

const PersonalWorkspaceView = ({ onCreateOrg, checkNameAvailability }: PersonalWorkspaceViewProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-neutral-50/50 dark:bg-neutral-900/20">
      <div className="flex flex-col items-center max-w-md text-center space-y-6">
        <div className="p-4 rounded-2xl shadow-sm">
            <Building className="w-10 h-10 text-neutral-600 dark:text-neutral-400" />
        </div>

        <div className="space-y-2">
            <h2 className="text-h2">Personal Workspace</h2>
            <p className="text-body text-muted-foreground">
            Switch to an organization workspace to start collaborating with your teammates, or create a new organization.
            </p>
        </div>

        <CreateOrgDialog onCreate={onCreateOrg} checkNameAvailability={checkNameAvailability} />
      </div>
    </div>
  );
};

export default PersonalWorkspaceView;