/**
 * useAutomations — evaluates automation rules and dispatches matching actions.
 */
import { type AutomationRule, type WeatherConditionTrigger, readRules, writeRules } from "@/lib/automations";
import { getSuggestedMood, getSuggestedWeatherCondition } from "@/lib/weatherMood";
import { usePlayerStore } from "@/stores";

import { useCallback, useEffect, useRef, useState } from "react";

function makeId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export function useAutomations() {
    const [rules, setRules] = useState<AutomationRule[]>(readRules);

    const { setVolume, togglePlay, playNextInLibrary, setPlayerMode } = usePlayerStore.getState();

    const lastFiredRef = useRef<Record<string, number>>({});
    const rulesRef = useRef(rules);
    rulesRef.current = rules;

    // Dispatch an action for a rule
    const dispatch = useCallback(
        async (rule: AutomationRule) => {
            const { action } = rule;
            switch (action.kind) {
                case "switchMood":
                    if (action.mood) setPlayerMode(action.mood as Parameters<typeof setPlayerMode>[0]);
                    break;
                case "weatherMood": {
                    const mood = await getSuggestedMood();
                    setPlayerMode(mood as Parameters<typeof setPlayerMode>[0]);
                    break;
                }
                case "setVolume":
                    if (action.volume !== undefined) setVolume(action.volume);
                    break;
                case "play": {
                    const state = usePlayerStore.getState();
                    if (!state.playback.isPlaying) togglePlay();
                    break;
                }
                case "pause": {
                    const state = usePlayerStore.getState();
                    if (state.playback.isPlaying) togglePlay();
                    break;
                }
                case "shuffle":
                    playNextInLibrary();
                    break;
            }
        },
        [setPlayerMode, setVolume, togglePlay, playNextInLibrary],
    );

    const tryFire = useCallback(
        async (rule: AutomationRule) => {
            if (!rule.enabled) return;
            const now = Date.now();
            // Debounce: don't fire the same rule twice within 60 s
            if (now - (lastFiredRef.current[rule.id] ?? 0) < 60_000) return;
            lastFiredRef.current[rule.id] = now;
            await dispatch(rule);
        },
        [dispatch],
    );

    // ── Time trigger — checked every 60 s ───────────────────────────────────
    useEffect(() => {
        const check = () => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            const dow = now.getDay();
            for (const rule of rulesRef.current) {
                if (!rule.enabled) continue;
                if (rule.trigger.kind !== "time") continue;
                const t = rule.trigger;
                if (t.hour !== h || t.minute !== m) continue;
                if (t.days.length > 0 && !t.days.includes(dow)) continue;
                void tryFire(rule);
            }
        };
        const id = setInterval(check, 60_000);
        return () => clearInterval(id);
    }, [tryFire]);

    // ── TrackEnd trigger ────────────────────────────────────────────────────
    useEffect(() => {
        return usePlayerStore.subscribe(state => {
            const { currentTime, duration } = state.playback;
            if (duration > 0 && currentTime >= duration - 0.5) {
                for (const rule of rulesRef.current) {
                    if (rule.enabled && rule.trigger.kind === "trackEnd") {
                        void tryFire(rule);
                    }
                }
            }
        });
    }, [tryFire]);

    // ── Weather trigger — checked when condition changes ────────────────────
    const checkWeatherTriggers = useCallback(
        async (condition: WeatherConditionTrigger) => {
            for (const rule of rulesRef.current) {
                if (!rule.enabled) continue;
                if (rule.trigger.kind !== "weather") continue;
                if (rule.trigger.condition === condition) {
                    await tryFire(rule);
                }
            }
        },
        [tryFire],
    );

    // Periodically check weather condition (every 15 min)
    useEffect(() => {
        const check = () => {
            const cond = getSuggestedWeatherCondition();
            if (cond) void checkWeatherTriggers(cond);
        };
        check();
        const id = setInterval(check, 15 * 60_000);
        return () => clearInterval(id);
    }, [checkWeatherTriggers]);

    // ── Idle trigger — subscribe to idle state from store (if present) ──────
    useEffect(() => {
        return usePlayerStore.subscribe(state => {
            // idleMinutes is not currently in the store; check via playback
            // This is a placeholder: real idle detection happens via useIdleTimer in App
            void state;
        });
    }, []);

    // ── Public API ───────────────────────────────────────────────────────────
    const persist = useCallback((next: AutomationRule[]) => {
        writeRules(next);
        setRules(next);
    }, []);

    const addRule = useCallback(
        (rule: Omit<AutomationRule, "id">) => {
            persist([...rulesRef.current, { ...rule, id: makeId() }]);
        },
        [persist],
    );

    const removeRule = useCallback(
        (id: string) => {
            persist(rulesRef.current.filter(r => r.id !== id));
        },
        [persist],
    );

    const toggleRule = useCallback(
        (id: string) => {
            persist(rulesRef.current.map(r => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
        },
        [persist],
    );

    const updateRule = useCallback(
        (id: string, patch: Partial<AutomationRule>) => {
            persist(rulesRef.current.map(r => (r.id === id ? { ...r, ...patch } : r)));
        },
        [persist],
    );

    // Expose fireIdleTriggers so App can call it from useIdleTimer callback
    const fireIdleTriggers = useCallback(
        async (elapsedMinutes: number) => {
            for (const rule of rulesRef.current) {
                if (!rule.enabled) continue;
                if (rule.trigger.kind !== "idle") continue;
                if (elapsedMinutes >= rule.trigger.afterMinutes) {
                    await tryFire(rule);
                }
            }
        },
        [tryFire],
    );

    return { rules, addRule, removeRule, toggleRule, updateRule, fireIdleTriggers };
}
