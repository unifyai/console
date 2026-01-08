import { Logo } from '@/utils/landingNav/consts';

const UnifyLogo = ({ theme }: { theme: string | undefined }) => {
  const DarkLogo = Logo.dark;
  const LightLogo = Logo.light;

  // If theme is undefined, don't render anything
  if (theme === undefined) {
    return null; // or return a placeholder
  }

  const LogoComponent = theme === 'dark' ? DarkLogo : LightLogo;

  return (
    <a href="https://unify.ai" className="w-fit rounded-full px-[14px] pb-[7px] pt-[10px]">
      <LogoComponent height={20} width={150} />
    </a>
  );
};

export default UnifyLogo;
