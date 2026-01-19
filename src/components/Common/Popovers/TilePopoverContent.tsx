import { PopoverContent } from '@/components/UI/popover';
import { ReactNode, ComponentPropsWithoutRef, CSSProperties } from 'react';
import { useTileColor } from '@/contexts/TileColorContext';

/**
 * Wrapper around PopoverContent to ensure that Tile specific styling is applied.
 * Forwards all PopoverContent props.
 */
type ForwardedPopoverContentProps = Omit<
  ComponentPropsWithoutRef<typeof PopoverContent>,
  'children' | 'className' | 'style'
>;
interface TilePopoverContentOwnProps {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}
type TilePopoverContentProps = TilePopoverContentOwnProps & ForwardedPopoverContentProps;

export default function TilePopoverContent({
  className,
  children,
  style: incomingStyle,
  ...restContentProps
}: TilePopoverContentProps) {
  const tileColor = useTileColor();
  const tileStyle = (
    tileColor ? { '--primary': tileColor, '--accent': tileColor } : {}
  ) as CSSProperties;
  const finalStyle: CSSProperties = { ...incomingStyle, ...tileStyle };

  return (
    <PopoverContent className={className} style={finalStyle} {...restContentProps}>
      {children}
    </PopoverContent>
  );
}
