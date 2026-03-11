export interface EditorKeyframe {
    id: string;
    time: number;
    value: number;
    easing: string;
}

export interface EditorClipEffect {
    id: string;
    type: string;
    enabled: boolean;
    parameters: Record<string, unknown>;
    keyframes: EditorKeyframe[];
}

export interface EditorClipTransition {
    id: string;
    type: string;
    duration: number;
    position: "in" | "out";
    easing: string;
    parameters: Record<string, unknown>;
}

export interface EditorTimelineClip {
    id: string;
    trackId: string;
    trackType: "video" | "image" | "audio" | "caption";
    title: string;
    assetPath?: string;
    assetName?: string;
    captionText?: string;
    mediaFit?: "cover" | "contain";
    startTime: number;
    duration: number;
    inPoint: number;
    outPoint: number;
    opacity: number;
    sourceSceneId?: string;
    effects: EditorClipEffect[];
    transitions: EditorClipTransition[];
    keyframes: EditorKeyframe[];
}

export interface EditorTimelineTrack {
    id: string;
    name: string;
    type: "video" | "image" | "audio" | "caption";
    isVisible: boolean;
    isMuted: boolean;
    isLocked: boolean;
    opacity: number;
    blendMode: string;
    clips: EditorTimelineClip[];
}

export interface EditorProjectScene {
    id: string;
    title: string;
    order: number;
    text: string;
    duration: number;
    mediaKind?: "image" | "video";
    mediaPath?: string;
    mediaName?: string;
    mediaFit?: "cover" | "contain";
    audioPath?: string;
    audioName?: string;
    audioOffset?: number;
    audioVolume?: number;
    sourceSectionId?: string;
    lineStart?: number;
}

export interface EditorProjectSettings {
    resolution: {
        width: number;
        height: number;
    };
    frameRate: number;
    backgroundColor: string;
    duration: "auto" | number;
}

export interface EditorProjectSource {
    kind: "reader-document";
    sourceType: string;
    sourceName: string;
    sourcePath?: string;
    importedAt: string;
}

export interface EditorProject {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    filePath?: string;
    settings: EditorProjectSettings;
    source: EditorProjectSource;
    scenes: EditorProjectScene[];
    timeline: {
        tracks: EditorTimelineTrack[];
    };
    metadata: Record<string, unknown>;
}

export interface EditorRenderSettings {
    resolution: {
        width: number;
        height: number;
    };
    frameRate: number;
    format: "html" | "srt" | "json" | "mp4";
    quality: "low" | "medium" | "high" | "lossless";
}

export interface ReaderDocumentInputSection {
    id: string;
    title: string;
    content: string;
    level: number;
    lineStart?: number;
}

export interface ReaderDocumentInput {
    id: string;
    title: string;
    sourceName: string;
    sourcePath?: string;
    sourceType: string;
    plainText: string;
    rawText: string;
    sections: ReaderDocumentInputSection[];
    metadata?: Record<string, unknown>;
    openedAt?: string;
}

export interface DesktopProjectFile {
    id: string;
    name: string;
    version: string;
    createdAt: string;
    updatedAt: string;
    settings: {
        resolution: {
            width: number;
            height: number;
        };
        frameRate: number;
        backgroundColor: string;
        duration: string | number;
    };
    assets: {
        images: Array<{
            id: string;
            name: string;
            path: string;
            width: number;
            height: number;
            format: string;
            size: number;
        }>;
        audio: Array<{
            id: string;
            name: string;
            path: string;
            duration: number;
            sampleRate: number;
            channels: number;
            format: string;
            size: number;
        }>;
        video: Array<{
            id: string;
            name: string;
            path: string;
            duration: number;
            width: number;
            height: number;
            frameRate: number;
            codec: string;
            format: string;
            size: number;
        }>;
        captions: Array<{
            id: string;
            name: string;
            path: string;
            format: string;
            language?: string | null;
        }>;
        fonts: unknown[];
    };
    composition: {
        tracks: Array<{
            id: string;
            name: string;
            type: "caption" | "video" | "image" | "audio";
            items: Array<{
                id: string;
                assetId: string;
                startTime: number;
                duration: number;
                inPoint: number;
                outPoint: number;
                transform: {
                    position: { x: number; y: number };
                    scale: { x: number; y: number };
                    rotation: number;
                    anchor: { x: number; y: number };
                    opacity: number;
                };
                effects: unknown[];
                transitions: unknown[];
                keyframes: unknown[];
            }>;
            isVisible: boolean;
            isMuted: boolean;
            isLocked: boolean;
            opacity: number;
            blendMode: string;
        }>;
        markers: Array<{
            id: string;
            time: number;
            label: string;
            color: string;
            type: string;
        }>;
    };
    filePath?: string | null;
}
