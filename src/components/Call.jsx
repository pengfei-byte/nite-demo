import { useEffect, useRef, useState } from "react";
import { PopvidClient } from "../lib/popvid.js";
import { applyUserTurn, createHeat, stageOf, wrapTurn, STAGE_LABEL } from "../lib/heat.js";
import { canSpeech, startSpeech } from "../lib/speech.js";

const SIGNALS = [
  { id: "lean", label: "靠近", text: "对方把脸靠近了镜头。" },
  { id: "smile", label: "笑", text: "对方向你笑了笑，等你反应。" },
  { id: "wink", label: "眨眼", text: "对方眨了眨眼，有点得意。" },
];

const OPENER =
  "对方刚被随机接通。这是你们第一次对上眼。用一句很短的中文打招呼：有点防备，有点好奇。先别甜。不要说英文。";

function fmtMs(ms) {
  if (ms == null || ms < 0) return "—";
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function Call({ match, localStream, onNext, onEnd, onRemoteEnd }) {
  const remoteRef = useRef(null);
  const meRef = useRef(null);
  const clientRef = useRef(null);
  const heatRef = useRef(createHeat());
  const greeted = useRef(false);
  const ended = useRef(false);
  const [heat, setHeat] = useState(heatRef.current);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("接通中");
  const [caption, setCaption] = useState("");
  const [log, setLog] = useState([]);
  const [budget, setBudget] = useState(null);
  const [muted, setMuted] = useState(false);
  const [live, setLive] = useState(false);
  const recRef = useRef(null);
  const stage = stageOf(heat);
  const character = match.character;

  useEffect(() => {
    if (meRef.current && localStream) meRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    const client = new PopvidClient({
      credentials: match.credentials,
      remoteVideo: remoteRef.current,
      onEvent: (msg) => {
        const d = msg.data || {};
        if (msg.type === "session.ready") setStatus("她在看你");
        if (msg.type === "media.clip" && d.kind === "idle") setStatus("看着你");
        if (msg.type === "turn.started") setStatus("在回你");
        if (msg.type === "turn.visible") setStatus("在说话");
        if (msg.type === "turn.text" && d.text) {
          setCaption(d.text);
          setLog((prev) => [...prev.slice(-12), { role: "her", text: d.text }]);
        }
        if (msg.type === "usage.tick" || msg.type === "session.renewed") {
          setBudget(d);
        }
        if (msg.type === "media.clip" && d.kind === "idle" && !greeted.current) {
          greeted.current = true;
          client.say(wrapTurn(OPENER, 1));
        }
      },
      onError: (err) => {
        if (err?.code === "content_rejected") {
          setStatus("这句话她没接");
        } else if (err?.code === "rate_limited") {
          setStatus("说慢一点");
        }
      },
      onEnded: (data) => {
        if (ended.current) return;
        ended.current = true;
        onRemoteEnd?.(data);
      },
    });
    clientRef.current = client;
    client.start();

    const greetFallback = setTimeout(() => {
      if (!greeted.current && client.ready) {
        greeted.current = true;
        client.say(wrapTurn(OPENER, 1));
      }
    }, 8000);

    return () => {
      clearTimeout(greetFallback);
      client.close();
      if (match.session?.session_id) {
        fetch(`/api/sessions/${match.session.session_id}/close`, {
          method: "POST",
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.credentials.session_id]);

  function submit(raw, asAction = false) {
    const text = raw.trim();
    if (!text || !clientRef.current) return;
    const next = applyUserTurn(heatRef.current, asAction ? "" : text);
    heatRef.current = next;
    setHeat(next);
    const stageNow = stageOf(next);
    const payload = asAction ? text : text;
    clientRef.current.say(wrapTurn(payload, stageNow));
    setLog((prev) => [...prev.slice(-12), { role: "me", text: asAction ? `* ${raw.replace(/^The user /, "")}` : text }]);
    setInput("");
    setStatus("等她");
  }

  function onMicDown() {
    if (!canSpeech() || listening) return;
    setListening(true);
    recRef.current = startSpeech({
      onResult: ({ interim, finalText }) => {
        setInput((prev) => (finalText ? `${prev} ${finalText}`.trim() : prev || interim));
      },
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
  }

  function onMicUp() {
    recRef.current?.stop?.();
    recRef.current = null;
    setListening(false);
  }

  return (
    <section className="call" data-stage={stage}>
      <div className="frame">
        <video
          ref={remoteRef}
          className="remote"
          autoPlay
          playsInline
          poster={character.seed}
          onPlaying={() => setLive(true)}
        />
        {!live && <div className="connecting">画面接通中</div>}
        <div className="vignette" />
        <header className="call-top">
          <span className="wordmark sm">NITE</span>
          <span className="status-dot">{status}</span>
          <span className="budget">{fmtMs(budget?.budget_remaining_ms)}</span>
        </header>

        <div className="identity">
          <strong>
            {character.name} · {character.age}
          </strong>
          <span>
            {character.city} · {character.tagline}
          </span>
          <div className="heat" title={STAGE_LABEL[stage]}>
            {[1, 2, 3, 4, 5].map((n) => (
              <i key={n} className={n <= stage ? "on" : ""} />
            ))}
            <em>{STAGE_LABEL[stage]}</em>
          </div>
        </div>

        <aside className="pip">
          <video ref={meRef} autoPlay muted playsInline />
          <span>你</span>
        </aside>

        {caption && <p className="caption">{caption}</p>}

        <div className="dock">
          <div className="signals">
            {SIGNALS.map((s) => (
              <button key={s.id} onClick={() => submit(s.text, true)}>
                {s.label}
              </button>
            ))}
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="说点什么。别只会 hi。"
              maxLength={2000}
            />
            {canSpeech() && (
              <button
                type="button"
                className={listening ? "mic on" : "mic"}
                onMouseDown={onMicDown}
                onMouseUp={onMicUp}
                onMouseLeave={onMicUp}
                onTouchStart={(e) => {
                  e.preventDefault();
                  onMicDown();
                }}
                onTouchEnd={onMicUp}
              >
                按住说
              </button>
            )}
            <button type="submit" className="send">
              送出
            </button>
          </form>
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => setMuted((m) => {
              const next = !m;
              if (remoteRef.current) remoteRef.current.muted = next;
              return next;
            })}>
              {muted ? "取消静音" : "静音"}
            </button>
            <button
              className="btn btn-ember"
              onClick={() => {
                ended.current = true;
                clientRef.current?.close();
                onNext();
              }}
            >
              Next
            </button>
            <button
              className="btn btn-ghost danger"
              onClick={() => {
                ended.current = true;
                clientRef.current?.close();
                onEnd();
              }}
            >
              挂断
            </button>
          </div>
        </div>
      </div>
      <ol className="whisper" aria-hidden={log.length === 0}>
        {log.slice(-4).map((m, idx) => (
          <li key={idx} data-role={m.role}>
            {m.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
