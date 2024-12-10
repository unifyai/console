import React from "react";
import { Metadata } from "next";
import OnPrem from "@/components/OnPrem";
import Main from "@/components/Billing/Main";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Billing",
};

const BillingPage: React.FC = async () => {
  const onPrem = process.env.ON_PREM;


  return (
    <Suspense fallback={<SkeletonLoader />}>
      {onPrem ? <OnPrem /> : <Main/>}
    </Suspense>
  );
};

export default BillingPage;