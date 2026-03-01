/**
 * runtime — central environment detection for frontend behavior switches.
 *
 * Runtime kinds:
 *   - web              : regular browser / hosted static
 *   - tauri-dev        : tauri shell served over http(s) in dev mode
 *   - tauri-packaged   : tauri packaged app with custom scheme
 *   - flutter-webview  : Flutter desktop shell hosting the web app
 */

export type RuntimeKind = "web" | "tauri-dev" | "tauri-packaged" | "flutter-webview";

export interface RuntimeContext {
    kind: RuntimeKind;
    isTauri: boolean;
    isPackagedDesktop: boolean;
    isFlutterWebView: boolean;
}

function runtimeMarkerFromQuery(): string {
    if (typeof window === "undefined") return "";
    try {
        return (new URLSearchParams(window.location.search).get("runtime") ?? "").trim().toLowerCase();
    } catch {
        return "";
    }
}

export function getRuntimeKind(): RuntimeKind {
    const marker = runtimeMarkerFromQuery();
    if (marker === "flutter_webview" || marker === "flutter-webview" || marker === "flutter") {
        return "flutter-webview";
    }

    if (typeof window === "undefined") return "web";
    const hasTauriInternals = "__TAURI_INTERNALS__" in window;
    if (!hasTauriInternals) return "web";

    const protocol = window.location.protocol;
    const dev = protocol === "http:" || protocol === "https:";
    return dev ? "tauri-dev" : "tauri-packaged";
}

export function getRuntimeContext(): RuntimeContext {
    const kind = getRuntimeKind();
    return {
        kind,
        isTauri: kind === "tauri-dev" || kind === "tauri-packaged",
        isPackagedDesktop: kind === "tauri-packaged" || kind === "flutter-webview",
        isFlutterWebView: kind === "flutter-webview",
    };
}
