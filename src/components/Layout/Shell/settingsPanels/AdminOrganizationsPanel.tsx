'use client';

import OrganizationsAdminMain from '@/components/Pages/Admin/OrganizationsMain';
import {
  addCreditsAction,
  createOrganizationForUserAction,
  disableFreeTrialAction,
  enableFreeTrialAction,
  freezeAccountAction,
  getOrganizationDetailAction,
  inviteUserToOrgAction,
  listOrgInvitesAction,
  listOrganizationsAction,
  lookupUserByEmailAction,
  unverifyOrganizationAction,
  updateBillingProfileAction,
  verifyOrganizationAction,
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

export default function AdminOrganizationsPanel() {
  return (
    <div className="h-full w-full">
      <OrganizationsAdminMain actions={actions} planActions={planActions} />
    </div>
  );
}
