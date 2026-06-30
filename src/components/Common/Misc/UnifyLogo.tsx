import { UnifyBlockMark } from '@/components/Brand';

type UnifyLogoProps = {
  className?: string;
  markClassName?: string;
};

const UnifyLogo = ({ className, markClassName }: UnifyLogoProps = {}) => {
  return (
    <a
      href="https://unify.ai"
      className={['inline-flex w-fit rounded-lg px-3 py-2', className].filter(Boolean).join(' ')}
      aria-label="Unify"
    >
      <UnifyBlockMark className={markClassName} showWordmark />
    </a>
  );
};

export default UnifyLogo;
