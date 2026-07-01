/**
 * Admin Billing Plans Page
 *
 * Two-tab dashboard rendered by `BillingPlansAdminMain`:
 *   - Plans tab: catalog of `BillingPlanTemplate` rows the operator
 *     can browse, create, deprecate, and filter by group membership.
 *   - Groups tab: catalog of `BillingPlanGroup` rows (curated bundles
 *     of switchable templates) the operator can create + edit.
 *
 * Per-account assignment of templates AND plan groups lives on the
 * /admin/organizations detail panel — not here.
 *
 * Access: Unify organization Owner or Admin only (enforced by the
 * /admin layout).
 */

import * as React from 'react';
import BillingPlansAdminMain from '@/components/Pages/Admin/BillingPlansMain';
import {
  addPlanGroupMemberAction,
  createBillingTemplateAction,
  createPlanGroupAction,
  deprecateBillingTemplateAction,
  getPlanGroupAction,
  listBillingTemplatesAction,
  listPlanGroupsAction,
  removePlanGroupMemberAction,
  setPlanGroupPositionsAction,
  updatePlanGroupAction,
} from '@/lib/admin/billing-plans';
import type { AdminBillingPlansActions } from '@/types/admin';

const AdminBillingPlansPage = async () => {
  const actions: AdminBillingPlansActions = {
    listTemplates: listBillingTemplatesAction,
    createTemplate: createBillingTemplateAction,
    deprecateTemplate: deprecateBillingTemplateAction,
    listGroups: listPlanGroupsAction,
    getGroup: getPlanGroupAction,
    createGroup: createPlanGroupAction,
    updateGroup: updatePlanGroupAction,
    addMember: addPlanGroupMemberAction,
    removeMember: removePlanGroupMemberAction,
    setPositions: setPlanGroupPositionsAction,
  };

  return (
    <div className="h-full w-full">
      <BillingPlansAdminMain actions={actions} />
    </div>
  );
};

export default AdminBillingPlansPage;
