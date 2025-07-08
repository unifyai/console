import Image from "next/image";
import { Logo } from "@/utils/landingNav/consts";

const footerLinks: { [id: string]: { name: string, href: string }[] } = {
    "Learn": [
        { name: "Documentation", href: "https://unify.ai/docs/" },
        { name: "Github", href: "https://github.com/unifyai/unify" },
        { name: "Blog", href: "https://unify.ai/blog" },
        { name: "Paper Readings", href: "https://www.youtube.com/playlist?list=PLwNuX3xB_tv91QvDXlW2TjrLGHW51uMul" },
        { name: "Talks", href: "https://www.youtube.com/playlist?list=PLwNuX3xB_tv_b74nU1y6Q4Bnug5nTnRaw" },
    ],
    "Socials": [
        { name: "Discord", href: "https://discord.com/invite/sXyFF8tDtm" },
        { name: "LinkedIn", href: "https://www.linkedin.com/company/unifyai" },
        { name: "Twitter", href: "https://twitter.com/letsunifyai" },
        { name: "YouTube", href: "https://www.youtube.com/@unifyai" },
    ],
    "Company": [
        { name: "Careers", href: "https://unify.ai/apply" },
        { name: "Contact", href: "https://unify.ai/contact" },
        // { name: "Cookies", href: """ },
        { name: "Privacy Policy", href: "https://unify.ai/privacy-policy" },
        { name: "Terms Of Service", href: "https://unify.ai/terms-of-service" },
        { name: "Team", href: "https://www.unify.ai/team" },
    ],
};

const Footer = () => {
    return (<footer className="pt-16 pb-[40px] px-[20px] bg-[var(--background-color)]">
        <div className="container">
            <div className="md:mr-[100px] flex flex-wrap items-start justify-between gap-4">
                <a href="/">
                    <Logo.light
                        className="block dark:hidden"
                        loading="lazy"
                        alt="Unify logo"
                        width={91}
                        height={35}
                    />
                    <Logo.dark
                        className="hidden dark:block"
                        loading="lazy"
                        alt="Unify logo"
                        width={91}
                        height={35}
                    />
                </a>
                <div className="md:w-[60%] w-full flex flex-row flex-wrap items-start justify-start lg:justify-between gap-6 gap-y-4 lg:gap-6">
                    {Object.keys(footerLinks).map((key) => (
                        <div key={key} className="gap-2 flex flex-col">
                            <div className="uppercase font-semibold text-branding-grey hover:text-branding-black text-[13px] lg:text-sm transition-all">
                                {key}
                            </div>
                            {footerLinks[key].map((link) => (
                                <a key={link.name} href={link.href} className="hover:text-accent transition-all text-[16px] lg:text-[14px] ease-out duration-250">
                                    {link.name}
                                </a>
                            ))}
                        </div>
                    ))}
                </div>
                <div />
            </div>
        </div>
    </footer>);
};

export default Footer;
