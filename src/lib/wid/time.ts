/** Supported time-precision units for WID/HLC generators. */
export type TimeUnit = "sec" | "ms";

export function parseTimeUnit(input: string): TimeUnit {
    if (input === "sec" || input === "ms") {
        return input;
    }
    throw new Error("time-unit must be sec or ms");
}

export function timeDigits(unit: TimeUnit): number {
    return unit === "ms" ? 9 : 6;
}
