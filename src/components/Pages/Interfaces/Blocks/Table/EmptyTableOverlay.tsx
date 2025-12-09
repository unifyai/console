"use client";

import React from "react";
import { AlertTriangle, FolderTree, X } from "lucide-react";

interface EmptyTableOverlayProps {
    tileName?: string;
    mode: "context" | "new" | "contextNotFound";
    onDismiss: () => void;
    actionButton?: React.ReactNode;
    withPulse?: boolean;
    contextName?: string;  // Used for contextNotFound mode
}

const EmptyTableOverlay: React.FC<EmptyTableOverlayProps> = ({
    tileName,
    mode,
    onDismiss,
    actionButton,
    withPulse = true,
    contextName,
}) => {
    // Content for contextNotFound mode
    if (mode === "contextNotFound") {
        return (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30">
                <div className="bg-background border border-destructive/30 rounded-lg p-6 max-w-sm mx-4 shadow-lg text-center relative">
                    <button
                        onClick={onDismiss}
                        className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:bg-muted"
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <div className="flex flex-col items-center gap-3">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                        <div className="text-sm font-medium">Context Not Found</div>
                        <p className="text-xs text-muted-foreground">
                            {contextName 
                                ? `The context "${contextName}" no longer exists.`
                                : "The selected context no longer exists."
                            }
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Select a different context or create a new one.
                        </p>
                        {actionButton && (
                            <div className="mt-2">
                                {actionButton}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className={`bg-background border rounded-lg p-6 max-w-sm mx-4 shadow-lg text-center relative`}>
                <button
                    onClick={onDismiss}
                    className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:bg-muted"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
                {actionButton && (
                    <div className="flex justify-center">
                        <div className="relative inline-block">
                            {actionButton}
                            {withPulse &&
                            <span className="absolute -top-1 -left-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                            </span>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmptyTableOverlay;
