export type MediaSourceType =
    | "file"
    | "youtube"
    | "spotify"
    | "url"
    | "camera"
    | "microphone"
    | "stream"
    | "screen";

export type StreamProtocol = "http" | "https" | "ws" | "wss" | "mqtts" | "webrtc" | "rtsp";

export interface MediaFile {
    id: string;
    name: string;
    /** Blob URL for local files; original URL for remote sources; "camera:N" / "microphone:N" for devices. */
    path: string;
    type: "video" | "audio" | "image";
    /** Origin of the media. Defaults to "file" when absent. */
    source?: MediaSourceType;
    /** iframe src for YouTube / Spotify embeds. */
    embedUrl?: string;
    /** Extracted YouTube video ID (for YouTube sources). */
    youtubeId?: string;
    /** YouTube playlist ID, when the URL contains a list= parameter. */
    playlistId?: string;
    /** MediaDeviceInfo.deviceId for camera / microphone sources. */
    deviceId?: string;
    /** Mic device ID for camera+mic combined sources. */
    audioDeviceId?: string;
    /** Preferred camera facing mode. */
    facingMode?: "user" | "environment";
    /** Desired capture resolution key, e.g. "720p" (camera sources). */
    captureResolution?: string;
    /** Desired capture frame rate for camera sources. */
    captureFrameRate?: number;
    /** Audio output device ID for setSinkId routing (Chrome/Edge). */
    sinkId?: string;
    /** Stream transport protocol metadata for source="stream". */
    streamProtocol?: StreamProtocol;
    /** Optional logical stream target ID (manifest-aligned). */
    streamTargetId?: string;
    /** Optional topic/channel/room identifier for non-URL stream transports. */
    streamChannel?: string;
    /** Optional signaling URL for WebRTC-based stream targets. */
    signalingUrl?: string;
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
    options?: { label: string; value: string }[];
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
