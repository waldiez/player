import { reportDiagnostic } from "@/lib/diagnostics";
import { type RuntimeContext, getRuntimeContext } from "@/lib/runtime";
import { mpvCheck, ytCheck } from "@/lib/tauriPlayer";

export type DesktopCapabilityStatus = "ready" | "missing" | "error" | "unavailable";
export type DesktopOverallStatus = "idle" | "checking" | "ready" | "degraded" | "web";

export interface DesktopStatusSnapshot {
    runtime: RuntimeContext["kind"];
    overall: DesktopOverallStatus;
    checkedAt: string | null;
    summary: string;
    listenersReady: boolean | null;
    fileOpenEvents: boolean | null;
    deepLinkEvents: boolean | null;
    backends: {
        ytDlp: DesktopCapabilityStatus;
        mpv: DesktopCapabilityStatus;
    };
}

const listeners = new Set<() => void>();

let snapshot: DesktopStatusSnapshot = {
    runtime: getRuntimeContext().kind,
    overall: "idle",
    checkedAt: null,
    summary: "Desktop readiness has not been checked yet.",
    listenersReady: null,
    fileOpenEvents: null,
    deepLinkEvents: null,
    backends: {
        ytDlp: "unavailable",
        mpv: "unavailable",
    },
};

function emit(): void {
    for (const listener of listeners) listener();
}

function setSnapshot(next: DesktopStatusSnapshot): DesktopStatusSnapshot {
    snapshot = next;
    emit();
    return snapshot;
}

function capabilityLabel(status: DesktopCapabilityStatus): string {
    if (status === "ready") return "available";
    if (status === "missing") return "missing";
    if (status === "error") return "error";
    return "not applicable";
}

export function getDesktopStatus(): DesktopStatusSnapshot {
    return snapshot;
}

export function subscribeDesktopStatus(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export async function refreshDesktopStatus(options?: {
    listenersReady?: boolean;
    fileOpenEvents?: boolean;
    deepLinkEvents?: boolean;
}): Promise<DesktopStatusSnapshot> {
    const runtime = getRuntimeContext();

    setSnapshot({
        ...snapshot,
        runtime: runtime.kind,
        overall: runtime.isTauri || runtime.isFlutterWebView ? "checking" : "web",
        summary:
            runtime.isTauri || runtime.isFlutterWebView
                ? "Checking desktop runtime readiness."
                : "Web runtime does not require desktop readiness checks.",
    });

    if (!runtime.isTauri) {
        if (runtime.isFlutterWebView) {
            return setSnapshot({
                runtime: runtime.kind,
                overall: "degraded",
                checkedAt: new Date().toISOString(),
                summary: "Flutter shell detected. Native Tauri backend checks are unavailable in this build.",
                listenersReady: null,
                fileOpenEvents: null,
                deepLinkEvents: null,
                backends: {
                    ytDlp: "unavailable",
                    mpv: "unavailable",
                },
            });
        }
        return setSnapshot({
            runtime: runtime.kind,
            overall: "web",
            checkedAt: new Date().toISOString(),
            summary: "Web runtime does not require desktop readiness checks.",
            listenersReady: null,
            fileOpenEvents: null,
            deepLinkEvents: null,
            backends: {
                ytDlp: "unavailable",
                mpv: "unavailable",
            },
        });
    }

    const [ytDlpResult, mpvResult] = await Promise.allSettled([ytCheck(), mpvCheck()]);

    const ytDlpStatus: DesktopCapabilityStatus =
        ytDlpResult.status === "fulfilled" ? (ytDlpResult.value ? "ready" : "missing") : "error";
    const mpvStatus: DesktopCapabilityStatus =
        mpvResult.status === "fulfilled" ? (mpvResult.value ? "ready" : "missing") : "error";

    const listenersReady = options?.listenersReady ?? snapshot.listenersReady;
    const fileOpenEvents = options?.fileOpenEvents ?? snapshot.fileOpenEvents;
    const deepLinkEvents = options?.deepLinkEvents ?? snapshot.deepLinkEvents;
    const listenerStateOk = listenersReady !== false && fileOpenEvents !== false && deepLinkEvents !== false;

    const degraded = ytDlpStatus !== "ready" || mpvStatus !== "ready" || !listenerStateOk;
    const parts = [
        `yt-dlp ${capabilityLabel(ytDlpStatus)}`,
        `mpv ${capabilityLabel(mpvStatus)}`,
        listenersReady === false || fileOpenEvents === false || deepLinkEvents === false
            ? "desktop event listeners incomplete"
            : "desktop event listeners ready",
    ];

    const next = setSnapshot({
        runtime: runtime.kind,
        overall: degraded ? "degraded" : "ready",
        checkedAt: new Date().toISOString(),
        summary: degraded
            ? `Desktop readiness degraded: ${parts.join(", ")}.`
            : "Desktop runtime ready: yt-dlp and mpv available, event listeners ready.",
        listenersReady,
        fileOpenEvents,
        deepLinkEvents,
        backends: {
            ytDlp: ytDlpStatus,
            mpv: mpvStatus,
        },
    });

    if (ytDlpStatus === "missing") {
        reportDiagnostic({
            level: "warn",
            area: "desktop",
            message: "yt-dlp is not available in the desktop runtime.",
        });
    } else if (ytDlpStatus === "error") {
        reportDiagnostic({
            level: "error",
            area: "desktop",
            message: "yt-dlp readiness check failed.",
        });
    }

    if (mpvStatus === "missing") {
        reportDiagnostic({
            level: "warn",
            area: "desktop",
            message: "mpv is not available in the desktop runtime.",
        });
    } else if (mpvStatus === "error") {
        reportDiagnostic({
            level: "error",
            area: "desktop",
            message: "mpv readiness check failed.",
        });
    }

    if (!listenerStateOk) {
        reportDiagnostic({
            level: "warn",
            area: "desktop",
            message: "Desktop event listeners are not fully ready.",
        });
    }

    return next;
}
