'use client';

import { Building, Info } from 'lucide-react';
import CreateOrgDialog from './CreateOrganizationDialog';
import { OrganizationListResponse } from '@/types/organization';
import { ResponseProps } from '@/types/common';
import { Alert, AlertDescription } from '@/components/UI/alert';

interface PersonalWorkspaceViewProps {
  onCreateOrg: (name: string) => void;
  checkNameAvailability: (name: string) => Promise<OrganizationListResponse | ResponseProps>;
  isAlreadyInOrganization?: boolean;
  isUnifyMember?: boolean;
}

const PersonalWorkspaceView = ({
  onCreateOrg,
  checkNameAvailability,
  isAlreadyInOrganization = false,
  isUnifyMember = false,
}: PersonalWorkspaceViewProps) => {
  const showCreateButton = isUnifyMember || !isAlreadyInOrganization;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-50/50 dark:bg-neutral-900/20">
      <div className="flex max-w-md flex-col items-center space-y-6 text-center">
        <div className="rounded-2xl p-4 shadow-sm">
          <Building className="h-10 w-10 text-neutral-600 dark:text-neutral-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-h2">Personal Workspace</h2>
          <p className="text-body text-muted-foreground">
            {!showCreateButton
              ? 'Switch to your organization workspace using the dropdown in the top navigation.'
              : 'Create an organization to start collaborating with your teammates.'}
          </p>
        </div>

        {showCreateButton && (
          <CreateOrgDialog onCreate={onCreateOrg} checkNameAvailability={checkNameAvailability} />
        )}
      </div>
    </div>
  );
};

export default PersonalWorkspaceView;
