import { WidGen, createBrowserWidStateStore } from "./wid";

/**
 * wid — Waldiez/SYNAPSE Identifier for the player.
 *
 * Re-exports the full WID API and provides a module-level `nextWid()` singleton
 * that replaces `crypto.randomUUID()` throughout the codebase.
 *
 * IDs look like:  20260227T143052.0000Z-a3f91c
 *   - Lexicographically time-sortable
 *   - Human-readable creation timestamp (UTC)
 *   - 6-char random hex suffix (collision-resistant)
 *   - Monotonic sequence counter (10 000 IDs/s guaranteed unique)
 *
 * Generator state is persisted in localStorage under key "waldiez:wid" so
 * the sequence counter survives page reloads.
 */

export * from "./wid";
export * from "./time";

// Module-level singleton — one generator shared by the whole app.
const _gen = new WidGen({
    autoPersist: true,
    stateStore: createBrowserWidStateStore("waldiez"),
});

/**
 * Generate the next WID.
 * Drop-in replacement for `crypto.randomUUID()`.
 */
export function nextWid(): string {
    return _gen.next();
}
