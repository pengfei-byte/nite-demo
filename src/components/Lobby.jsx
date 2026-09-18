export default function Lobby({
  roster,
  mood,
  onMood,
  error,
  onStart,
  onPick,
}) {
  return (
    <section className="panel lobby">
      <header className="topbar">
        <span className="wordmark sm">NITE</span>
        <span className="live">
          <i /> {roster.online || "—"} online
        </span>
      </header>

      <div className="copy">
        <h1>Next second, you&apos;re live.</h1>
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
        Start matching
      </button>

      <div className="nearby">
        <p>Still up nearby</p>
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
