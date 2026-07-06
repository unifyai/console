'use client';

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

export default function AdminPlansPanel() {
  return (
    <div className="h-full w-full">
      <BillingPlansAdminMain actions={actions} />
    </div>
  );
}
