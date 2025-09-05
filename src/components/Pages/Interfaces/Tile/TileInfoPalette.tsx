"use client";

import React, { useState } from "react";
import { Database, FileText, BarChart3, Eye, Terminal, Code, Check, X } from "lucide-react";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../../../UI/dropdown-menu";
import { icons, tabTypes } from "@/constants/logs";
import { Badge } from "../../../UI/badge";
import { Button } from "../../../UI/button";
import { Input } from "../../../UI/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../UI/popover";
import { GranularTileActions, ProjectsActions, FieldsActions, ContextActions, LogsActions } from "@/types/interfaces/grid";

interface TileInfoPaletteProps {
    tileId: string;
    tabId: string;
    interfaceId: string;
    projectId: string;
    tileName?: string;
    tileType?: string;
    linkedTable?: string;
    tableNames: string[];
    syncedTabDataActions: any;
    syncedTileDataActions: any;
    syncedTileMetaActions: any;
    syncedTableTileActions: any;
    tabUIActions: any;
    isEditMode: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode; // The trigger element (tile name badge)
}

const TileInfoPalette: React.FC<TileInfoPaletteProps> = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
    tileName,
    tileType,
    linkedTable,
    tableNames,
    syncedTabDataActions,
    syncedTileDataActions,
    syncedTileMetaActions,
    syncedTableTileActions,
    tabUIActions,
    isEditMode,
    onOpenChange,
    children
}) => {

    const getDocsUrl = (type?: string) => {
        switch (type) {
            case "Plot": return "https://docs.unify.ai/interfaces/plots";
            case "View": return "https://docs.unify.ai/interfaces/views";
            case "Editor": return "https://docs.unify.ai/interfaces/editors";
            case "Terminal": return "https://docs.unify.ai/interfaces/views";
            default: return "https://docs.unify.ai/interfaces/tables";
        }
    };

    const getTypeIcon = (type?: string) => {
        switch (type) {
            case "Table": return <Database className="h-4 w-4" />;
            case "Plot": return <BarChart3 className="h-4 w-4" />;
            case "View": return <Eye className="h-4 w-4" />;
            case "Editor": return <Code className="h-4 w-4" />;
            case "Terminal": return <Terminal className="h-4 w-4" />;
            default: return <FileText className="h-4 w-4" />;
        }
    };

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(tileName || "");

    const handleSaveName = () => {
        const newName = editName.trim();
        if (newName && newName !== tileName && syncedTabDataActions && syncedTileMetaActions) {
            // Check for duplicates (case-insensitive)
            const existingNames = syncedTabDataActions.getTileNames?.() || [];
            const duplicate = existingNames
                .filter((n: string) => n !== tileName) // allow keeping the same name
                .some((n: string) => n.toLowerCase() === newName.toLowerCase());

            if (duplicate) {
                // Revert on duplicate name
                setEditName(tileName || "");
                setIsEditing(false);
                return;
            }

            // Use the synced meta action to rename the tile
            syncedTileMetaActions.setName(newName);
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditName(tileName || "");
        setIsEditing(false);
    };

    const popoverContent = (
        <div className="backdrop-blur-sm border rounded-lg shadow-lg p-3 min-w-64">
            {/* Name editor (only in edit mode) */}
            {isEditMode && (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                    <span className="text-label text-muted-foreground min-w-12">Name</span>
                    {isEditing ? (
                        <div className="flex items-center gap-1 flex-1">
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveName();
                                    if (e.key === 'Escape') handleCancelEdit();
                                }}
                                className="h-7 text-caption flex-1"
                                autoFocus
                            />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveName}>
                                <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleCancelEdit}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 flex-1">
                            <span className="text-body flex-1">{tileName}</span>
                            <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 px-2 text-caption"
                                onClick={() => setIsEditing(true)}
                            >
                                Edit
                            </Button>
                        </div>
                    )}
                </div>
            )}
            
            {/* Tile Type */}
            <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-2">
                    {getTypeIcon(tileType)}
                    <span className="text-label text-muted-foreground min-w-12">Type</span>
                </div>
                {isEditMode ? (
                    <div className="flex-1">
                        <BaseDropdown
                            context="tile"
                            button={
                                <Button variant="outline" size="sm" className="h-7 px-2 text-caption w-full justify-between">
                                    {tileType || "Select Type"}
                                </Button>
                            }
                        >
                            {tabTypes.map((tabType, idx) => (
                                <DropdownMenuItem
                                    key={idx}
                                    onSelect={() => {
                                        if (!tileName) return;

                                        const isReverting = tabType === tileType;
                                        const newType = isReverting ? undefined : tabType;
                                        const oldType = tileType;

                                        // Set the new type. This is the primary action.
                                        syncedTileMetaActions?.setType(newType);

                                        // Perform cleanup: if we are moving away from a 'View' type, clear its linked table.
                                        if (oldType === "View" && newType !== "View" && linkedTable) {
                                            syncedTileDataActions?.setTable(undefined);
                                        }

                                        // Perform setup: if creating a 'Table' from a typeless tile, set a default.
                                        if (!oldType && newType === "Table") {
                                            syncedTableTileActions?.setTableType("Data Table");
                                        }
                                    }}
                                    className="flex justify-between items-center cursor-pointer"
                                >
                                    <span>{tabType}</span>
                                    {icons[tabType as keyof typeof icons]}
                                </DropdownMenuItem>
                            ))}
                        </BaseDropdown>
                    </div>
                ) : (
                    <span className="text-body flex-1">{tileType || "None"}</span>
                )}
            </div>

            {/* Linked Table (only show for View type) */}
            {tileType === "View" && (
                <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        <span className="text-label text-muted-foreground min-w-12">Linked</span>
                    </div>
                    {isEditMode ? (
                        <div className="flex-1">
                            <BaseDropdown
                                context="tile"
                                button={
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-7 px-2 text-caption w-full justify-between"
                                    >
                                        {linkedTable || "Select Table"}
                                    </Button>
                                }
                            >
                                {tableNames.map((tableName, idx) => (
                                    <DropdownMenuItem
                                        key={idx}
                                        onSelect={() => {
                                            syncedTileDataActions?.setTable(tableName);
                                        }}
                                    >
                                        {tableName}
                                    </DropdownMenuItem>
                                ))}
                            </BaseDropdown>
                        </div>
                    ) : (
                        <span className="text-body flex-1">{linkedTable || "None"}</span>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <Popover onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent 
                className="w-auto p-0 bg-transparent border-none shadow-none"
                align="start"
                side="bottom"
                sideOffset={8}
            >
                {popoverContent}
            </PopoverContent>
        </Popover>
    );
};

export default TileInfoPalette;