import React from "react";
import { Metadata } from "next";
import OnPrem from "@/components/Shared/OnPrem";
import Main from "@/components/Pages/Billing/Main";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/user/user";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Billing",
};

const BillingPage: React.FC = async () => {

  const user = await getCurrentUser();  
  if (!user) {
    redirect('/login');
  }
  const onPrem = process.env.ON_PREM;
  if (onPrem) {
    return (
        <div className="w-full h-full p-1 overflow-auto">
            <Suspense fallback={<SkeletonLoader />}>
                <OnPrem />
            </Suspense>
        </div>
    )
  }

  const cookieStore = cookies();
  const workspaceId = cookieStore.get("unify_workspace_id")?.value;
  if (workspaceId && workspaceId !== 'personal') {
    const activeOrg = user.organizations?.find(o => o.id.toString() === workspaceId);    
    if (activeOrg) {
        const roleName = activeOrg.roleName?.toLowerCase();
        if (roleName !== 'owner' && roleName !== 'admin') {
            redirect('/profile');
        }
    } else {
        redirect('/profile');
    }
  }

  return (
    <div className="w-full h-full p-1 overflow-auto">
      <Suspense fallback={<SkeletonLoader />}>
        <Main />
      </Suspense>
    </div>
  );
};

export default BillingPage;