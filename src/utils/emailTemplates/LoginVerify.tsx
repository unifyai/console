import { Body, Button, Column, Container, Font, Head, Heading, Html, Img, Preview, Row, Section, Tailwind } from "@react-email/components";


interface LoginVerifyProps {
    url: string;
}

/* Using @react-email/components <Font> and hosted Google CSS is sufficient for emails; next/font is not necessary here. */

const LoginVerify = ({ url }: LoginVerifyProps) => {
    return (<Html lang="en" dir="ltr">
        <Tailwind>
            <Head>
                <title>Unify Login</title>
                <meta name="color-scheme" content="light dark" />
                <meta name="supported-color-schemes" content="light dark" />
                <Font
                    fontFamily="Inter"
                    fallbackFontFamily="sans-serif"
                />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                {/* eslint-disable-next-line @next/next/no-page-custom-font */}
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
                <Preview>Verify your login</Preview>
            </Head>
            <Container className="max-w-full bg-[#f3f3f5]">
                <div className={`my-7 mx-auto w-[640px]`}>
                    <Img src="https://cdn.saas.unify.ai/unify_logo.png" className="mb-10 mx-auto" height={72} width={277} alt="Unify" />
                    <div
                        className="text-center px-4 tracking-wider font-extralight bg-background"
                        style={{
                            borderTop: "8px solid #00a824",
                            borderBottom: "8px solid #00a824",
                            borderLeft: "1px solid #BEB9B9",
                            borderRight: "1px solid #BEB9B9"
                        }}
                    >
                        <Heading
                            className="text-5xl font-extralight my-16"
                        >
                            Almost There!
                        </Heading>
                        <p className="text-[20px]">
                            Follow the link below to your account 🚀
                        </p>
                        <Button
                            href={url}
                            className="bg-[#00a824] text-foreground py-2 px-12 rounded-md text-[20px]"
                        >
                            Account
                        </Button>
                        <p
                            className="text-xs text-gray-500 w-full text-start mt-10"
                        >
                            If you did not try to sign-up you can safely ignore this email
                        </p>
                    </div>
                    <div className="items-center mt-10 mx-auto">
                        <p className="text-[#00a824] font-bold text-center">
                            Let’s Connect!
                        </p>
                        <Section>
                            <Row className="mx-auto w-fit">
                                <Column className="px-5">
                                    <a href="https://github.com/unifyai/" target="_blank" rel="noreferrer">
                                        <Img src="https://cdn.saas.unify.ai/github.png" width={36} height={36} alt="Github" />
                                    </a>
                                </Column>
                                <Column className="px-5">
                                    <a href="https://www.youtube.com/@unifyai" target="_blank" rel="noreferrer">
                                        <Img src="https://cdn.saas.unify.ai/youtube.png" width={36} height={36} alt="Youtube" />
                                    </a>
                                </Column>
                                <Column className="px-5">
                                    <a href="https://discord.gg/sXyFF8tDtm" target="_blank" rel="noreferrer">
                                        <Img src="https://cdn.saas.unify.ai/discord.png" width={36} height={36} alt="Discord" />
                                    </a>
                                </Column>
                                <Column className="px-5">
                                    <a href="https://twitter.com/letsunifyai" target="_blank" rel="noreferrer">
                                        <Img src="https://cdn.saas.unify.ai/twitter.png" width={36} height={36} alt="Twitter" />
                                    </a>
                                </Column>
                                <Column className="px-5">
                                    <a href="https://unifyai.substack.com/" target="_blank" rel="noreferrer">
                                        <Img src="https://cdn.saas.unify.ai/substack.png" width={36} height={36} alt="Substack" />
                                    </a>
                                </Column>
                            </Row>
                        </Section>
                    </div>
                </div>
            </Container>
        </Tailwind>
    </Html>);
};

export default LoginVerify;
