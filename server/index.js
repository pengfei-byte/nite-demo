import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHARACTERS, MOODS, pickCharacter, publicCharacter } from "./characters.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8787);
const BASE = process.env.POPVID_BASE_URL || "https://popvid.ai/api/public/v1";
const KEY = process.env.POPVID_API_KEY;

if (!KEY) {
  console.warn("Missing POPVID_API_KEY — matching will fail until it is set");
}

app.set("trust proxy", true);
app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

const sessions = new Map();
const connectHits = new Map();
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_SESSIONS || 3);
const CONNECT_LIMIT = Number(process.env.CONNECT_LIMIT_PER_IP || 8);
const CONNECT_WINDOW_MS = 15 * 60 * 1000;

function clientIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function allowConnect(ip) {
  const now = Date.now();
  const recent = (connectHits.get(ip) || []).filter((t) => now - t < CONNECT_WINDOW_MS);
  if (recent.length >= CONNECT_LIMIT) return false;
  recent.push(now);
  connectHits.set(ip, recent);
  return true;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  };
}

async function createPopvidSession(character, { dropSeed = false } = {}) {
  const body = {
    model: "r2-realtime-v1",
    character: {
      name: character.name,
      prompt: character.prompt,
    },
    scene: { prompt: character.scene },
    language: "en",
    limits: { max_turns: 200, turn_rate_per_min: 20 },
    credentials_ttl_ms: 600_000,
    metadata: {
      product: "nite",
      character_id: character.id,
    },
  };
  if (!dropSeed) body.seed_image_url = character.seed;

  const res = await fetch(`${BASE}/connections`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, product: "nite" });
});

app.get("/api/roster", (_req, res) => {
  res.json({
    moods: MOODS,
    online: 1800 + Math.floor(Math.random() * 900),
    characters: CHARACTERS.map(publicCharacter),
  });
});

app.post("/api/connect", async (req, res) => {
  const ip = clientIp(req);
  if (sessions.size >= MAX_CONCURRENT) {
    return res.status(429).json({
      error: {
        code: "busy",
        message: "Someone else is on a call. Try again in a moment.",
        status: 429,
        retry_after_ms: 8000,
      },
    });
  }
  if (!allowConnect(ip)) {
    return res.status(429).json({
      error: {
        code: "rate_limited",
        message: "Too many matches from this device. Give it a few minutes.",
        status: 429,
        retry_after_ms: 60000,
      },
    });
  }

  if (!KEY) {
    return res.status(503).json({
      error: {
        code: "misconfigured",
        message: "Server is missing POPVID_API_KEY",
        status: 503,
      },
    });
  }

  const { characterId, mood, exclude } = req.body || {};
  const character = pickCharacter({
    characterId,
    mood,
    exclude: Array.isArray(exclude) ? exclude : [],
  });
  console.log("[connect] start", {
    characterId: character.id,
    mood: mood || null,
    exclude: exclude || [],
  });

  let result;
  try {
    result = await createPopvidSession(character);
  } catch (err) {
    console.error("[connect] popvid fetch threw", err);
    return res.status(502).json({
      error: {
        code: "upstream_unreachable",
        message: `Can't reach PopVid: ${err.message}`,
        status: 502,
      },
    });
  }
  if (!result.ok && result.status === 422 && !result.data?.error?.code) {
    result = await createPopvidSession(character, { dropSeed: true });
  }
  if (!result.ok && result.data?.error?.code === "content_rejected") {
    result = await createPopvidSession(character, { dropSeed: true });
  }

  if (!result.ok) {
    const err = result.data?.error || {
      code: "upstream",
      message: "Couldn't connect",
      status: result.status,
    };
    console.error("[connect] popvid rejected", result.status, err);
    return res.status(result.status || 502).json({ error: err });
  }

  console.log("[connect] ok", result.data.session?.session_id, character.id);

  const { session, credentials } = result.data;
  if (!session?.session_id || !credentials) {
    return res.status(502).json({
      error: { code: "bad_payload", message: "Incomplete session payload" },
    });
  }

  sessions.set(session.session_id, {
    characterId: character.id,
    createdAt: Date.now(),
  });

  res.status(201).json({
    credentials,
    session: {
      session_id: session.session_id,
      reservation_expires_at_ms: session.reservation_expires_at_ms,
      media: session.media,
    },
    character: publicCharacter(character),
  });
});

async function closeRemote(sessionId) {
  const res = await fetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  sessions.delete(sessionId);
  return { ok: res.ok || res.status === 404, status: res.status, data };
}

app.delete("/api/sessions/:id", async (req, res) => {
  const { id } = req.params;
  const result = await closeRemote(id);
  res.status(result.ok ? 200 : result.status).json(result.data || { ok: true });
});

app.post("/api/sessions/:id/close", async (req, res) => {
  const { id } = req.params;
  await closeRemote(id);
  res.json({ ok: true });
});

if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "..", "dist");
  app.use(express.static(dist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NITE server on http://0.0.0.0:${PORT}`);
  });

  setInterval(() => {
    const cutoff = Date.now() - 6 * 60 * 1000;
    for (const [id, row] of sessions) {
      if (row.createdAt < cutoff) sessions.delete(id);
    }
  }, 30_000);
}
