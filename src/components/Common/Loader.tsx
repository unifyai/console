import { BrandLoader } from '@droid/brand/components';

type LoaderProps = {
  /** Slot size in px. The brand mark is rendered compactly within that old spinner footprint. */
  size?: number;
  className?: string;
  /** Accessible label announced to assistive tech. */
  label?: string;
};

/**
 * The console's canonical loading indicator: the animated Unify block-mark loader. Use this
 * everywhere a standalone "loading" spinner is shown (loading screens, page/section/dialog
 * loaders) so there is a single, on-brand loading icon across the app.
 */
export function Loader({ size = 32, className, label = 'Loading' }: LoaderProps) {
  return <BrandLoader size={Math.round(size * 0.5)} className={className} label={label} />;
}

export default Loader;
