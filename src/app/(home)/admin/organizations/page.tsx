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
    listOrganizations: listOrganizationsAction,
    getOrganizationDetail: getOrganizationDetailAction,
    lookupUserByEmail: lookupUserByEmailAction,
    createOrganizationForUser: createOrganizationForUserAction,
    inviteUserToOrg: inviteUserToOrgAction,
    listOrgInvites: listOrgInvitesAction,
    enableFreeTrial: enableFreeTrialAction,
    disableFreeTrial: disableFreeTrialAction,
    verifyOrganization: verifyOrganizationAction,
    unverifyOrganization: unverifyOrganizationAction,
    addCredits: addCreditsAction,
    freezeAccount: freezeAccountAction,
    updateBillingProfile: updateBillingProfileAction,
  };

  const planActions: AdminOrgPlanActions = {
    getActivePlan: getActivePlanAction,
    getPlanHistory: getPlanHistoryAction,
    setPlan: setPlanAction,
    ensureStripeCustomer: ensureStripeCustomerAction,
    listTemplatesForAssignment: listBillingTemplatesAction,
    listPlanGroups: listPlanGroupsAction,
    getPlanGroup: getPlanGroupAction,
    assignPlanGroupToOrg: assignPlanGroupToOrgAction,
  };

  return (
    <div className="h-full w-full">
      <OrganizationsAdminMain actions={actions} planActions={planActions} />
    </div>
  );
};

export default AdminOrganizationsPage;
