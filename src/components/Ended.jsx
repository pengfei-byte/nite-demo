const REASONS = {
  client_closed: "你挂了。",
  server_closed: "通话结束。",
  budget_exhausted: "这轮时间到了。",
  idle_timeout: "她等得不耐烦，先走了。",
  media_failed: "画面没接通。",
  viewer_gone: "信号断了。",
  reservation_expired: "她没等到你。",
  internal_error: "线路出了点问题。",
};

export default function Ended({ info, onAgain, onLobby }) {
  const text = REASONS[info?.reason] || "通话结束。";
  return (
    <section className="panel ended">
      <p className="eyebrow">disconnected</p>
      <h1>{text}</h1>
      <p className="lede dim">下一张脸，不一定更好说话。</p>
      <div className="row">
        <button className="btn btn-ember" onClick={onAgain}>
          再来一个
        </button>
        <button className="btn btn-ghost" onClick={onLobby}>
          回大厅
        </button>
      </div>
    </section>
  );
}
