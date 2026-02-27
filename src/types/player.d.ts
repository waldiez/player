export interface MediaFile {
    id: string;
    name: string;
    path: string;
    type: "video" | "audio" | "image";
    duration: number;
    width?: number;
    height?: number;
    frameRate?: number;
    codec?: string;
    bitrate?: number;
    size: number;
    thumbnailUrl?: string;
    createdAt: Date;
}
export interface Chapter {
    id: string;
    title: string;
    startTime: number;
    endTime: number;
    color?: string;
}
export interface Bookmark {
    id: string;
    time: number;
    label: string;
    color?: string;
}
export interface PlaybackState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    playbackRate: number;
    isLooping: boolean;
    isFullscreen: boolean;
}
export interface VideoEffect {
    id: string;
    type: EffectType;
    enabled: boolean;
    parameters: Record<string, number | string | boolean>;
}
export type EffectType =
    | "brightness"
    | "contrast"
    | "saturation"
    | "hue"
    | "blur"
    | "sharpen"
    | "vignette"
    | "grain"
    | "chromatic-aberration"
    | "lut"
    | "color-balance"
    | "curves";
export interface EffectParameter {
    name: string;
    type: "number" | "color" | "boolean" | "select";
    min?: number;
    max?: number;
    step?: number;
    defaultValue: number | string | boolean;
    options?: {
        label: string;
        value: string;
    }[];
}
export interface EffectDefinition {
    type: EffectType;
    name: string;
    description: string;
    icon: string;
    parameters: EffectParameter[];
}
export interface AudioVisualizationConfig {
    type: "waveform" | "spectrum" | "bars";
    color: string;
    backgroundColor: string;
    barWidth?: number;
    barGap?: number;
    smoothing?: number;
    fftSize?: number;
}
