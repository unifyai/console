"use client";

import { ReactNode } from "react";
import SkeletonLoader from "../Loaders/SkeletonLoader";

const SinglePaneBody = ({isPending, body}: {isPending: boolean, body: ReactNode}) => {

    return (
        <div className="bg-background rounded-md h-full overflow-y-scroll p-3">
            <div className="flex flex-col gap-3 h-full w-full">
                {isPending ? <SkeletonLoader /> : body}
            </div>
        </div>
    );
}

export default SinglePaneBody;
