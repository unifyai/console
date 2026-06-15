import { UnifyBlockMark } from '@/components/Brand';

const UnifyLogo = () => {
  return (
    <a
      href="https://unify.ai"
      className="inline-flex w-fit rounded-lg px-3 py-2 transition-transform hover:-translate-y-px"
      aria-label="Unify"
    >
      <UnifyBlockMark showWordmark />
    </a>
  );
};

export default UnifyLogo;
