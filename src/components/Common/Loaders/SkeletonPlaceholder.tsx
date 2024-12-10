"use client";

import React from "react";
import { Skeleton } from "@nextui-org/react";

/**
 * SkeletonPlaceholder component displays a skeleton UI as a placeholder 
 * while the actual content is loading.
 * 
 * Usage:
 * Use this component to improve perceived performance by showing a loading
 * placeholder for content like articles, forms, or any block of text and media.
 */
const SkeletonPlaceholder = () => {
    return (
        <Skeleton className="flex rounded-md h-full w-full p-5">
            <div className="w-full rounded-md bg-default-300" />
        </Skeleton>
    );
};

export default SkeletonPlaceholder;