import { type ClassValue } from "clsx";

export declare function cn(...inputs: ClassValue[]): string;
export declare function formatTime(seconds: number): string;
export declare function formatDuration(seconds: number): string;
export declare function clamp(value: number, min: number, max: number): number;
export declare function lerp(a: number, b: number, t: number): number;
export declare function mapRange(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number,
): number;
