import { useEffect, useRef } from "react";

export default function Lobby({
  roster,
  mood,
  onMood,
  localStream,
  error,
  onStart,
  onPick,
  onCam,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    onCam?.();
  }, [onCam]);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <section className="panel lobby">
      <header className="topbar">
        <span className="wordmark sm">NITE</span>
        <span className="live">
          <i /> {roster.online || "—"} 在线
        </span>
      </header>

      <div className="me-preview">
        <video ref={videoRef} autoPlay muted playsInline />
        {!localStream && (
          <button className="ghost-cam" onClick={onCam}>
            打开镜头
          </button>
        )}
        <span className="chip">你</span>
      </div>

      <div className="copy">
        <h1>下一秒，随机接通。</h1>
        <p>对方是女人，有脾气。太急，她会笑你。</p>
      </div>

      <div className="moods">
        {(roster.moods || []).map((m) => (
          <button
            key={m.id}
            className={mood === m.id ? "mood on" : "mood"}
            onClick={() => onMood(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && <p className="banner">{error}</p>}

      <button className="btn btn-ember lg" onClick={onStart}>
        开始匹配
      </button>

      <div className="nearby">
        <p>附近还醒着</p>
        <div className="cards">
          {(roster.characters || []).map((c) => (
            <button key={c.id} className="card" onClick={() => onPick(c.id)}>
              <img src={c.seed} alt="" />
              <span>
                {c.name}
                <small>
                  {c.age} · {c.city}
                </small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
