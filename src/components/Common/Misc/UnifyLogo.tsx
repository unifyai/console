import { Logo } from '@/utils/landingNav/consts';

const UnifyLogo = () => {
  const DarkLogo = Logo.dark;
  const LightLogo = Logo.light;

  return (
    <a href="https://unify.ai" className="w-fit rounded-full px-[14px] pb-[7px] pt-[10px]">
      <LightLogo height={20} className="w-fit block dark:hidden" />
      <DarkLogo height={20} className="w-fit hidden dark:block" />
    </a>
  );
};

export default UnifyLogo;
