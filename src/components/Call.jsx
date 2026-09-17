import { useEffect, useRef, useState } from "react";
import { PopvidClient } from "../lib/popvid.js";
import { applyUserTurn, createHeat, stageOf, wrapTurn, STAGE_LABEL } from "../lib/heat.js";
import { canSpeech, startSpeech } from "../lib/speech.js";

const SIGNALS = [
  { id: "lean", label: "Lean in", text: "He leans closer to the camera." },
  { id: "smile", label: "Smile", text: "He smiles at you, waiting." },
  { id: "wink", label: "Wink", text: "He winks, a little too pleased with himself." },
];

const OPENER =
  "He just got matched on a random video call. First look. Greet him in one short English line — a little guarded, a little curious. Do not be sweet yet. Do not speak any other language.";

export default function Call({ match, localStream, onNext, onEnd, onRemoteEnd }) {
  const remoteRef = useRef(null);
  const meRef = useRef(null);
  const clientRef = useRef(null);
  const heatRef = useRef(createHeat());
  const greeted = useRef(false);
  const ended = useRef(false);
  const recRef = useRef(null);
  const pendingRef = useRef("");
  const flushTimer = useRef(null);
  const micMutedRef = useRef(false);
  const herTalkingRef = useRef(false);
  const submitRef = useRef(() => {});
  const [heat, setHeat] = useState(heatRef.current);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [status, setStatus] = useState("Connecting");
  const [caption, setCaption] = useState("");
  const [log, setLog] = useState([]);
  const [live, setLive] = useState(false);
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
        if (msg.type === "session.ready") setStatus("She's looking");
        if (msg.type === "media.clip" && d.kind === "idle") {
          herTalkingRef.current = false;
          setStatus("Watching you");
        }
        if (msg.type === "turn.started") {
          herTalkingRef.current = true;
          pendingRef.current = "";
          setInput("");
          clearTimeout(flushTimer.current);
          try {
            recRef.current?.stop?.();
          } catch {
            /* ignore */
          }
          setStatus("Answering");
        }
        if (msg.type === "turn.visible") {
          herTalkingRef.current = true;
          setStatus("Talking");
        }
        if (msg.type === "turn.text" && d.text) {
          herTalkingRef.current = true;
          setCaption(d.text);
          setLog((prev) => [...prev.slice(-12), { role: "her", text: d.text }]);
        }
        if (msg.type === "media.clip" && d.kind === "idle" && !greeted.current) {
          greeted.current = true;
          client.say(wrapTurn(OPENER, 1));
        }
      },
      onError: (err) => {
        if (err?.code === "content_rejected") setStatus("She ignored that");
        else if (err?.code === "rate_limited") setStatus("Slow down");
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
    clientRef.current.say(wrapTurn(text, stageOf(next)));
    setLog((prev) => [
      ...prev.slice(-12),
      { role: "me", text: asAction ? `* ${text}` : text },
    ]);
    setInput("");
    setStatus("Waiting");
  }

  submitRef.current = submit;

  useEffect(() => {
    micMutedRef.current = micMuted;
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !micMuted;
    });

    const stopRec = () => {
      try {
        recRef.current?.stop?.();
      } catch {
        /* already stopped */
      }
      recRef.current = null;
      setListening(false);
    };

    if (micMuted || !canSpeech()) {
      stopRec();
      return undefined;
    }

    let stopped = false;
    const boot = () => {
      if (stopped || micMutedRef.current || recRef.current) return;
      if (herTalkingRef.current) {
        setTimeout(boot, 400);
        return;
      }
      const rec = startSpeech({
        lang: "en-US",
        onResult: ({ interim, finalText }) => {
          if (herTalkingRef.current) return;
          if (finalText) {
            pendingRef.current = `${pendingRef.current} ${finalText}`.trim();
            setInput(pendingRef.current);
            clearTimeout(flushTimer.current);
            flushTimer.current = setTimeout(() => {
              const spoken = pendingRef.current.trim();
              pendingRef.current = "";
              setInput("");
              if (spoken.length >= 2) submitRef.current(spoken);
            }, 900);
          } else if (interim) {
            setInput(
              `${pendingRef.current}${pendingRef.current ? " " : ""}${interim}`.trim()
            );
          }
        },
        onEnd: () => {
          recRef.current = null;
          setListening(false);
          if (!stopped && !micMutedRef.current) setTimeout(boot, 180);
        },
        onError: (e) => {
          if (e?.error === "not-allowed") {
            stopped = true;
            setListening(false);
          }
        },
      });
      recRef.current = rec;
      if (rec) setListening(true);
    };

    boot();
    return () => {
      stopped = true;
      clearTimeout(flushTimer.current);
      stopRec();
    };
  }, [micMuted, localStream, match.credentials.session_id]);

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
        {!live && <div className="connecting">Connecting video</div>}
        <div className="vignette" />
        <header className="call-top">
          <span className="wordmark sm">NITE</span>
          <span className="status-dot">{status}</span>
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
          <span>You</span>
        </aside>

        {caption && <p className="caption">{caption}</p>}

        <div className="dock">
          <div className="signals">
            {SIGNALS.map((s) => (
              <button key={s.id} onClick={() => submit(s.text, true)}>
                {s.label}
              </button>
            ))}
            {canSpeech() && !micMuted && listening && (
              <span className="live-mic">Listening</span>
            )}
            {micMuted && <span className="live-mic off">Muted</span>}
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
              placeholder={
                micMuted
                  ? "Mic is off. Type if you want."
                  : "Just talk. Type only if you need to."
              }
              maxLength={2000}
            />
            <button type="submit" className="send">
              Send
            </button>
          </form>
          <div className="actions">
            <button
              className={micMuted ? "btn btn-ember" : "btn btn-ghost"}
              onClick={() => setMicMuted((on) => !on)}
            >
              {micMuted ? "Unmute" : "Mute"}
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
              Hang up
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
