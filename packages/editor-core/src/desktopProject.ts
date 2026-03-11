import type {
    DesktopProjectFile,
    EditorProject,
    EditorProjectScene,
    EditorTimelineClip,
    EditorTimelineTrack,
} from "./types";

function makeCaptionPath(text: string): string {
    return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
}

function decodeCaptionPath(path?: string): string {
    if (!path) return "";
    const prefix = "data:text/plain;charset=utf-8,";
    if (!path.startsWith(prefix)) return path;
    try {
        return decodeURIComponent(path.slice(prefix.length));
    } catch {
        return path.slice(prefix.length);
    }
}

function buildDefaultTimeline(project: EditorProject): { tracks: EditorTimelineTrack[] } {
    const captionTrackId = `${project.id}-captions`;
    let startTime = 0;
    const clips = project.scenes.map(scene => {
        const clip: EditorTimelineClip = {
            id: `clip-${scene.id}`,
            trackId: captionTrackId,
            trackType: "caption",
            title: scene.title,
            captionText: scene.text,
            startTime,
            duration: scene.duration,
            inPoint: 0,
            outPoint: scene.duration,
            opacity: 1,
            sourceSceneId: scene.id,
            effects: [],
            transitions: [],
            keyframes: [],
        };
        startTime += scene.duration;
        return clip;
    });

    return {
        tracks: [
            {
                id: captionTrackId,
                name: "Scenes",
                type: "caption",
                isVisible: true,
                isMuted: false,
                isLocked: false,
                opacity: 1,
                blendMode: "normal",
                clips,
            },
        ],
    };
}

function timelineFor(project: EditorProject): { tracks: EditorTimelineTrack[] } {
    return project.timeline?.tracks?.length ? project.timeline : buildDefaultTimeline(project);
}

function sceneVisualAsset(
    scene: EditorProjectScene,
): { type: "image" | "video"; id: string; name: string; path: string } | null {
    if (!scene.mediaKind || !scene.mediaPath) return null;
    return {
        type: scene.mediaKind,
        id: `visual-${scene.id}`,
        name: scene.mediaName ?? `${scene.title} ${scene.mediaKind}`,
        path: scene.mediaPath,
    };
}

function sceneAudioAsset(scene: EditorProjectScene): { id: string; name: string; path: string } | null {
    if (!scene.audioPath) return null;
    return {
        id: `audio-${scene.id}`,
        name: scene.audioName ?? `${scene.title} audio`,
        path: scene.audioPath,
    };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
    const map = new Map<string, T>();
    for (const item of items) map.set(item.id, item);
    return [...map.values()];
}

export function toDesktopProjectFile(project: EditorProject): DesktopProjectFile {
    const timeline = timelineFor(project);
    const sceneVisualAssets = project.scenes
        .map(sceneVisualAsset)
        .filter((asset): asset is NonNullable<ReturnType<typeof sceneVisualAsset>> => Boolean(asset));
    const sceneAudioAssets = project.scenes
        .map(sceneAudioAsset)
        .filter((asset): asset is NonNullable<ReturnType<typeof sceneAudioAsset>> => Boolean(asset));

    const clipImageAssets = timeline.tracks
        .flatMap(track => track.clips)
        .filter(clip => clip.trackType === "image" && clip.assetPath)
        .map(clip => ({
            id: clip.id,
            name: clip.assetName ?? clip.title,
            path: clip.assetPath as string,
            width: 0,
            height: 0,
            format: "image/*",
            size: 0,
        }));
    const clipVideoAssets = timeline.tracks
        .flatMap(track => track.clips)
        .filter(clip => clip.trackType === "video" && clip.assetPath)
        .map(clip => ({
            id: clip.id,
            name: clip.assetName ?? clip.title,
            path: clip.assetPath as string,
            duration: clip.duration,
            width: 0,
            height: 0,
            frameRate: project.settings.frameRate,
            codec: "unknown",
            format: "video/*",
            size: 0,
        }));
    const clipAudioAssets = timeline.tracks
        .flatMap(track => track.clips)
        .filter(clip => clip.trackType === "audio" && clip.assetPath)
        .map(clip => ({
            id: clip.id,
            name: clip.assetName ?? clip.title,
            path: clip.assetPath as string,
            duration: clip.duration,
            sampleRate: 0,
            channels: 0,
            format: "audio/*",
            size: 0,
        }));
    const captionAssets = timeline.tracks
        .flatMap(track => track.clips)
        .filter(clip => clip.trackType === "caption")
        .map(clip => ({
            id: clip.id,
            name: clip.title,
            path: makeCaptionPath(clip.captionText ?? ""),
            format: "text/plain",
            language: "en",
        }));

    return {
        id: project.id,
        name: project.title,
        version: "1.0.0",
        createdAt: project.createdAt,
        updatedAt: new Date().toISOString(),
        settings: {
            resolution: project.settings.resolution,
            frameRate: project.settings.frameRate,
            backgroundColor: project.settings.backgroundColor,
            duration: project.settings.duration,
        },
        assets: {
            images: dedupeById([
                ...sceneVisualAssets
                    .filter(asset => asset.type === "image")
                    .map(asset => ({
                        id: asset.id,
                        name: asset.name,
                        path: asset.path,
                        width: 0,
                        height: 0,
                        format: "image/*",
                        size: 0,
                    })),
                ...clipImageAssets,
            ]),
            audio: dedupeById([
                ...sceneAudioAssets.map(asset => ({
                    id: asset.id,
                    name: asset.name,
                    path: asset.path,
                    duration: 0,
                    sampleRate: 0,
                    channels: 0,
                    format: "audio/*",
                    size: 0,
                })),
                ...clipAudioAssets,
            ]),
            video: dedupeById([
                ...sceneVisualAssets
                    .filter(asset => asset.type === "video")
                    .map(asset => ({
                        id: asset.id,
                        name: asset.name,
                        path: asset.path,
                        duration: 0,
                        width: 0,
                        height: 0,
                        frameRate: project.settings.frameRate,
                        codec: "unknown",
                        format: "video/*",
                        size: 0,
                    })),
                ...clipVideoAssets,
            ]),
            captions: dedupeById(captionAssets),
            fonts: [],
        },
        composition: {
            tracks: timeline.tracks.map(track => ({
                id: track.id,
                name: track.name,
                type: track.type,
                items: track.clips.map(clip => ({
                    id: `item-${clip.id}`,
                    assetId: clip.trackType === "caption" ? clip.id : clip.sourceSceneId ? clip.id : clip.id,
                    startTime: clip.startTime,
                    duration: clip.duration,
                    inPoint: clip.inPoint,
                    outPoint: clip.outPoint,
                    transform: {
                        position: { x: 0, y: 0 },
                        scale: { x: 1, y: 1 },
                        rotation: 0,
                        anchor: { x: 0.5, y: 0.5 },
                        opacity: clip.opacity,
                    },
                    effects: clip.effects.map(effect => ({
                        id: effect.id,
                        type: effect.type,
                        enabled: effect.enabled,
                        parameters: effect.parameters,
                        keyframes: effect.keyframes.map(keyframe => ({
                            property: effect.type,
                            keyframes: [
                                {
                                    id: keyframe.id,
                                    time: keyframe.time,
                                    value: keyframe.value,
                                    easing: keyframe.easing,
                                },
                            ],
                        })),
                    })),
                    transitions: clip.transitions.map(transition => ({
                        id: transition.id,
                        type: transition.type,
                        duration: transition.duration,
                        position: transition.position,
                        easing: transition.easing,
                        parameters: transition.parameters,
                    })),
                    keyframes: clip.keyframes.length
                        ? [
                              {
                                  property: track.type === "audio" ? "volume" : "opacity",
                                  keyframes: clip.keyframes.map(keyframe => ({
                                      id: keyframe.id,
                                      time: keyframe.time,
                                      value: keyframe.value,
                                      easing: keyframe.easing,
                                  })),
                              },
                          ]
                        : [],
                })),
                isVisible: track.isVisible,
                isMuted: track.isMuted,
                isLocked: track.isLocked,
                opacity: track.opacity,
                blendMode: track.blendMode,
            })),
            markers: project.scenes.map((scene, index) => ({
                id: `marker-${scene.id}`,
                time:
                    timeline.tracks
                        .flatMap(track => track.clips)
                        .find(clip => clip.sourceSceneId === scene.id)?.startTime ?? index * scene.duration,
                label: scene.title,
                color: "#14b8a6",
                type: "scene",
            })),
        },
        filePath: project.filePath ?? null,
    };
}

export function fromDesktopProjectFile(input: DesktopProjectFile): EditorProject {
    const trackById = new Map(input.composition.tracks.map(track => [track.id, track]));
    const tracks: EditorTimelineTrack[] = input.composition.tracks.map(track => ({
        id: track.id,
        name: track.name,
        type: track.type,
        isVisible: track.isVisible,
        isMuted: track.isMuted,
        isLocked: track.isLocked,
        opacity: track.opacity,
        blendMode: track.blendMode,
        clips: track.items.map(item => {
            const caption = input.assets.captions.find(asset => asset.id === item.assetId);
            const image = input.assets.images.find(asset => asset.id === item.assetId);
            const video = input.assets.video.find(asset => asset.id === item.assetId);
            const audio = input.assets.audio.find(asset => asset.id === item.assetId);
            return {
                id: item.assetId,
                trackId: track.id,
                trackType: track.type,
                title: caption?.name ?? image?.name ?? video?.name ?? audio?.name ?? item.id,
                assetPath: image?.path ?? video?.path ?? audio?.path,
                assetName: image?.name ?? video?.name ?? audio?.name,
                captionText: caption ? decodeCaptionPath(caption.path) : undefined,
                mediaFit: "cover",
                startTime: item.startTime,
                duration: item.duration,
                inPoint: item.inPoint,
                outPoint: item.outPoint,
                opacity: item.transform.opacity,
                effects: item.effects.map(effect => ({
                    id: String((effect as { id?: string }).id ?? item.id),
                    type: String((effect as { type?: string }).type ?? "effect"),
                    enabled: Boolean((effect as { enabled?: boolean }).enabled ?? true),
                    parameters: (effect as { parameters?: Record<string, unknown> }).parameters ?? {},
                    keyframes: [],
                })),
                transitions: item.transitions.map(transition => ({
                    id: String((transition as { id?: string }).id ?? item.id),
                    type: String((transition as { type?: string }).type ?? "fade"),
                    duration: Number((transition as { duration?: number }).duration ?? 0),
                    position: ((transition as { position?: "in" | "out" }).position ?? "in") as "in" | "out",
                    easing: String((transition as { easing?: string }).easing ?? "linear"),
                    parameters: (transition as { parameters?: Record<string, unknown> }).parameters ?? {},
                })),
                keyframes: item.keyframes.flatMap(group => {
                    const typedGroup = group as {
                        keyframes: Array<{
                            id: string;
                            time: number;
                            value: unknown;
                            easing: string;
                        }>;
                    };
                    return typedGroup.keyframes.map(keyframe => ({
                        id: keyframe.id,
                        time: keyframe.time,
                        value: Number(keyframe.value),
                        easing: keyframe.easing,
                    }));
                }),
                sourceSceneId: undefined,
            };
        }),
    }));

    const scenes = tracks
        .filter(track => track.type === "caption")
        .flatMap(track => track.clips)
        .sort((a, b) => a.startTime - b.startTime)
        .map<EditorProjectScene>((clip, index) => {
            const visualClip = tracks
                .filter(track => track.type === "image" || track.type === "video")
                .flatMap(track => track.clips)
                .find(candidate => candidate.startTime === clip.startTime);
            const audioClip = tracks
                .filter(track => track.type === "audio")
                .flatMap(track => track.clips)
                .find(candidate => candidate.startTime === clip.startTime);
            return {
                id: clip.sourceSceneId ?? `scene-${index + 1}`,
                title: clip.title,
                order: index,
                text: clip.captionText ?? "",
                duration: clip.duration,
                mediaKind:
                    visualClip?.trackType === "image"
                        ? "image"
                        : visualClip?.trackType === "video"
                          ? "video"
                          : undefined,
                mediaPath: visualClip?.assetPath,
                mediaName: visualClip?.assetName,
                mediaFit: visualClip?.mediaFit ?? "cover",
                audioPath: audioClip?.assetPath,
                audioName: audioClip?.assetName,
                audioOffset: audioClip?.inPoint ?? 0,
                audioVolume: audioClip?.opacity ?? 0.8,
                lineStart: undefined,
            };
        });

    return {
        id: input.id,
        title: input.name,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        filePath: input.filePath ?? undefined,
        settings: {
            resolution: input.settings.resolution,
            frameRate: input.settings.frameRate,
            backgroundColor: input.settings.backgroundColor,
            duration: input.settings.duration === "auto" ? "auto" : Number(input.settings.duration),
        },
        source: {
            kind: "reader-document",
            sourceType: "desktop-project",
            sourceName: input.name,
            sourcePath: input.filePath ?? undefined,
            importedAt: input.updatedAt,
        },
        scenes,
        timeline: {
            tracks,
        },
        metadata: {
            loadedFromDesktopProject: true,
            markerCount: input.composition.markers.length,
            trackCount: trackById.size,
        },
    };
}
