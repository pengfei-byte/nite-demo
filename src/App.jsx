import { useCallback, useEffect, useRef, useState } from "react";
import AgeGate from "./components/AgeGate.jsx";
import Lobby from "./components/Lobby.jsx";
import Matching from "./components/Matching.jsx";
import Call from "./components/Call.jsx";
import Ended from "./components/Ended.jsx";

const AGE_KEY = "nite.age.ok";

function explainFetchError(err, data, status) {
  if (data?.error) {
    const e = data.error;
    const bits = [e.message || "接通失败"];
    if (e.code) bits.push(`code=${e.code}`);
    if (e.status) bits.push(`status=${e.status}`);
    if (e.request_id) bits.push(`request_id=${e.request_id}`);
    const wrapped = new Error(bits.join(" · "));
    wrapped.code = e.code;
    wrapped.retryAfter = e.retry_after_ms;
    return wrapped;
  }
  if (err?.name === "TypeError" || /failed to fetch/i.test(err?.message || "")) {
    return new Error(
      "本地服务断开了（Failed to fetch）。请确认终端里 npm run dev 还在跑，然后刷新页面。"
    );
  }
  return new Error(err?.message || `接通失败${status ? ` (${status})` : ""}`);
}

async function connectSession(payload) {
  let res;
  try {
    res = await fetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw explainFetchError(err);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw explainFetchError(null, data, res.status);
  return data;
}

export default function App() {
  const [view, setView] = useState(
    () => (sessionStorage.getItem(AGE_KEY) ? "lobby" : "gate")
  );
  const [roster, setRoster] = useState({ characters: [], moods: [], online: 0 });
  const [localStream, setLocalStream] = useState(null);
  const [mood, setMood] = useState("random");
  const [match, setMatch] = useState(null);
  const [endInfo, setEndInfo] = useState(null);
  const [matchError, setMatchError] = useState("");
  const seenRef = useRef([]);
  const closingRef = useRef(false);

  useEffect(() => {
    fetch("/api/roster")
      .then((r) => r.json())
      .then(setRoster)
      .catch(() => {});
  }, []);

  const ensureCam = useCallback(async () => {
    if (localStream) return localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: true,
      });
      setLocalStream(stream);
      return stream;
    } catch {
      return null;
    }
  }, [localStream]);

  const closeRemote = useCallback((sessionId) => {
    if (!sessionId || closingRef.current) return;
    fetch(`/api/sessions/${sessionId}/close`, { method: "POST" }).catch(() => {});
  }, []);

  const startMatch = useCallback(
    async ({ characterId, nextMood } = {}) => {
      setMatchError("");
      setView("matching");
      await ensureCam();
      const chosenMood = nextMood ?? mood;
      const minWait = new Promise((r) => setTimeout(r, 1600));
      const payload = {
        characterId,
        mood: chosenMood,
        exclude: seenRef.current.slice(-3),
      };
      try {
        let data;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            data = await connectSession(payload);
            break;
          } catch (err) {
            if (err.code === "no_capacity" && attempt < 3) {
              await new Promise((r) =>
                setTimeout(r, Math.min(err.retryAfter || 2500, 6000))
              );
              continue;
            }
            throw err;
          }
        }
        await minWait;
        if (data?.character?.id) {
          seenRef.current = [...seenRef.current, data.character.id];
        }
        setMatch(data);
        setView("call");
      } catch (err) {
        await minWait;
        setMatchError(err.message || "今晚有点挤");
        setView("lobby");
      }
    },
    [ensureCam, mood]
  );

  const hangUp = useCallback(
    (info) => {
      if (match?.session?.session_id) closeRemote(match.session.session_id);
      setEndInfo(info || { reason: "client_closed" });
      setMatch(null);
      setView("ended");
    },
    [closeRemote, match]
  );

  const nextPerson = useCallback(() => {
    const sessionId = match?.session?.session_id;
    setMatch(null);
    if (sessionId) closeRemote(sessionId);
    startMatch();
  }, [closeRemote, match, startMatch]);

  useEffect(() => {
    const onLeave = () => {
      const id = match?.session?.session_id;
      if (id) {
        navigator.sendBeacon(`/api/sessions/${id}/close`);
      }
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [match]);

  return (
    <div className="shell">
      <div className="grain" aria-hidden />
      {view === "gate" && (
        <AgeGate
          onEnter={() => {
            sessionStorage.setItem(AGE_KEY, "1");
            setView("lobby");
          }}
        />
      )}
      {view === "lobby" && (
        <Lobby
          roster={roster}
          mood={mood}
          onMood={setMood}
          localStream={localStream}
          error={matchError}
          onStart={() => startMatch()}
          onPick={(id) => startMatch({ characterId: id })}
          onCam={ensureCam}
        />
      )}
      {view === "matching" && <Matching roster={roster} />}
      {view === "call" && match && (
        <Call
          match={match}
          localStream={localStream}
          onNext={nextPerson}
          onEnd={() => hangUp({ reason: "client_closed" })}
          onRemoteEnd={(data) => hangUp(data)}
        />
      )}
      {view === "ended" && (
        <Ended
          info={endInfo}
          onAgain={() => startMatch()}
          onLobby={() => setView("lobby")}
        />
      )}
    </div>
  );
}
