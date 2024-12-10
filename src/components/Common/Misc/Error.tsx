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
            <div className="flex flex-col gap-2 max-w-xl items-center">
                <Image src={ErrorImage} className="max-w-xl" alt="Unify Logo" />
                <h1 className="text-xl font-semibold">Something went wrong</h1>
                <p>{"It's not your fault"}</p>
                <p className="font-light">
                    {error.message}
                </p>
                <p className="font-light">
                    {"Feel free to contact us and provide the following error digest: "}
                    {error.digest}
                </p>
                <button onClick={reset} className="bg-accent text-foreground rounded-md p-2 uppercase">Try again</button>
            </div>
        </div>
    );
}
