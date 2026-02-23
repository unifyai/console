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
    <div className="bg-background/80 absolute inset-0 z-30 mt-12 flex items-center justify-center backdrop-blur-sm">
      <div className="mx-4 max-w-sm rounded-lg border bg-background p-6 text-center shadow-lg">
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
