const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const ANALYSE_PROMPT =
  "You are the coolest art teacher a teenager has ever had: sharp, funny, never preachy. The attached image is a photo or upload of an artwork. " +
  "Reply with only one JSON object: " +
  '{"title": string, "artist": string, "period": string, "year": string, "confidence": "high"|"medium"|"low", "note": string, "facts": [{"type": string, "text": string}, {"type": string, "text": string}, {"type": string, "text": string}]}. ' +
  "Rules: Name the work only if you are confident. If it is not a work you know, use a short descriptive title, put 'Unknown' as artist, give your best read of style and period, and set confidence to low. " +
  "year may be an approximate range or empty. note is one short sentence, only if the photo is unclear, cropped, a detail or a reproduction, otherwise an empty string. " +
  "facts: exactly three, each a different type chosen from Colour, Style, Technique, Period, Artist, Quote. Each text is at most 45 words, concrete and specific, no filler. " +
  "Use a Quote only if you are sure the artist really said or wrote it, and say where. Never invent a quote or a trivia fact. " +
  "Voice: talk straight to a teenager (14 to 18). Short punchy sentences, casual and a little cheeky, like a friend who really knows art. No lecture tone, explain any art word in a few plain words, no emojis, no forced slang. Stay accurate. Write in English.";

function challengePrompt(e) {
  const clip = (s, n) => String(s || "").slice(0, n);
  const ctx = (Array.isArray(e.facts) ? e.facts : []).slice(0, 3)
    .map((f) => clip(f && f.type, 20) + ": " + clip(f && f.text, 300)).join(" | ");
  return (
    'Artwork: "' + clip(e.title, 120) + '" by ' + clip(e.artist, 80) + " (" + clip(e.period, 80) + "). Notes: " + ctx + " " +
    "Invent one short, fun, hands-on dare for a teenager that can be finished in 15 minutes, either making their own art inspired by this work or trying a technique the artist used. " +
    "Use only simple things: pen, pencil, paper, scissors, glue, tape, markers, a printer, old magazines. Concrete and punchy, not childish, no fluff. " +
    'Talk to the teenager directly ("you"), casual and a little cheeky, so it feels like a dare and not homework. The title should sound like a dare. ' +
    'Reply with only JSON: {"title": "max 5 words", "materials": ["3 to 5 items"], "steps": ["3 to 5 short imperative steps"], "twist": "one sentence extra push"}.'
  );
}

/* ---------- Gemini ---------- */
async function callGemini(parts) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(MODEL) + ":generateContent";
  const r = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 },
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    console.error("Gemini API error", r.status, body);
    const err = new Error("upstream");
    err.status = r.status;
    err.daily = /PerDay/i.test(body);
    err.detail = "Gemini " + r.status + ": " + body.replace(/\s+/g, " ").slice(0, 200);
    throw err;
  }
  const d = await r.json();
  const p = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
  const text = p.map((x) => x.text || "").join("");
  if (!text) {
    const why = (d.candidates && d.candidates[0] && d.candidates[0].finishReason) || (d.promptFeedback && d.promptFeedback.blockReason) || "unknown";
    const err = new Error("empty");
    err.detail = "Empty answer from Gemini (" + why + ")";
    throw err;
  }
  return text;
}

function parseJson(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no json");
  return JSON.parse(text.slice(a, b + 1));
}

/* ---------- Supabase (server side) ---------- */
const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : d; };
const LIMITS = () => ({
  scan: num(process.env.SCAN_LIMIT, 3),
  dare: num(process.env.DARE_LIMIT, 3),
  global: num(process.env.GLOBAL_LIMIT, 150),
});

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { apikey: key, "content-type": "application/json" };
  if (key.startsWith("eyJ")) h.authorization = "Bearer " + key; // legacy JWT-style keys need this too
  return h;
}

async function rpc(name, args) {
  const r = await fetch(process.env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error("rpc " + name + " " + r.status + " " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function authUser(req) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  if (!token) return null;
  const r = await fetch(process.env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: "Bearer " + token },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

function missingEnv() {
  return ["GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
}

/* Checks method, setup, login and the daily limit. Returns {user, claim} or null after answering. */
async function guard(req, res, kind) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return null; }
  const missing = missingEnv();
  if (missing.length) { res.status(500).json({ error: "Server not set up", detail: "Missing: " + missing.join(", ") }); return null; }
  const user = await authUser(req);
  if (!user) { res.status(401).json({ error: "Log in first" }); return null; }
  let claim;
  try {
    const L = LIMITS();
    claim = await rpc("claim_usage", { p_user: user.id, p_kind: kind, p_user_limit: L[kind], p_global_limit: L.global });
  } catch (e) {
    console.error("Usage check failed:", e.message);
    res.status(500).json({ error: "Usage check failed", detail: "Could not check your daily limit. Is supabase/setup.sql installed?" });
    return null;
  }
  if (!claim || !claim.ok) {
    res.status(429).json({ error: "Limit reached", reason: (claim && claim.reason) || "user", limit: claim && claim.limit, detail: "Daily limit reached" });
    return null;
  }
  return { user, claim };
}

async function refund(userId, kind) {
  try { await rpc("refund_usage", { p_user: userId, p_kind: kind }); } catch (e) { console.error("Refund failed:", e.message); }
}

async function fail(res, e, g, kind) {
  console.error("Request failed:", e && (e.detail || e.message));
  if (g) await refund(g.user.id, kind);
  const status = e && e.status === 429 ? 429 : 502;
  return res.status(status).json({
    error: "AI request failed",
    reason: e && e.status === 429 ? (e.daily ? "gemini_daily" : "gemini_rate") : "upstream",
    detail: String((e && (e.detail || e.message)) || "").slice(0, 300),
  });
}

module.exports = { ANALYSE_PROMPT, challengePrompt, callGemini, parseJson, guard, fail, rpc, authUser, missingEnv, LIMITS };
