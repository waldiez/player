/**
 * automations — types + localStorage helpers for local automation rules.
 * Key: "wideria-automations"
 */
import type { MoodMode } from "@/types/mood";

export type TriggerKind = "time" | "weather" | "idle" | "trackEnd";
export type ActionKind = "switchMood" | "setVolume" | "play" | "pause" | "shuffle" | "weatherMood";
export type WeatherConditionTrigger = "sunny" | "cloudy" | "rainy" | "stormy" | "snowy" | "windy";

export interface TimeTrigger {
    kind: "time";
    /** 0–23 */
    hour: number;
    /** 0–59 */
    minute: number;
    /** 0=Sun … 6=Sat; empty = every day */
    days: number[];
}

export interface WeatherTrigger {
    kind: "weather";
    condition: WeatherConditionTrigger;
}

export interface IdleTrigger {
    kind: "idle";
    afterMinutes: number;
}

export interface TrackEndTrigger {
    kind: "trackEnd";
}

export type AutomationTrigger = TimeTrigger | WeatherTrigger | IdleTrigger | TrackEndTrigger;

export interface AutomationAction {
    kind: ActionKind;
    /** Used for switchMood / weatherMood */
    mood?: MoodMode;
    /** 0–1, used for setVolume */
    volume?: number;
}

export interface AutomationRule {
    id: string;
    name: string;
    enabled: boolean;
    trigger: AutomationTrigger;
    action: AutomationAction;
}

const STORAGE_KEY = "wideria-automations";

export function readRules(): AutomationRule[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as AutomationRule[];
    } catch {
        return [];
    }
}

export function writeRules(rules: AutomationRule[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch {
        // ignore
    }
}

export function triggerSummary(trigger: AutomationTrigger): string {
    switch (trigger.kind) {
        case "time": {
            const h = String(trigger.hour).padStart(2, "0");
            const m = String(trigger.minute).padStart(2, "0");
            const days =
                trigger.days.length === 0
                    ? "every day"
                    : trigger.days.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ");
            return `At ${h}:${m} · ${days}`;
        }
        case "weather":
            return `Weather: ${trigger.condition}`;
        case "idle":
            return `After ${trigger.afterMinutes} min idle`;
        case "trackEnd":
            return "On track end";
    }
}

export function actionSummary(action: AutomationAction): string {
    switch (action.kind) {
        case "switchMood":
            return `Switch to ${action.mood ?? "?"}`;
        case "weatherMood":
            return "Switch to weather mood";
        case "setVolume":
            return `Set volume to ${Math.round((action.volume ?? 0) * 100)}%`;
        case "play":
            return "Play";
        case "pause":
            return "Pause";
        case "shuffle":
            return "Shuffle";
    }
}
