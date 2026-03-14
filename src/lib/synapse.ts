/**
 * synapse — lightweight bridge between WaldiezPlayer and SYNAPSE OS relay.
 *
 * Works in any runtime:
 *   - Tauri shell  → Tauri event API (window.__TAURI_INTERNALS__)
 *   - Browser      → SSE from relay at SYNAPSE_RELAY_URL / localhost:1421
 *
 * Used by:
 *   - App.tsx  — listen for player:mood, player:control events
 *   - MoodPlayer / playlist — post track/mood changes as IPC Notify
 */

const RELAY_URL =
    (typeof window !== "undefined" && (window as { __SYNAPSE_RELAY__?: string }).__SYNAPSE_RELAY__) ||
    "http://localhost:1421";

// ── IPC POST ──────────────────────────────────────────────────────────────────

interface IpcRequest {
    type: string;
    [key: string]: unknown;
}

export async function postIpc(req: IpcRequest): Promise<void> {
    try {
        await fetch(`${RELAY_URL}/ipc`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req),
        });
    } catch {
        // Fire-and-forget; relay may be unavailable in pure browser mode.
    }
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Emit a mood change so SYNAPSE can switch its scene to match. */
export function postMoodChanged(mood: string): void {
    void postIpc({ type: "Custom", name: "player:mood", payload: { mood } });
}

/** Emit a now-playing notification. */
export function postNowPlaying(title: string, artist?: string): void {
    void postIpc({
        type: "Notify",
        title: "Now playing",
        body: artist ? `${title} — ${artist}` : title,
        kind: "player:track",
    });
    void postIpc({ type: "Custom", name: "player:track", payload: { title, artist } });
}

// ── SSE event subscription ────────────────────────────────────────────────────

type SynapseEventHandler = (kind: string, payload: unknown) => void;

let _sse: EventSource | null = null;
const _handlers = new Set<SynapseEventHandler>();

function ensureSSE(): void {
    if (_sse) return;
    try {
        _sse = new EventSource(`${RELAY_URL}/events`);
        _sse.onmessage = ev => {
            try {
                const event = JSON.parse(ev.data as string) as {
                    kind?: { [key: string]: unknown } | string;
                };
                if (!event.kind) return;
                // SynapseEvent.kind is an enum; serde serialises it as { "Custom": { name, payload } }
                const kindObj = event.kind;
                if (typeof kindObj === "object") {
                    const [name, data] = Object.entries(kindObj)[0] ?? [];
                    if (name) _handlers.forEach(h => h(name, data));
                } else {
                    _handlers.forEach(h => h(kindObj, null));
                }
            } catch {
                // ignore malformed frames
            }
        };
        _sse.onerror = () => {
            _sse?.close();
            _sse = null;
            // Reconnect after 5s.
            setTimeout(ensureSSE, 5000);
        };
    } catch {
        // SSE not available (e.g. jest).
    }
}

/**
 * Subscribe to SYNAPSE events. Returns an unsubscribe function.
 * Automatically starts the SSE connection on first call.
 */
export function onSynapseEvent(handler: SynapseEventHandler): () => void {
    ensureSSE();
    _handlers.add(handler);
    return () => _handlers.delete(handler);
}

/**
 * Subscribe only to player:control events.
 * handler receives the command string (play|pause|next|prev|stop|volume_up|volume_down).
 */
export function onPlayerControl(handler: (command: string) => void): () => void {
    return onSynapseEvent((kind, data) => {
        if (kind === "Custom") {
            const d = data as { name?: string; payload?: { command?: string } };
            if (d?.name === "player:control" && d.payload?.command) {
                handler(d.payload.command);
            }
        }
    });
}

/**
 * Subscribe to player:mood events emitted by SYNAPSE intent recognition.
 * (mood → scene → player paradigm, reverse direction)
 */
export function onSceneMood(handler: (mood: string) => void): () => void {
    return onSynapseEvent((kind, data) => {
        if (kind === "Custom") {
            const d = data as { name?: string; payload?: { mood?: string } };
            if (d?.name === "player:mood" && d.payload?.mood) {
                handler(d.payload.mood);
            }
        }
    });
}
