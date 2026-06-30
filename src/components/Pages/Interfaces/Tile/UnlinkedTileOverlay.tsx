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
    <div className="brand-chat-bg bg-background/85 absolute inset-0 z-30 mt-12 flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="bg-card/95 mx-4 w-full max-w-sm rounded-xl border border-border p-6 text-center shadow-pop backdrop-blur-sm">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-border bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-label mb-2 uppercase tracking-[0.16em] text-muted-foreground">
          Link required
        </p>
        <h3 className="text-title mb-2 font-display text-foreground">
          {tileName ? `${tileName} needs a table` : `${tileType ?? 'View'} tile needs a table`}
        </h3>
        <p className="text-body mb-5 text-muted-foreground">
          Connect this view to a table tile so row selections can flow through the canvas.
        </p>
        {tableNames.length > 0 ? (
          <BaseDropdown
            button={
              <Button variant="default" size="sm" className="w-full">
                <Database className="mr-2 h-4 w-4" />
                Link to Table
                <ArrowRight className="ml-2 h-4 w-4" />
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
