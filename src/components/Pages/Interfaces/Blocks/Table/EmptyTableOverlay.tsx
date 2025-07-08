"use client";

import React from "react";
import { FolderTree, FilePlus } from "lucide-react";

interface EmptyTableOverlayProps {
    tileName?: string;
    mode: "context" | "new";
}

const EmptyTableOverlay: React.FC<EmptyTableOverlayProps> = ({
    tileName,
    mode,
}) => {
    return (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="bg-background border rounded-lg p-6 max-w-sm mx-4 shadow-lg text-center">
                {mode == "context"
                    ? (
                        <>
                            <div className="flex justify-center mb-4">
                                <div className="p-3 rounded-full bg-primary/10">
                                    <FolderTree className="h-6 w-6 text-primary" />
                                </div>
                            </div>
                            <h3 className="font-semibold text-lg mb-2">Contexts Available</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                The {tileName} table is empty.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Select a context from the header to view your logs.
                            </p>
                        </>
                    )
                    : (
                        <>
                            <div className="flex justify-center mb-4">
                                <div className="p-3 rounded-full bg-muted">
                                    <FilePlus className="h-6 w-6 text-muted-foreground" />
                                </div>
                            </div>
                            <h3 className="font-semibold text-sm mb-2">This Table is Empty</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                It seems you haven&apos;t logged any data for this project yet.
                            </p>
                            <p className="text-xs text-muted-foreground">
                            Create an empty log from the header above. Or start{' '}
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
                        </>
                    )
                }
            </div>
        </div>
    );
};

export default EmptyTableOverlay;