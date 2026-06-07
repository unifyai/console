import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/utils/landingNav/consts';

const footerLinks: { [id: string]: { name: string; href: string }[] } = {
  Learn: [
    { name: 'Documentation', href: 'https://unify.ai/docs/' },
    { name: 'Github', href: 'https://github.com/unifyai/unify' },
    { name: 'Blog', href: 'https://unify.ai/blog' },
    {
      name: 'Paper Readings',
      href: 'https://www.youtube.com/playlist?list=PLwNuX3xB_tv91QvDXlW2TjrLGHW51uMul',
    },
    {
      name: 'Talks',
      href: 'https://www.youtube.com/playlist?list=PLwNuX3xB_tv_b74nU1y6Q4Bnug5nTnRaw',
    },
  ],
  Socials: [
    { name: 'Discord', href: 'https://discord.com/invite/sXyFF8tDtm' },
    { name: 'LinkedIn', href: 'https://www.linkedin.com/company/unifyai' },
    { name: 'Twitter', href: 'https://twitter.com/letsunifyai' },
    { name: 'YouTube', href: 'https://www.youtube.com/@unifyai' },
  ],
  Company: [
    { name: 'Careers', href: 'https://unify.ai/apply' },
    { name: 'Contact', href: 'https://unify.ai/contact' },
    // { name: "Cookies", href: """ },
    { name: 'Privacy Policy', href: 'https://unify.ai/privacy-policy' },
    { name: 'Terms Of Service', href: 'https://unify.ai/terms-of-service' },
    { name: 'Team', href: 'https://www.unify.ai/team' },
  ],
};

const Footer = () => {
  return (
    <footer className="bg-background px-[20px] pb-[40px] pt-16">
      <div className="container">
        <div className="flex flex-wrap items-start justify-between gap-4 md:mr-[100px]">
          <Link href="/" aria-label="Unify logo">
            <Logo.light className="block dark:hidden" width={91} height={35} />
            <Logo.dark className="hidden dark:block" width={91} height={35} />
          </Link>
          <div className="flex w-full flex-row flex-wrap items-start justify-start gap-6 gap-y-4 md:w-[60%] lg:justify-between lg:gap-6">
            {Object.keys(footerLinks).map((key) => (
              <div key={key} className="flex flex-col gap-2">
                <div className="text-label text-semibold text-muted-foreground transition-all hover:text-foreground">
                  {key}
                </div>
                {footerLinks[key].map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="duration-250 text-[16px] transition-all ease-out hover:text-accent lg:text-[14px]"
                  >
                    {link.name}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
