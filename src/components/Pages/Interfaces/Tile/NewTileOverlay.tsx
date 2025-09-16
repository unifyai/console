"use client";

import React from "react";
import { FilePlus } from "lucide-react";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../../../UI/dropdown-menu";
import { Button } from "../../../UI/button";
import { tabTypes, icons } from "@/constants/logs";

interface NewTileOverlayProps {
    tileName?: string;
    onSelectType: (type: string) => void;
}

const NewTileOverlay: React.FC<NewTileOverlayProps> = ({
    tileName,
    onSelectType,
}) => {
    
    return (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30 mt-12">
            <div className="bg-background border rounded-lg p-6 max-w-sm mx-4 shadow-lg text-center">
                
                <BaseDropdown
                    context="tile"
                    button={
                        <Button variant="default" size="sm" className="w-full">
                            Select Tile Type
                        </Button>
                    }
                >
                    {tabTypes.map((type, idx) => (
                        <DropdownMenuItem
                            key={idx}
                            onSelect={() => onSelectType(type)}
                            className="flex justify-between items-center cursor-pointer"
                        >
                            <span>{type}</span>
                            {icons[type as keyof typeof icons]}
                        </DropdownMenuItem>
                    ))}
                </BaseDropdown>
            </div>
        </div>
    );
};

export default NewTileOverlay;