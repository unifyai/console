const OnPrem = () => (
  <>
    <p className="mt-8">{"You can't view this page in an on-prem setup."}</p>
    <p>
      {'In order to do so, please visit '}
      <a
        className="text-accent transition-all hover:text-foreground"
        href="https://console.unify.ai"
      >
        console.unify.ai
      </a>
    </p>
  </>
);

export default OnPrem;
