export default function AgeGate({ onEnter }) {
  return (
    <section className="panel gate">
      <p className="eyebrow">18+ · random video</p>
      <h1 className="wordmark">NITE</h1>
      <p className="lede">
        Match with someone still awake.
        <br />
        She will not be sweet just because you showed up.
      </p>
      <button className="btn btn-ember" onClick={onEnter}>
        I&apos;m 18 or older
      </button>
      <p className="fine">Demo. Characters are AI, not real people.</p>
    </section>
  );
}
