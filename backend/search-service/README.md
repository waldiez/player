# Waldiez Search Service

Lightweight backend for YouTube keyword search, intended for static frontends
(`player.waldiez.io`) where direct browser calls fail due to CORS.

## Endpoint

- `GET /youtube/search?q=<query>&limit=<1..30>`
- Returns Invidious-like JSON entries:
  - `videoId`
  - `title`
  - `author`
  - `lengthSeconds`
  - `videoThumbnails`

## Runtime

- Bun only (`Bun.serve`), no framework dependency
- Works on a small VM (2 vCPU / 2 GB RAM is enough)

## Upstream strategy

1. YouTube Data API (if `YOUTUBE_API_KEY` is provided)
2. no-key API (`yt.lemnoslife.com/noKey`)
3. Invidious instances (server-side, no browser CORS issue)

## Environment

Copy `.env.example` to `.env` and set values:

```bash
cp backend/search-service/.env.example backend/search-service/.env
```

Important vars:

- `YOUTUBE_API_KEY` (recommended for reliability)
- `CORS_ORIGINS` (comma-separated allowlist)
- `PORT` (default `8787`)

## Run locally

```bash
bun run backend/search-service/server.mjs
```

Health check:

```bash
curl http://127.0.0.1:8787/healthz
```

## Nginx + systemd deploy

Use provided files:

- `backend/search-service/nginx.search.waldiez.io.conf`
- `backend/search-service/waldiez-search.service`

Typical flow:

1. Install Bun on VM.
2. Copy project to `/opt/waldiez/player`.
3. Create `/opt/waldiez/player/backend/search-service/.env`.
4. Install systemd unit and start:
   - `sudo cp backend/search-service/waldiez-search.service /etc/systemd/system/`
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable --now waldiez-search`
5. Enable nginx server config and reload nginx.

## Frontend wiring

Set frontend env:

```bash
VITE_YOUTUBE_SEARCH_BACKEND=https://search.waldiez.io/youtube/search
```

Then deploy frontend.
