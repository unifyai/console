"use client";

import React from "react";
import { Suspense } from "react";
import LoadingIcon from "./LoadingIcon";

/**
 * SuspenseLoader component provides a fallback UI using React's Suspense.
 * 
 * Props:
 * - message: A message to display above the loading icon to inform users about the loading content.
 * - children: The content to load once ready. This should be components or data that may load asynchronously.
 * 
 * Usage:
 * Wrap components that load asynchronously with SuspenseLoader to provide a consistent loading
 * UI and message to users while waiting for content to load.
 */
const SuspenseLoader = ({
    message,
    children,
}: {
    message: string;
    children?: React.ReactNode;
}) => {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col gap-2 items-center self-center">
                    <p className="text-foreground">{message}</p>
                    <LoadingIcon height={100} width={100} />
                </div>
            }
        >
            {children}
        </Suspense>
    );
};

export default SuspenseLoader;