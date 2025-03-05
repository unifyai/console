"use client";

import React from "react";
import { Skeleton } from "@/components/UI/skeleton";

const SkeletonLoader = () => {
    return (
        <div className="h-full w-full bg-transparent" style={{ backgroundColor: 'transparent', backgroundImage: 'none' }}>
            <Skeleton className="flex rounded-md h-full w-full bg-transparent" style={{ backgroundColor: 'transparent', backgroundImage: 'none' }}>
                <div className="w-full rounded-md bg-transparent" style={{ backgroundColor: 'transparent', backgroundImage: 'none' }} />
            </Skeleton>
        </div>
    );
};

export default SkeletonLoader;
