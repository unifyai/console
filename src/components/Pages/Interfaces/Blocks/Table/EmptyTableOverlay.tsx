"use client";

import React from "react";
import { FolderTree, FilePlus, X } from "lucide-react";

interface EmptyTableOverlayProps {
    tileName?: string;
    mode: "context" | "new";
    onDismiss: () => void;
    actionButton?: React.ReactNode;
}

const EmptyTableOverlay: React.FC<EmptyTableOverlayProps> = ({
    tileName,
    mode,
    onDismiss,
    actionButton,
}) => {
    return (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="bg-background border rounded-lg p-6 max-w-sm mx-4 shadow-lg text-center relative">
                <button
                    onClick={onDismiss}
                    className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:bg-muted"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
                {mode == "context"
                    ? (
                        <>
                            <h3 className="font-semibold text-lg mb-2">Contexts Available</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                The {tileName} table is empty.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Select a context to view your logs.
                            </p>
                            {actionButton && (
                                <div className="mt-6 flex justify-center">
                                    <div className="relative inline-block">
                                        {actionButton}
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    )
                    : (
                        <>
                            <h3 className="font-semibold text-sm mb-2">This Table is Empty</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                It seems like there are no logs in this project yet.
                            </p>
                            <p className="text-xs text-muted-foreground">
                            Create an empty log. Or start{' '}
                            <a
                                href="https://docs.unify.ai/basics/quickstart"
                                className="text-primary underline"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                logging data
                            </a>{' '}
                            with our API.
                            </p>                        
                            {actionButton && (
                                <div className="mt-6 flex justify-center">
                                    <div className="relative inline-block">
                                        {actionButton}
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    )
                }
            </div>
        </div>
    );
};

export default EmptyTableOverlay;