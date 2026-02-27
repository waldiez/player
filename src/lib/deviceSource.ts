/** Utilities for device camera / microphone / network stream / screen-capture sources. */

/**
 * Module-level map for handing off screen-capture streams from the dialog
 * (where the user gesture occurs) to WideriaLayout's lifecycle effect.
 * Keyed by MediaFile.id.
 */
export const pendingStreams = new Map<string, MediaStream>();

/** Returns true when running inside Tauri (desktop app). */
export function isTauri(): boolean {
    return typeof window !== "undefined" && "__TAURI__" in window;
}

/** Enumerate video input devices (cameras). */
export async function enumerateVideoDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === "videoinput");
}

/** Enumerate audio input devices (microphones). */
export async function enumerateAudioInputDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === "audioinput");
}

/** Enumerate audio output devices (speakers). */
export async function enumerateAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === "audiooutput");
}

/** Returns true when the browser supports audio output device selection (setSinkId). */
export function isAudioOutputSelectionSupported(): boolean {
    return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

/** Returns true when the browser supports screen / window capture. */
export function isScreenCaptureSupported(): boolean {
    return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

// Resolution presets for camera capture
const RESOLUTIONS: Record<string, { width: number; height: number }> = {
    "480p": { width: 854, height: 480 },
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
};

export interface AvConstraintsOptions {
    videoDeviceId?: string;
    /** Mic device ID. Overrides includeAudio if set. */
    audioDeviceId?: string;
    /** If true and no audioDeviceId, request audio from the default mic. */
    includeAudio?: boolean;
    facingMode?: "user" | "environment";
    /** Resolution key, e.g. "720p". Maps to ideal width × height. */
    captureResolution?: string;
    captureFrameRate?: number;
}

/**
 * Build getUserMedia constraints for a camera, optionally combined with a
 * microphone.  Replaces the simpler cameraConstraints() helper.
 */
export function avConstraints(opts: AvConstraintsOptions = {}): MediaStreamConstraints {
    const { videoDeviceId, audioDeviceId, includeAudio, facingMode, captureResolution, captureFrameRate } =
        opts;

    const video: MediaTrackConstraints = {};
    if (videoDeviceId) video.deviceId = { exact: videoDeviceId };
    if (facingMode) video.facingMode = { ideal: facingMode };
    if (captureResolution && captureResolution in RESOLUTIONS) {
        const { width, height } = RESOLUTIONS[captureResolution];
        video.width = { ideal: width };
        video.height = { ideal: height };
    }
    if (captureFrameRate) video.frameRate = { ideal: captureFrameRate };

    let audio: boolean | MediaTrackConstraints = false;
    if (audioDeviceId) {
        audio = { deviceId: { exact: audioDeviceId } };
    } else if (includeAudio) {
        audio = true;
    }

    return {
        video: Object.keys(video).length > 0 ? video : true,
        audio,
    };
}

/** Build getUserMedia constraints for a camera device (simple, video-only). */
export function cameraConstraints(deviceId?: string): MediaStreamConstraints {
    return {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
    };
}

/** Build getUserMedia constraints for a microphone device. */
export function micConstraints(deviceId?: string): MediaStreamConstraints {
    return {
        video: false,
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    };
}

/**
 * Returns true when the URL looks like a local MJPEG stream
 * (localhost / 127.0.0.1 with no recognised video file extension).
 */
export function isLocalMjpegStream(url: string): boolean {
    try {
        const u = new URL(url);
        const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
        const hasVideoExt = /\.(mp4|webm|ogv|mov|mkv|m3u8)$/i.test(u.pathname);
        return isLocal && !hasVideoExt;
    } catch {
        return false;
    }
}

/**
 * Attempt to launch the OpenCV MJPEG capture server via the Tauri shell plugin.
 * Returns the URL the server will serve on.
 */
export async function launchOpenCvCapture(device: number, port: number): Promise<string> {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const cmd = Command.create("python3", [
        "scripts/opencv_stream.py",
        "--device",
        String(device),
        "--port",
        String(port),
    ]);
    await cmd.spawn();
    // Give the server ~500 ms to start up before the caller uses the URL
    await new Promise(r => setTimeout(r, 500));
    return `http://127.0.0.1:${port}/video`;
}
