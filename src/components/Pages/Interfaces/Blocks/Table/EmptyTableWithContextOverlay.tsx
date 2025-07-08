"use client";

import React from "react";
import { FolderTree } from "lucide-react";

interface EmptyTableWithContextsOverlayProps {
    tileName?: string;
}

const EmptyTableWithContextsOverlay: React.FC<EmptyTableWithContextsOverlayProps> = ({
    tileName,
}) => {
    return (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="bg-background border rounded-lg p-6 max-w-sm mx-4 shadow-lg text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-3 rounded-full bg-primary/10">
                        <FolderTree className="h-6 w-6 text-primary" />
                    </div>
                </div>
                <h3 className="font-semibold text-lg mb-2">Contexts Available</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    The "{tileName}" table is empty.
                </p>
                <p className="text-xs text-muted-foreground">
                    Select a context from the header to view your logs.
                </p>
            </div>
        </div>
    );
};

export default EmptyTableWithContextsOverlay;