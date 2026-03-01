# Waldiez Search Service (Docs-Only)

This folder intentionally contains only deployment notes and templates.

Use it as reference when running a tiny search backend at:

- `https://search.waldiez.io/youtube/search`

for static frontend deployments (`player.waldiez.io`) where browser-to-public
API calls are blocked by CORS.

## Required endpoint contract

`GET /youtube/search?q=<query>&limit=<1..30>`

Response (array of Invidious-like items):

```json
[
  {
    "videoId": "qjSCtleM-bE",
    "title": "Example title",
    "author": "Channel Name",
    "lengthSeconds": 123,
    "videoThumbnails": [{ "quality": "high", "url": "https://..." }]
  }
]
```

## Recommended upstream order

1. YouTube Data API (server-side key)
2. no-key fallback API
3. Invidious fallback

Add short TTL cache + basic IP rate limiting.

## Example `.env`

```dotenv
HOST=127.0.0.1
PORT=8787
YOUTUBE_API_KEY=
CORS_ORIGINS=https://player.waldiez.io,http://localhost:5173
CACHE_TTL_MS=60000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

## Example systemd unit

```ini
[Unit]
Description=Waldiez YouTube Search Service
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/waldiez/player
EnvironmentFile=/opt/waldiez/player/backend/search-service/.env
ExecStart=/home/ubuntu/.bun/bin/bun run /opt/waldiez/player/backend/search-service/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

## Example nginx vhost

```nginx
server {
    listen 80;
    server_name search.waldiez.io;

    location = /healthz {
        proxy_pass http://127.0.0.1:8787/healthz;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location = /youtube/search {
        proxy_pass http://127.0.0.1:8787/youtube/search$is_args$args;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 15s;
    }
}
```

## Frontend wiring

Set:

```dotenv
VITE_YOUTUBE_SEARCH_BACKEND=https://search.waldiez.io/youtube/search
```

in GitHub Actions variable `VITE_YOUTUBE_SEARCH_BACKEND` and redeploy Pages.
