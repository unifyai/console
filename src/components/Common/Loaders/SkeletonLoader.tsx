"use client";

import React from "react";
import { Skeleton } from "@/components/UI/skeleton";

const SkeletonLoader = () => {
    return (
        <Skeleton className="flex rounded-md h-full w-full">
            <div className="w-full rounded-md bg-muted"/>
        </Skeleton>
    );
};

export default SkeletonLoader;
