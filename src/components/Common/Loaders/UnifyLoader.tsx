"use client";

import React from "react";
import { Suspense } from "react";
import LoadingElement from "./LoadingElement";

export const UnifyLoader = ({message, children}: {message: string, children?: React.ReactNode}) => {
    return (
        <Suspense fallback={
            <div className="flex flex-col gap-2 items-center self-center">
                <p className="text-muted-foreground">{message}</p>
                <LoadingElement height={100} width={100}/>
            </div>

        }>
            {children}
        </Suspense>
    );
};