import { Logo } from "@/utils/landingNav/consts";

const UnifyLogo = ({ theme }: { theme: string | undefined }) => {
    const DarkLogo = Logo.dark;
    const LightLogo = Logo.light;

    // If theme is undefined, don't render anything
    if (theme === undefined) {
        return null; // or return a placeholder
    }

    const LogoComponent = theme === 'dark' ? DarkLogo : LightLogo;

    return (
        <a href="https://unify.ai" className='rounded-full pt-[10px] pb-[7px] px-[14px] w-fit'>
            <LogoComponent height={20} width={150} />
        </a>
    );
};

export default UnifyLogo;