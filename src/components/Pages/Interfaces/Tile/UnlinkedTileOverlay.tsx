'use client';

import React from 'react';
import { AlertTriangle, Database, ArrowRight } from 'lucide-react';
import BaseDropdown from '../../../Common/Dropdowns/Base';
import { DropdownMenuItem } from '../../../UI/dropdown-menu';
import { Button } from '../../../UI/button';

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
  isEditMode,
}) => {
  return (
    <div className="bg-background/80 absolute inset-0 z-30 mt-12 flex items-center justify-center backdrop-blur-sm">
      <div className="border-destructive/50 mx-4 max-w-sm rounded-lg border bg-background p-6 text-center shadow-lg">
        {tableNames.length > 0 ? (
          <BaseDropdown
            button={
              <Button variant="default" size="sm" className="w-full">
                <Database className="mr-2 h-4 w-4" />
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
            <p className="text-caption mb-2 text-muted-foreground">No tables available to link</p>
            <p className="text-caption text-muted-foreground">
              Create a Table tile first, then link this View tile to it
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnlinkedTileOverlay;
