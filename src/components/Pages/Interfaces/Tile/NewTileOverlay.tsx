'use client';

import React from 'react';
import { FilePlus } from 'lucide-react';
import BaseDropdown from '../../../Common/Dropdowns/Base';
import { DropdownMenuItem } from '../../../UI/dropdown-menu';
import { Button } from '../../../UI/button';
import { tabTypes, icons } from '@/constants/logs';

interface NewTileOverlayProps {
  tileName?: string;
  onSelectType: (type: string) => void;
}

const NewTileOverlay: React.FC<NewTileOverlayProps> = ({ tileName, onSelectType }) => {
  return (
    <div className="brand-chat-bg bg-background/85 absolute inset-0 z-30 mt-12 flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="bg-card/95 mx-4 w-full max-w-sm rounded-xl border border-border p-6 text-center shadow-pop backdrop-blur-sm">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-border bg-accent-soft text-accent-soft-foreground">
          <FilePlus className="h-5 w-5" />
        </div>
        <p className="text-label mb-2 uppercase tracking-[0.16em] text-muted-foreground">
          Tile setup
        </p>
        <h3 className="text-title mb-2 font-display text-foreground">
          {tileName ? `Choose a type for ${tileName}` : 'Choose a tile type'}
        </h3>
        <p className="text-body mb-5 text-muted-foreground">
          Pick how this tile should render data inside the dashboard canvas.
        </p>
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
              className="flex cursor-pointer items-center justify-between"
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
