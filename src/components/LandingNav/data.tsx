/* eslint-disable @next/next/no-img-element */
import React from "react";

interface NavbarMenu {
    title: string;
    mainLink?: string;
    subtitle?: string;
    links?: {
        title: string;
        href?: string;
        description: React.ReactElement | string;
    }[];
}

const NavbarLinks: Array<NavbarMenu> = [
    {
        title: "Developers",
        // subtitle: "Explore Developersʼ Tools",
        links: [
            {
                title: "Runtime Benchmarks",
                href: "https://unify.ai/benchmarks",
                description: "Compare LLM endpoints with live performance benchmarks",
            },
            {
                title: "Documentation",
                href: "https://unify.ai/docs/",
                description: "Learn how to use the Unify API",
            },
            {
                title: "Showcase",
                href: "https://unify.ai/showcase",
                description: "Explore LLM apps built by our community using Unify",
            },
        ]
    },
    {
        title: "Learn",
        // subtitle: "Explore Our Educational Resources",
        links: [
            {
                title: "Blog",
                href: "https://unify.ai/blog",
                description: "Read about LLM deployment infrastructure",
            },
            {
                title: "Paper Readings",
                href: "https://www.youtube.com/playlist?list=PLwNuX3xB_tv91QvDXlW2TjrLGHW51uMul",
                description: "Join our discussions around cuttin-edge AI research",
            },
            {
                title: "Talks",
                href: "https://www.youtube.com/playlist?list=PLwNuX3xB_tv_b74nU1y6Q4Bnug5nTnRaw",
                description: "Dive deep with us into the AI landscape",
            },
        ]
    },
    {
        title: "Company",
        // subtitle: "Explore The Company",
        links: [
            {
                title: "Careers",
                href: "https://unify.ai/apply",
                description: "Join our team and let’s Unify AI!",
            },
            {
                title: "Contact",
                href: "https://unify.ai/contact",
                description: "Reach out to our team",
            },
            {
                title: "Privacy & Cookies",
                href: "https://unify.ai/privacy-policy",
                description: "How we treat your navigation data",
            },
            {
                title: "Terms Of Service",
                href: "https://unify.ai/terms-of-service",
                description: "General requirements for using our Service",
            },
            {
                title: "Team",
                href: "https://unify.ai/team",
                description: "Learn more about the people behind Unify",
            },
            {
                title: "Socials",
                description: (<div className="flex items-center flex-wrap">
                    Follow us through our social accounts:
                    <div className="flex gap-4 md:pl-4 py-[10px] md:py-0">
                        <a href="https://discord.com/invite/sXyFF8tDtm" target="_blank" className="discord-link w-inline-block">
                            <img src="https://assets-global.website-files.com/643fb31f2ef62cf324fab8ca/65a64efd565ca7bde0b0b65d_discord.svg" loading="lazy" alt="" className="md:w-7 " width={40} height={40} />
                        </a>
                        <a href="https://twitter.com/letsunifyai" target="_blank" className="twitter-link w-inline-block">
                            <img src="https://assets-global.website-files.com/643fb31f2ef62cf324fab8ca/64cce2af52b3202ad07bcc39_x-twitter-logo.svg" loading="lazy" alt="" className="md:w-7 " width={40} height={40} />
                        </a>
                        <a href="https://youtube.com/@unifyai" target="_blank" className="youtube-link w-inline-block">
                            <img src="https://assets-global.website-files.com/643fb31f2ef62cf324fab8ca/64cce607f619df844d74b15a_youtube.svg" loading="lazy" alt="" className="md:w-7 " width={40} height={40} />
                        </a>
                        <a href="https://www.linkedin.com/company/unifyai" target="_blank" className="linkedin-link w-inline-block">
                            <img src="https://assets-global.website-files.com/643fb31f2ef62cf324fab8ca/64cce7000688e25b48566b22_linkedin.svg" loading="lazy" alt="" className="md:w-7 " width={40} height={40} />
                        </a>
                    </div>
                </div>),
            }
        ]
    },
    {
        title: "Pricing",
        mainLink: "https://unify.ai/pricing",
        // subtitle: "Explore our Pricing Plans",
    }
];

export default NavbarLinks;
