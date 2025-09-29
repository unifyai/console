"use client";

import React from "react";
import Image from "next/image";
import ErrorImage from "@/public/images/404.png";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <div className="flex justify-center mt-32">
            <div className="flex flex-col gap-2 max-w-xl items-center text-center">
                <Image src={ErrorImage} className="max-w-xl" alt="Unify Logo" />
                <h1 className="text-h1 text-strong">Something went wrong</h1>
                <p className="text-body">{"It's not your fault"}</p>
                <p className="text-body-dense text-muted-foreground">
                    {error.message}
                </p>
                <p className="text-body-dense text-muted-foreground">
                    {"Feel free to contact us and provide the following error digest: "}
                    {error.digest}
                </p>
                <button onClick={reset} className="mt-4 bg-accent text-accent-foreground rounded-md p-2 uppercase text-label">Try again</button>
            </div>
        </div>
    );
}