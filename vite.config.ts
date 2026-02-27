import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const isTauriEnv = !!process.env.TAURI_ENV_TARGET_TRIPLE;

export default defineConfig({
    base: process.env.VITE_BASE_PATH ?? "/",
    plugins: [
        react(),
        tailwindcss(),
        !isTauriEnv &&
            VitePWA({
                registerType: "autoUpdate",
                includeAssets: ["waldiez-player.svg", "default.wid"],
                manifest: {
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
                    globPatterns: ["**/*.{js,css,html,svg,png,wid}"],
                },
            }),
    ].filter(Boolean),
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    clearScreen: false,
    server: {
        // port: 1420,
        host: true,
        strictPort: true,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
    },
    build: {
        target: ["es2022", "chrome100", "safari15"],
        minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
        sourcemap: !!process.env.TAURI_DEBUG,
    },
});
