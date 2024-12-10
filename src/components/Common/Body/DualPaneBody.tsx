"use client";

import { ReactNode, useState } from "react";
import { useSearchParams } from "next/navigation";
import SkeletonLoader from "../Loaders/SkeletonLoader";

const DualPaneBody = ({isPending, leftPane, rightPane}: {isPending: boolean, leftPane: ReactNode, rightPane: ReactNode}) => {

    const currentSearchParams = useSearchParams();
    const [searchParams, setSearchParams] = useState<{[key: string]: string}>(Object.fromEntries(
        currentSearchParams ? currentSearchParams.entries() : []
    ));
    const foldPanel = searchParams?.panel || "dual";

    return (
    <div className="flex flex-col lg:flex-row gap-2 w-full h-full justify-between">
        {foldPanel === "right" ? null :
          <div className= {`w-full h-full bg-background rounded-md ${foldPanel != "left" ? "lg:max-w-[50%] max-h-[50%] lg:max-h-[100%]" : ""}`}>
            {isPending ? <SkeletonLoader/> : leftPane}
          </div>
        }
        {foldPanel === "right" ? null :
          <div className= {`w-full h-full rounded-md ${foldPanel != "right" ? "lg:max-w-[50%] max-h-[50%] lg:max-h-[100%]" : ""}`}>
            {isPending ? <SkeletonLoader/> : rightPane}
          </div> 
        }
      </div>
    );
}

export default DualPaneBody;
