'use client';

import { Dispatch, ReactNode, SetStateAction } from 'react';
import { Toggle } from '@/components/UI/toggle';
import Tooltip from '../Misc/Tooltip';

const BaseToggle = ({
  isOn,
  setOn,
  onTooltip,
  offTooltip,
  icon,
  size = 'sm',
  variant = 'outline',
}: {
  isOn: boolean;
  setOn: Dispatch<SetStateAction<boolean>>;
  onTooltip: string;
  offTooltip: string;
  icon: ReactNode;
  variant?: 'default' | 'outline' | null | undefined;
  size?: 'default' | 'sm' | 'lg' | null | undefined;
}) => {
  return (
    <Tooltip content={isOn ? onTooltip : offTooltip}>
      <Toggle
        size={size}
        variant={variant}
        onClick={(e) => {
          e.stopPropagation();
          setOn(!isOn);
        }}
      >
        {icon}
      </Toggle>
    </Tooltip>
  );
};

export default BaseToggle;
