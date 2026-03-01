# Waldiez Search Service (Docs-Only)

This folder intentionally contains only deployment notes and templates.

Use it as reference when running a tiny search backend at:

- `https://search.waldiez.io/youtube/search`

for static frontend deployments (`player.waldiez.io`) where browser-to-public
API calls are blocked by CORS.

## Strict Production Profile

For production, prefer a strict backend posture:

- Serve only over HTTPS.
- Allow only exact frontend origins (no `*`).
- Keep endpoint surface minimal:
  - `GET /youtube/search`
  - `GET /healthz`
- Apply short timeouts and strict upstream fallback order.
- Enforce IP rate limiting.
- Keep API keys server-side only.
- Return normalized JSON shape only (no raw upstream passthrough).

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
CORS_ORIGINS=https://player.waldiez.io
CACHE_TTL_MS=60000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

Dev-only localhost can be temporarily added to `CORS_ORIGINS` when needed.

## Example systemd unit

```ini
[Unit]
Description=Waldiez YouTube Search Service
After=network.target

[Service]
Type=simple
User=waldiez-search
Group=waldiez-search
WorkingDirectory=/opt/waldiez/player
EnvironmentFile=/opt/waldiez/player/backend/search-service/.env
ExecStart=/home/ubuntu/.bun/bin/bun run /opt/waldiez/player/backend/search-service/server.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectControlGroups=true
ProtectKernelTunables=true
ProtectKernelModules=true
MemoryMax=300M
TasksMax=100
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Create dedicated runtime user:

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin waldiez-search
```

## Example nginx vhost

```nginx
server {
    listen 443 ssl http2;
    server_name search.example.com;

    # TLS config managed by certbot/acme
    ssl_certificate /etc/letsencrypt/live/search.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/search.example.com/privkey.pem;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy no-referrer always;
    add_header Permissions-Policy "interest-cohort=()" always;

    location = /healthz {
        proxy_pass http://127.0.0.1:8787/healthz;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        access_log off;
    }

    location = /youtube/search {
        proxy_pass http://127.0.0.1:8787/youtube/search$is_args$args;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 15s;
        proxy_connect_timeout 3s;
        proxy_send_timeout 15s;
        client_max_body_size 1k;
    }
}
```

Optional HTTP redirect:

```nginx
server {
    listen 80;
    server_name search.waldiez.io;
    return 301 https://$host$request_uri;
}
```

## Frontend wiring

Set:

```dotenv
VITE_YOUTUBE_SEARCH_BACKEND=https://search.waldiez.io/youtube/search
```

in GitHub Actions variable `VITE_YOUTUBE_SEARCH_BACKEND` and redeploy Pages.
