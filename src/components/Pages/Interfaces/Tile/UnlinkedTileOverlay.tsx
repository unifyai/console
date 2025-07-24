"use client";

import React from "react";
import { AlertTriangle, Database, ArrowRight } from "lucide-react";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../../../UI/dropdown-menu";
import { Button } from "../../../UI/button";

interface UnlinkedTileOverlayProps {
    tileType?: string;
    tileName?: string;
    tableNames: string[];
    onSelectTable: (tableName: string) => void;
    isEditMode: boolean;
}

const UnlinkedTileOverlay: React.FC<UnlinkedTileOverlayProps> = ({
    tileType,
    tileName,
    tableNames,
    onSelectTable,
    isEditMode
}) => {
    
    return (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30 mt-12">
            <div className="bg-background border border-destructive/50 rounded-lg p-6 max-w-sm mx-4 shadow-lg text-center">

                {tableNames.length > 0 ? (
                    <BaseDropdown
                        button={
                            <Button variant="default" size="sm" className="w-full">
                                <Database className="h-4 w-4 mr-2" />
                                Link to Table
                            </Button>
                        }
                    >
                        {tableNames.map((tableName, idx) => (
                            <DropdownMenuItem
                                key={idx}
                                onSelect={() => onSelectTable(tableName)}
                                className="flex items-center gap-2"
                            >
                                <Database className="h-4 w-4" />
                                {tableName}
                            </DropdownMenuItem>
                        ))}
                    </BaseDropdown>
                ) : (
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-2">
                            No tables available to link
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Create a Table tile first, then link this View tile to it
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnlinkedTileOverlay; 