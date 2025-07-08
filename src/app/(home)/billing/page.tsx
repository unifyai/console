import React from "react";
import { Metadata } from "next";
import OnPrem from "@/components/Shared/OnPrem";
import Main from "@/components/Pages/Billing/Main";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Billing",
};

const BillingPage: React.FC = async () => {
  const onPrem = process.env.ON_PREM;

  return (
    <div className="w-full h-full p-1 overflow-auto">
      <Suspense fallback={<SkeletonLoader />}>
        {onPrem ? <OnPrem /> : <Main />}
      </Suspense>
    </div>
  );
};

export default BillingPage;