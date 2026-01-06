"use client";

import { Building, Info } from "lucide-react";
import CreateOrgDialog from "./CreateOrganizationDialog";
import { OrganizationListResponse } from "@/types/organization";
import { ResponseProps } from "@/types/common";
import { Alert, AlertDescription } from "@/components/UI/alert";

interface PersonalWorkspaceViewProps {
  onCreateOrg: (name: string) => void;
  checkNameAvailability: (name: string) => Promise<OrganizationListResponse | ResponseProps>;
  isAlreadyInOrganization?: boolean;
}

const PersonalWorkspaceView = ({ onCreateOrg, checkNameAvailability, isAlreadyInOrganization = false }: PersonalWorkspaceViewProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-neutral-50/50 dark:bg-neutral-900/20">
      <div className="flex flex-col items-center max-w-md text-center space-y-6">
        <div className="p-4 rounded-2xl shadow-sm">
            <Building className="w-10 h-10 text-neutral-600 dark:text-neutral-400" />
        </div>

        <div className="space-y-2">
            <h2 className="text-h2">Personal Workspace</h2>
            <p className="text-body text-muted-foreground">
            {isAlreadyInOrganization 
              ? "Switch to your organization workspace using the dropdown in the top navigation."
              : "Create an organization to start collaborating with your teammates."
            }
            </p>
        </div>

        {!isAlreadyInOrganization && ( 
          <CreateOrgDialog onCreate={onCreateOrg} checkNameAvailability={checkNameAvailability} />
        )}
      </div>
    </div>
  );
};

export default PersonalWorkspaceView;