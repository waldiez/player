import { describe, expect, it } from "vitest";

import { MODE_CONFIGS, type PlayerMode, createCustomMode, getModeConfig } from "./modes";

describe("modes config", () => {
    const allModes: PlayerMode[] = [
        "standard",
        "storyteller",
        "audiobook",
        "cinema",
        "presentation",
        "learning",
        "journey",
        "dock",
        "storm",
        "fest",
        "rock",
        "pop",
        "disco",
    ];

    it("contains a config entry for every player mode", () => {
        expect(Object.keys(MODE_CONFIGS).sort()).toEqual([...allModes].sort());
    });

    it("keeps key/id alignment and basic metadata", () => {
        for (const mode of allModes) {
            const config = MODE_CONFIGS[mode];
            expect(config.id).toBe(mode);
            expect(config.name.trim().length).toBeGreaterThan(0);
            expect(config.description.trim().length).toBeGreaterThan(0);
            expect(config.icon.trim().length).toBeGreaterThan(0);
        }
    });

    it("getModeConfig returns the exact config object", () => {
        expect(getModeConfig("rock")).toBe(MODE_CONFIGS.rock);
        expect(getModeConfig("pop")).toBe(MODE_CONFIGS.pop);
        expect(getModeConfig("disco")).toBe(MODE_CONFIGS.disco);
    });
});

describe("createCustomMode", () => {
    it("overrides requested fields while preserving unspecified defaults", () => {
        const base = MODE_CONFIGS.standard;
        const custom = createCustomMode("standard", {
            name: "My Custom Standard",
            theme: { ...base.theme, accent: "#123456" },
            controls: { ...base.controls, showFullscreen: false },
        });

        expect(custom.id).toBe(base.id);
        expect(custom.name).toBe("My Custom Standard");
        expect(custom.theme.accent).toBe("#123456");
        expect(custom.theme.background).toBe(base.theme.background);
        expect(custom.controls.showFullscreen).toBe(false);
        expect(custom.controls.showProgressBar).toBe(base.controls.showProgressBar);
    });
});
