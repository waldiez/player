import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { IncomingMessage, ServerResponse } from "http";
import { resolve } from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const isTauriEnv = !!process.env.TAURI_ENV_TARGET_TRIPLE;
const prefersPolling = process.env.VITE_USE_POLLING === "1" || (isTauriEnv && process.platform === "linux");
const watchInterval = Number(process.env.VITE_WATCH_INTERVAL ?? "300");
const DEV_INVIDIOUS_INSTANCES = [
    "https://inv.nadeko.net",
    "https://invidious.perennialte.ch",
    "https://yt.artemislena.eu",
    "https://yewtu.be",
    "https://invidious.privacyredirect.com",
];

function respondJson(res: ServerResponse<IncomingMessage>, status: number, payload: unknown) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(payload));
}

function youtubeSearchProxyPlugin() {
    return {
        name: "youtube-search-dev-proxy",
        configureServer(server: {
            middlewares: {
                use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
            };
        }) {
            server.middlewares.use(async (req, res, next) => {
                if (!req.url?.startsWith("/api/youtube/search")) {
                    next();
                    return;
                }
                if (req.method === "OPTIONS") {
                    res.statusCode = 204;
                    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
                    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
                    res.end();
                    return;
                }
                if (req.method !== "GET") {
                    respondJson(res, 405, { error: "Method not allowed" });
                    return;
                }

                const url = new URL(req.url, "http://localhost");
                const q = (url.searchParams.get("q") ?? "").trim();
                const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") ?? "12") || 12));
                if (q.length < 2) {
                    respondJson(res, 200, []);
                    return;
                }

                const upstreamQuery = new URLSearchParams({
                    q,
                    type: "video",
                    fields: "videoId,title,author,lengthSeconds,videoThumbnails",
                    page: "1",
                });

                for (const base of DEV_INVIDIOUS_INSTANCES) {
                    try {
                        const upstream = await fetch(`${base}/api/v1/search?${upstreamQuery.toString()}`);
                        if (!upstream.ok) continue;
                        const json = await upstream.json();
                        if (!Array.isArray(json)) continue;
                        respondJson(res, 200, json.slice(0, limit));
                        return;
                    } catch {
                        // Try next upstream.
                    }
                }
                respondJson(res, 502, { error: "No search backend available" });
            });
        },
    };
}

export default defineConfig({
    base: process.env.VITE_BASE_PATH ?? "/",
    plugins: [
        react(),
        tailwindcss(),
        youtubeSearchProxyPlugin(),
        !isTauriEnv &&
            VitePWA({
                registerType: "autoUpdate",
                includeAssets: ["waldiez-player.svg", "default.wid"],
                manifest: {
                    id: "/",
                    name: "Waldiez Player",
                    short_name: "Waldiez",
                    description: "Web + desktop player with mood modes and streaming",
                    theme_color: "#12121a",
                    background_color: "#12121a",
                    display: "standalone",
                    orientation: "any",
                    scope: "/",
                    start_url: "/",
                    categories: ["music", "entertainment"],
                    screenshots: [
                        {
                            src: "social-preview-1200x630.png",
                            sizes: "1200x630",
                            type: "image/png",
                            form_factor: "wide",
                            label: "Waldiez Player — mood modes and streaming",
                        },
                        {
                            src: "social-preview.png",
                            sizes: "512x512",
                            type: "image/png",
                            form_factor: "narrow",
                            label: "Waldiez Player",
                        },
                    ],
                    protocol_handlers: [
                        {
                            protocol: "web+waldiez",
                            url: "/?uri=%s",
                        },
                    ],
                    icons: [
                        { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
                        { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
                        { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
                        {
                            src: "maskable-icon-512x512.png",
                            sizes: "512x512",
                            type: "image/png",
                            purpose: "maskable",
                        },
                    ],
                },
                workbox: {
                    // Exclude the hourly-refreshed CDN file from precaching so
                    // the service worker never serves a stale build-time snapshot.
                    globPatterns: ["**/*.{js,css,html,svg,png,wid}"],
                    globIgnores: ["**/cdn/repo/latest-auto.wid"],
                    // Always fetch latest-auto.wid from the network; fall back
                    // to the network error → the app will use default.wid instead.
                    runtimeCaching: [
                        {
                            urlPattern: /\/latest-auto\.wid(\?.*)?$/,
                            handler: "NetworkOnly",
                        },
                    ],
                },
            }),
    ].filter(Boolean),
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
            "@waldiez/editor-core": resolve(__dirname, "./packages/editor-core/src/index.ts"),
        },
    },
    clearScreen: false,
    server: {
        // port: 1420,
        host: true,
        strictPort: true,
        watch: {
            ignored: ["**/src-tauri/**"],
            usePolling: prefersPolling,
            interval: Number.isFinite(watchInterval) && watchInterval > 0 ? watchInterval : 300,
        },
    },
    build: {
        target: ["es2022", "chrome100", "safari15"],
        minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
        sourcemap: !!process.env.TAURI_DEBUG,
    },
});
