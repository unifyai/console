/**
 * Admin Organizations Page
 *
 * Centralized dashboard for Unify admins to manage organizations:
 * - Browse / search all organizations
 * - Create organizations on behalf of users
 * - Toggle free trial & verification status
 * - Basic billing management (add credits, freeze/unfreeze)
 * - Invite users to organizations
 *
 * Access: Unify organization Owner or Admin only.
 */

import * as React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user/user';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { Terminal } from 'lucide-react';
import OrganizationsAdminMain from '@/components/Pages/Admin/OrganizationsMain';
import {
  listOrganizationsAction,
  getOrganizationDetailAction,
  lookupUserByEmailAction,
  createOrganizationForUserAction,
  inviteUserToOrgAction,
  listOrgInvitesAction,
  enableFreeTrialAction,
  disableFreeTrialAction,
  verifyOrganizationAction,
  unverifyOrganizationAction,
  addCreditsAction,
  freezeAccountAction,
} from '@/lib/admin/organizations';
import type { AdminOnboardingActions } from '@/types/admin';

const AdminOrganizationsPage = async () => {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?signout=true');
  }

  // Only Unify org Owner / Admin may access
  const isUnifyAdmin =
    user.organizations.find(
      (o) =>
        o.name === 'Unify' &&
        ['owner', 'admin'].includes(o.roleName?.toLowerCase() ?? '')
    ) !== undefined;

  if (!isUnifyAdmin) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="w-auto max-w-md">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You must be a Unify organization admin to access the organizations
            dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const actions: AdminOnboardingActions = {
    listOrganizations: await listOrganizationsAction(),
    getOrganizationDetail: await getOrganizationDetailAction(),
    lookupUserByEmail: await lookupUserByEmailAction(),
    createOrganizationForUser: await createOrganizationForUserAction(),
    inviteUserToOrg: await inviteUserToOrgAction(),
    listOrgInvites: await listOrgInvitesAction(),
    enableFreeTrial: await enableFreeTrialAction(),
    disableFreeTrial: await disableFreeTrialAction(),
    verifyOrganization: await verifyOrganizationAction(),
    unverifyOrganization: await unverifyOrganizationAction(),
    addCredits: await addCreditsAction(),
    freezeAccount: await freezeAccountAction(),
  };

  return (
    <div className="h-full w-full">
      <OrganizationsAdminMain actions={actions} />
    </div>
  );
};

export default AdminOrganizationsPage;

