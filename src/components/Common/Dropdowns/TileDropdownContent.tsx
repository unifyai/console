import { DropdownMenuContent } from '@/components/UI/dropdown-menu';
import { ReactNode, ComponentPropsWithoutRef, CSSProperties } from 'react'; //
import { useTileColor } from '@/contexts/TileColorContext';

/**
 * Wrapper around DropdownMenuContent to ensure that Tile specific styling is applied.
 * Forwards all DropdownMenuContent props.
 */
type ForwardedDropdownContentProps = Omit<
  ComponentPropsWithoutRef<typeof DropdownMenuContent>,
  'children' | 'side' | 'style'
>;
interface TileDropdownContentOwnProps {
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  style?: CSSProperties;
}
type TileDropdownContentProps = TileDropdownContentOwnProps & ForwardedDropdownContentProps;

export default function TileDropdownContent({
  side = 'bottom',
  children,
  style: incomingStyle,
  ...restContentProps
}: TileDropdownContentProps) {
  const tileColor = useTileColor();
  const tileStyle = (
    tileColor ? { '--primary': tileColor, '--accent': tileColor } : {}
  ) as CSSProperties;
  const finalStyle: CSSProperties = { ...incomingStyle, ...tileStyle };

  return (
    <DropdownMenuContent side={side} style={finalStyle} {...restContentProps}>
      {children}
    </DropdownMenuContent>
  );
}
