const REASONS = {
  client_closed: "You hung up.",
  server_closed: "Call ended.",
  budget_exhausted: "The line dropped.",
  idle_timeout: "She got tired of waiting.",
  media_failed: "Video never connected.",
  viewer_gone: "Signal dropped.",
  reservation_expired: "She didn't wait.",
  internal_error: "Something broke on the line.",
};

export default function Ended({ info, onAgain, onLobby }) {
  const text = REASONS[info?.reason] || "Call ended.";
  return (
    <section className="panel ended">
      <p className="eyebrow">disconnected</p>
      <h1>{text}</h1>
      <p className="lede dim">Next face might be even less easy.</p>
      <div className="row">
        <button className="btn btn-ember" onClick={onAgain}>
          Match again
        </button>
        <button className="btn btn-ghost" onClick={onLobby}>
          Lobby
        </button>
      </div>
    </section>
  );
}
