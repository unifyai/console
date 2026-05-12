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
  updateBillingProfileAction,
} from '@/lib/admin/organizations';
import {
  assignPlanGroupToOrgAction,
  ensureStripeCustomerAction,
  getActivePlanAction,
  getPlanGroupAction,
  getPlanHistoryAction,
  listBillingTemplatesAction,
  listPlanGroupsAction,
  setPlanAction,
} from '@/lib/admin/billing-plans';
import type { AdminOnboardingActions, AdminOrgPlanActions } from '@/types/admin';

const AdminOrganizationsPage = async () => {
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
    updateBillingProfile: await updateBillingProfileAction(),
  };

  const planActions: AdminOrgPlanActions = {
    getActivePlan: await getActivePlanAction(),
    getPlanHistory: await getPlanHistoryAction(),
    setPlan: await setPlanAction(),
    ensureStripeCustomer: await ensureStripeCustomerAction(),
    listTemplatesForAssignment: await listBillingTemplatesAction(),
    listPlanGroups: await listPlanGroupsAction(),
    getPlanGroup: await getPlanGroupAction(),
    assignPlanGroupToOrg: await assignPlanGroupToOrgAction(),
  };

  return (
    <div className="h-full w-full">
      <OrganizationsAdminMain actions={actions} planActions={planActions} />
    </div>
  );
};

export default AdminOrganizationsPage;
