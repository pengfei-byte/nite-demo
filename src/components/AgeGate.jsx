export default function AgeGate({ onEnter }) {
  return (
    <section className="panel gate">
      <p className="eyebrow">18+ · random video</p>
      <h1 className="wordmark">NITE</h1>
      <p className="lede">
        随机接通一个还醒着的人。
        <br />
        她不会一上来就对你温柔。
      </p>
      <button className="btn btn-ember" onClick={onEnter}>
        我已年满 18 岁
      </button>
      <p className="fine">演示产品。角色为 AI，不是真人。</p>
    </section>
  );
}
