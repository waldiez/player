/* eslint-disable no-console */
/**
 * Tiny YouTube search backend for static frontends.
 *
 * Endpoint:
 *   GET /youtube/search?q=<query>&limit=<1..30>
 *
 * Output shape (Invidious-like):
 *   [{ videoId, title, author, lengthSeconds, videoThumbnails: [{quality,url}] }]
 */

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? "8787");
const YOUTUBE_API_KEY = (process.env.YOUTUBE_API_KEY ?? "").trim();
const CACHE_TTL_MS = Math.max(1_000, Number(process.env.CACHE_TTL_MS ?? "60000"));
const RATE_LIMIT_WINDOW_MS = Math.max(1_000, Number(process.env.RATE_LIMIT_WINDOW_MS ?? "60000"));
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.RATE_LIMIT_MAX ?? "60"));
const CORS_ORIGINS = new Set(
  (process.env.CORS_ORIGINS ?? "https://player.waldiez.io,http://localhost:5173")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean),
);

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.perennialte.ch",
  "https://yt.artemislena.eu",
  "https://yewtu.be",
];
const NO_KEY_SEARCH_BASE = "https://yt.lemnoslife.com/noKey";

const cache = new Map();
const rate = new Map();

function toJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function parseIso8601Duration(input) {
  if (!input) return 0;
  const m = input.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function resolveCorsOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  return CORS_ORIGINS.has(origin) ? origin : null;
}

function withCors(req, res) {
  const headers = new Headers(res.headers);
  const allowed = resolveCorsOrigin(req);
  if (allowed) {
    headers.set("Access-Control-Allow-Origin", allowed);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(res.body, { status: res.status, headers });
}

function rateLimited(ip) {
  const now = Date.now();
  const current = rate.get(ip);
  if (!current || now > current.resetAt) {
    rate.set(ip, { resetAt: now + RATE_LIMIT_WINDOW_MS, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

async function fetchJson(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function searchViaYouTubeApi(query, limit) {
  if (!YOUTUBE_API_KEY) return [];
  const searchUrl =
    "https://www.googleapis.com/youtube/v3/search" +
    `?part=snippet&type=video&maxResults=${limit}` +
    `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;
  const searchJson = await fetchJson(searchUrl);
  const items = searchJson?.items;
  if (!Array.isArray(items) || items.length === 0) return [];

  const ids = items.map(i => i?.id?.videoId ?? "").filter(Boolean);
  const durations = new Map();
  if (ids.length > 0) {
    const detailsUrl =
      "https://www.googleapis.com/youtube/v3/videos" +
      `?part=contentDetails&id=${encodeURIComponent(ids.join(","))}` +
      `&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;
    const detailsJson = await fetchJson(detailsUrl);
    const detailItems = detailsJson?.items ?? [];
    for (const d of detailItems) {
      if (!d?.id) continue;
      durations.set(d.id, parseIso8601Duration(d?.contentDetails?.duration));
    }
  }

  const out = [];
  for (const item of items) {
    const videoId = item?.id?.videoId ?? "";
    if (!videoId) continue;
    const t = item?.snippet?.thumbnails ?? {};
    const thumb = t.high?.url ?? t.medium?.url ?? t.default?.url ?? "";
    out.push({
      videoId,
      title: item?.snippet?.title ?? "Unknown",
      author: item?.snippet?.channelTitle ?? "",
      lengthSeconds: durations.get(videoId) ?? 0,
      videoThumbnails: thumb ? [{ quality: "high", url: thumb }] : [],
    });
  }
  return out;
}

async function searchViaNoKeyApi(query, limit) {
  const url =
    `${NO_KEY_SEARCH_BASE}/search?part=snippet&type=video&maxResults=${limit}` +
    `&q=${encodeURIComponent(query)}`;
  const json = await fetchJson(url);
  const items = json?.items;
  if (!Array.isArray(items) || items.length === 0) return [];

  const out = [];
  for (const item of items) {
    const idObj = item?.id;
    const videoId = typeof idObj === "string" ? idObj : (idObj?.videoId ?? "");
    if (!videoId) continue;
    const t = item?.snippet?.thumbnails ?? {};
    const thumb = t.high?.url ?? t.medium?.url ?? t.default?.url ?? "";
    out.push({
      videoId,
      title: item?.snippet?.title ?? "Unknown",
      author: item?.snippet?.channelTitle ?? "",
      lengthSeconds: 0,
      videoThumbnails: thumb ? [{ quality: "high", url: thumb }] : [],
    });
  }
  return out;
}

async function searchViaInvidious(query, limit) {
  const params = new URLSearchParams({
    q: query,
    type: "video",
    fields: "videoId,title,author,lengthSeconds,videoThumbnails",
  });
  for (const base of INVIDIOUS_INSTANCES) {
    const json = await fetchJson(`${base}/api/v1/search?${params.toString()}`);
    if (!Array.isArray(json) || json.length === 0) continue;
    return json.slice(0, limit);
  }
  return [];
}

async function searchYoutube(query, limit) {
  const key = `${query.toLowerCase()}::${limit}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.data;

  const fromApi = await searchViaYouTubeApi(query, limit);
  let result = fromApi;
  if (result.length === 0) result = await searchViaNoKeyApi(query, limit);
  if (result.length === 0) result = await searchViaInvidious(query, limit);

  if (result.length > 0) {
    cache.set(key, { expiresAt: now + CACHE_TTL_MS, data: result });
  }
  return result;
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (req.method === "OPTIONS") {
      return withCors(req, toJson({}, 204));
    }

    const url = new URL(req.url);
    if (url.pathname === "/healthz") {
      return withCors(req, toJson({ ok: true, cacheEntries: cache.size, hasYoutubeApiKey: !!YOUTUBE_API_KEY }));
    }
    if (url.pathname !== "/youtube/search") {
      return withCors(req, toJson({ error: "Not found" }, 404));
    }
    if (req.method !== "GET") {
      return withCors(req, toJson({ error: "Method not allowed" }, 405));
    }
    if (rateLimited(ip)) {
      return withCors(req, toJson({ error: "Rate limit exceeded" }, 429));
    }

    const q = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") ?? "12") || 12));
    if (q.length < 2) return withCors(req, toJson([]));

    try {
      const results = await searchYoutube(q, limit);
      return withCors(req, toJson(results));
    } catch {
      return withCors(req, toJson({ error: "Search upstream unavailable" }, 502));
    }
  },
});

console.log(`[search-service] listening on http://${server.hostname}:${server.port}`);
