import { MODE_CONFIGS } from "./modeConfigs";
import type { PlayerMode, PlayerModeConfig } from "./modes";

// Helper to get mode config
export function getModeConfig(mode: PlayerMode): PlayerModeConfig {
    return MODE_CONFIGS[mode];
}

// Helper to merge custom overrides with mode defaults
export function createCustomMode(
    baseMode: PlayerMode,
    overrides: Partial<PlayerModeConfig>,
): PlayerModeConfig {
    const base = MODE_CONFIGS[baseMode];
    return {
        ...base,
        ...overrides,
        theme: { ...base.theme, ...overrides.theme },
        controls: { ...base.controls, ...overrides.controls },
        effects: { ...base.effects, ...overrides.effects },
        behavior: { ...base.behavior, ...overrides.behavior },
        audio: { ...base.audio, ...overrides.audio },
    };
}
