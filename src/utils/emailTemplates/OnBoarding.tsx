import { Font, Head, Html } from '@react-email/components';

const OnBoarding = () => {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <title>Welcome To Unify</title>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <Font fontFamily="Inter" fallbackFontFamily="sans-serif" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <p>Hey, Dan from Unify here,</p>
        <p>
          Thrilled to see you recently signed up, hope you&apos;re having a blast trying out our
          API!
        </p>
        <p>I&apos;d love to hear about your experience so far, or any feedback you may have.</p>
        <p>
          Is there a day/time that suits you? Or if it&apos;s easier feel free to grab a slot on my{' '}
          <a href="https://calendly.com/unify-chat/user-chat">Calendly</a> :{')'}
        </p>
        <p>
          No worries if not, just letting you know we&apos;re open to customize the API for your
          needs!
        </p>
        <p>Thanks,</p>
        <p>Dan (CEO @ Unify)</p>
      </body>
    </Html>
  );
};

export default OnBoarding;
