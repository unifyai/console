import { DialogContent } from '@/components/UI/dialog';
import { ReactNode, ComponentPropsWithoutRef, CSSProperties } from 'react'; //
import { useTileColor } from '@/contexts/TileColorContext';

/**
 * Wrapper around DialogContent to ensure that Tile specific styling is applied.
 * Forwards all DialogContent props.
 */
type ForwardedDropdownContentProps = Omit<
  ComponentPropsWithoutRef<typeof DialogContent>,
  'children' | 'side' | 'style'
>;
interface TileDialogContentOwnProps {
  children: ReactNode;
  style?: CSSProperties;
}
type TileDialogContentProps = TileDialogContentOwnProps & ForwardedDropdownContentProps;

export default function TileDialogContent({
  children,
  style: incomingStyle,
  ...restContentProps
}: TileDialogContentProps) {
  const tileColor = useTileColor();
  const tileStyle = (
    tileColor ? { '--primary': tileColor, '--accent': tileColor } : {}
  ) as CSSProperties;
  const finalStyle: CSSProperties = { ...incomingStyle, ...tileStyle };

  return (
    <DialogContent style={finalStyle} {...restContentProps}>
      {children}
    </DialogContent>
  );
}
