import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type {
    EditorProject,
    EditorProjectScene,
    EditorProjectSettings,
    EditorTimelineClip,
    EditorTimelineTrack,
} from "@waldiez/editor-core";

const HISTORY_LIMIT = 80;

interface EditorStore {
    currentProject: EditorProject | null;
    selectedSceneId: string | null;
    selectedClipId: string | null;
    isDirty: boolean;
    canUndo: boolean;
    canRedo: boolean;
    undoStack: EditorProject[];
    redoStack: EditorProject[];
    setCurrentProject: (project: EditorProject | null) => void;
    setSelectedSceneId: (sceneId: string | null) => void;
    setSelectedClipId: (clipId: string | null) => void;
    undo: () => void;
    redo: () => void;
    updateProjectMeta: (patch: Partial<Pick<EditorProject, "title" | "filePath">>) => void;
    updateProjectSettings: (patch: Partial<EditorProjectSettings>) => void;
    updateScene: (sceneId: string, patch: Partial<EditorProjectScene>) => void;
    updateClip: (clipId: string, patch: Partial<EditorTimelineClip>) => void;
    moveClip: (clipId: string, delta: number, options?: { snap?: boolean }) => void;
    trimClipStart: (clipId: string, delta: number, options?: { ripple?: boolean }) => void;
    trimClipEnd: (clipId: string, delta: number, options?: { ripple?: boolean }) => void;
    slipClipContent: (clipId: string, delta: number) => void;
    addScene: () => void;
    duplicateScene: (sceneId: string) => void;
    addTrack: (type: EditorTimelineTrack["type"]) => void;
    addClipToTrack: (trackId: string) => void;
    removeClip: (clipId: string, options?: { ripple?: boolean }) => void;
    removeScene: (sceneId: string) => void;
    moveScene: (sceneId: string, direction: "up" | "down") => void;
    markSaved: (filePath?: string) => void;
    clearProject: () => void;
}

function cloneProject(project: EditorProject): EditorProject {
    return JSON.parse(JSON.stringify(project)) as EditorProject;
}

function touchProject(project: EditorProject): EditorProject {
    return {
        ...project,
        updatedAt: new Date().toISOString(),
    };
}

function selectedSceneIdOf(project: EditorProject | null): string | null {
    return project?.scenes[0]?.id ?? null;
}

function selectedClipIdOf(project: EditorProject | null): string | null {
    return project?.timeline.tracks.flatMap(track => track.clips)[0]?.id ?? null;
}

function historyFlags(undoStack: EditorProject[], redoStack: EditorProject[]) {
    return {
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
    };
}

function snapTime(value: number, enabled = true) {
    const clamped = Math.max(0, value);
    if (!enabled) return clamped;
    const grid = 0.25;
    return Math.round(clamped / grid) * grid;
}

function mapTracks(
    project: EditorProject,
    updater: (track: EditorTimelineTrack) => EditorTimelineTrack,
): EditorProject {
    return {
        ...project,
        timeline: {
            tracks: project.timeline.tracks.map(updater),
        },
    };
}

function commitProject(
    currentProject: EditorProject | null,
    nextProject: EditorProject,
    undoStack: EditorProject[],
): Pick<EditorStore, "currentProject" | "undoStack" | "redoStack" | "isDirty" | "canUndo" | "canRedo"> {
    const nextUndo =
        currentProject == null
            ? undoStack
            : [...undoStack, cloneProject(currentProject)].slice(-HISTORY_LIMIT);
    return {
        currentProject: touchProject(nextProject),
        undoStack: nextUndo,
        redoStack: [],
        isDirty: true,
        ...historyFlags(nextUndo, []),
    };
}

export const useEditorStore = create<EditorStore>()(
    devtools(
        set => ({
            currentProject: null,
            selectedSceneId: null,
            selectedClipId: null,
            isDirty: false,
            canUndo: false,
            canRedo: false,
            undoStack: [],
            redoStack: [],
            setCurrentProject: currentProject =>
                set({
                    currentProject,
                    selectedSceneId: selectedSceneIdOf(currentProject),
                    selectedClipId: selectedClipIdOf(currentProject),
                    isDirty: false,
                    canUndo: false,
                    canRedo: false,
                    undoStack: [],
                    redoStack: [],
                }),
            setSelectedSceneId: selectedSceneId => set({ selectedSceneId }),
            setSelectedClipId: selectedClipId => set({ selectedClipId }),
            undo: () =>
                set(state => {
                    if (!state.currentProject || state.undoStack.length === 0) return state;
                    const previous = cloneProject(state.undoStack[state.undoStack.length - 1]);
                    const nextUndo = state.undoStack.slice(0, -1);
                    const nextRedo = [...state.redoStack, cloneProject(state.currentProject)].slice(
                        -HISTORY_LIMIT,
                    );
                    return {
                        currentProject: previous,
                        selectedSceneId: selectedSceneIdOf(previous),
                        selectedClipId: selectedClipIdOf(previous),
                        undoStack: nextUndo,
                        redoStack: nextRedo,
                        isDirty: true,
                        ...historyFlags(nextUndo, nextRedo),
                    };
                }),
            redo: () =>
                set(state => {
                    if (!state.currentProject || state.redoStack.length === 0) return state;
                    const next = cloneProject(state.redoStack[state.redoStack.length - 1]);
                    const nextRedo = state.redoStack.slice(0, -1);
                    const nextUndo = [...state.undoStack, cloneProject(state.currentProject)].slice(
                        -HISTORY_LIMIT,
                    );
                    return {
                        currentProject: next,
                        selectedSceneId: selectedSceneIdOf(next),
                        selectedClipId: selectedClipIdOf(next),
                        undoStack: nextUndo,
                        redoStack: nextRedo,
                        isDirty: true,
                        ...historyFlags(nextUndo, nextRedo),
                    };
                }),
            updateProjectMeta: patch =>
                set(state => {
                    if (!state.currentProject) return state;
                    return commitProject(
                        state.currentProject,
                        {
                            ...state.currentProject,
                            ...patch,
                        },
                        state.undoStack,
                    );
                }),
            updateProjectSettings: patch =>
                set(state => {
                    if (!state.currentProject) return state;
                    return commitProject(
                        state.currentProject,
                        {
                            ...state.currentProject,
                            settings: {
                                ...state.currentProject.settings,
                                ...patch,
                                resolution: {
                                    ...state.currentProject.settings.resolution,
                                    ...(patch.resolution ?? {}),
                                },
                            },
                        },
                        state.undoStack,
                    );
                }),
            updateScene: (sceneId, patch) =>
                set(state => {
                    if (!state.currentProject) return state;
                    return {
                        ...commitProject(
                            state.currentProject,
                            {
                                ...state.currentProject,
                                scenes: state.currentProject.scenes.map(scene =>
                                    scene.id === sceneId ? { ...scene, ...patch } : scene,
                                ),
                            },
                            state.undoStack,
                        ),
                        selectedSceneId: sceneId,
                    };
                }),
            updateClip: (clipId, patch) =>
                set(state => {
                    if (!state.currentProject) return state;
                    return {
                        ...commitProject(
                            state.currentProject,
                            {
                                ...state.currentProject,
                                timeline: {
                                    tracks: state.currentProject.timeline.tracks.map(track => ({
                                        ...track,
                                        clips: track.clips.map(clip =>
                                            clip.id === clipId ? { ...clip, ...patch } : clip,
                                        ),
                                    })),
                                },
                            },
                            state.undoStack,
                        ),
                        selectedClipId: clipId,
                    };
                }),
            moveClip: (clipId, delta, options) =>
                set(state => {
                    if (!state.currentProject) return state;
                    let moved = false;
                    const nextProject = mapTracks(state.currentProject, track => ({
                        ...track,
                        clips: track.clips.map(clip => {
                            if (clip.id !== clipId) return clip;
                            moved = true;
                            return {
                                ...clip,
                                startTime: snapTime(clip.startTime + delta, options?.snap !== false),
                            };
                        }),
                    }));
                    if (!moved) return state;
                    return {
                        ...commitProject(state.currentProject, nextProject, state.undoStack),
                        selectedClipId: clipId,
                    };
                }),
            trimClipStart: (clipId, delta, options) =>
                set(state => {
                    if (!state.currentProject) return state;
                    let changedTrackId: string | null = null;
                    const nextProject = mapTracks(state.currentProject, track => ({
                        ...track,
                        clips: track.clips.map(clip => {
                            if (clip.id !== clipId) return clip;
                            changedTrackId = track.id;
                            const nextStart = snapTime(clip.startTime + delta, true);
                            const consumed = nextStart - clip.startTime;
                            const nextDuration = Math.max(0.25, clip.duration - consumed);
                            return {
                                ...clip,
                                startTime: nextStart,
                                duration: nextDuration,
                                inPoint: Math.max(0, clip.inPoint + consumed),
                            };
                        }),
                    }));
                    if (!changedTrackId) return state;
                    const finalProject = options?.ripple
                        ? mapTracks(nextProject, track =>
                              track.id !== changedTrackId
                                  ? track
                                  : {
                                        ...track,
                                        clips: track.clips.map(clip =>
                                            clip.id === clipId ||
                                            clip.startTime <
                                                (nextProject.timeline.tracks
                                                    .find(t => t.id === changedTrackId)
                                                    ?.clips.find(c => c.id === clipId)?.startTime ?? 0)
                                                ? clip
                                                : {
                                                      ...clip,
                                                      startTime: snapTime(clip.startTime + delta, true),
                                                  },
                                        ),
                                    },
                          )
                        : nextProject;
                    return {
                        ...commitProject(state.currentProject, finalProject, state.undoStack),
                        selectedClipId: clipId,
                    };
                }),
            trimClipEnd: (clipId, delta, options) =>
                set(state => {
                    if (!state.currentProject) return state;
                    let changedTrackId: string | null = null;
                    let originalEnd = 0;
                    let nextEnd = 0;
                    const nextProject = mapTracks(state.currentProject, track => ({
                        ...track,
                        clips: track.clips.map(clip => {
                            if (clip.id !== clipId) return clip;
                            changedTrackId = track.id;
                            originalEnd = clip.startTime + clip.duration;
                            const nextDuration = Math.max(0.25, snapTime(clip.duration + delta, true));
                            nextEnd = clip.startTime + nextDuration;
                            return {
                                ...clip,
                                duration: nextDuration,
                                outPoint: clip.inPoint + nextDuration,
                            };
                        }),
                    }));
                    if (!changedTrackId) return state;
                    const shift = nextEnd - originalEnd;
                    const finalProject =
                        options?.ripple && shift !== 0
                            ? mapTracks(nextProject, track =>
                                  track.id !== changedTrackId
                                      ? track
                                      : {
                                            ...track,
                                            clips: track.clips.map(clip =>
                                                clip.id === clipId || clip.startTime < originalEnd
                                                    ? clip
                                                    : {
                                                          ...clip,
                                                          startTime: snapTime(clip.startTime + shift, true),
                                                      },
                                            ),
                                        },
                              )
                            : nextProject;
                    return {
                        ...commitProject(state.currentProject, finalProject, state.undoStack),
                        selectedClipId: clipId,
                    };
                }),
            slipClipContent: (clipId, delta) =>
                set(state => {
                    if (!state.currentProject) return state;
                    let slipped = false;
                    const nextProject = mapTracks(state.currentProject, track => ({
                        ...track,
                        clips: track.clips.map(clip => {
                            if (clip.id !== clipId) return clip;
                            slipped = true;
                            const maxOffset = Math.max(clip.inPoint, 0) + clip.duration;
                            const nextInPoint = Math.max(0, clip.inPoint + delta);
                            return {
                                ...clip,
                                inPoint: nextInPoint,
                                outPoint: Math.max(
                                    nextInPoint,
                                    Math.min(maxOffset + delta, nextInPoint + clip.duration),
                                ),
                            };
                        }),
                    }));
                    if (!slipped) return state;
                    return {
                        ...commitProject(state.currentProject, nextProject, state.undoStack),
                        selectedClipId: clipId,
                    };
                }),
            addScene: () =>
                set(state => {
                    if (!state.currentProject) return state;
                    const stamp = Date.now();
                    const nextScene: EditorProjectScene = {
                        id: `scene-${stamp}`,
                        title: `Scene ${state.currentProject.scenes.length + 1}`,
                        order: state.currentProject.scenes.length,
                        text: "",
                        duration: 8,
                        mediaFit: "cover",
                        audioOffset: 0,
                        audioVolume: 0.8,
                    };
                    return {
                        ...commitProject(
                            state.currentProject,
                            {
                                ...state.currentProject,
                                scenes: [...state.currentProject.scenes, nextScene],
                            },
                            state.undoStack,
                        ),
                        selectedSceneId: nextScene.id,
                    };
                }),
            duplicateScene: sceneId =>
                set(state => {
                    if (!state.currentProject) return state;
                    const index = state.currentProject.scenes.findIndex(scene => scene.id === sceneId);
                    if (index < 0) return state;
                    const source = state.currentProject.scenes[index];
                    const clone: EditorProjectScene = {
                        ...source,
                        id: `scene-${Date.now()}`,
                        order: index + 1,
                        title: `${source.title} Copy`,
                    };
                    const nextScenes = [...state.currentProject.scenes];
                    nextScenes.splice(index + 1, 0, clone);
                    const reordered = nextScenes.map((scene, order) => ({ ...scene, order }));
                    return {
                        ...commitProject(
                            state.currentProject,
                            {
                                ...state.currentProject,
                                scenes: reordered,
                            },
                            state.undoStack,
                        ),
                        selectedSceneId: clone.id,
                    };
                }),
            addTrack: type =>
                set(state => {
                    if (!state.currentProject) return state;
                    const nextTrack: EditorTimelineTrack = {
                        id: `track-${type}-${Date.now()}`,
                        name: `${type[0].toUpperCase()}${type.slice(1)} lane ${state.currentProject.timeline.tracks.filter(track => track.type === type).length + 1}`,
                        type,
                        isVisible: true,
                        isMuted: false,
                        isLocked: false,
                        opacity: 1,
                        blendMode: "normal",
                        clips: [],
                    };
                    return commitProject(
                        state.currentProject,
                        {
                            ...state.currentProject,
                            timeline: {
                                tracks: [...state.currentProject.timeline.tracks, nextTrack],
                            },
                        },
                        state.undoStack,
                    );
                }),
            addClipToTrack: trackId =>
                set(state => {
                    if (!state.currentProject) return state;
                    const track = state.currentProject.timeline.tracks.find(entry => entry.id === trackId);
                    if (!track) return state;
                    const nextClip: EditorTimelineClip = {
                        id: `clip-${Date.now()}`,
                        trackId,
                        trackType: track.type,
                        title: `${track.name} Clip`,
                        startTime: 0,
                        duration: 5,
                        inPoint: 0,
                        outPoint: 5,
                        opacity: track.type === "audio" ? 0.8 : 1,
                        captionText: track.type === "caption" ? "" : undefined,
                        mediaFit: "cover",
                        effects: [],
                        transitions: [],
                        keyframes: [],
                    };
                    return {
                        ...commitProject(
                            state.currentProject,
                            {
                                ...state.currentProject,
                                timeline: {
                                    tracks: state.currentProject.timeline.tracks.map(entry =>
                                        entry.id === trackId
                                            ? { ...entry, clips: [...entry.clips, nextClip] }
                                            : entry,
                                    ),
                                },
                            },
                            state.undoStack,
                        ),
                        selectedClipId: nextClip.id,
                    };
                }),
            removeClip: (clipId, options) =>
                set(state => {
                    if (!state.currentProject) return state;
                    const removedTrack = state.currentProject.timeline.tracks.find(track =>
                        track.clips.some(entry => entry.id === clipId),
                    );
                    const removedClip = removedTrack?.clips.find(entry => entry.id === clipId) ?? null;
                    const removedTrackId = removedTrack?.id ?? null;
                    if (!removedClip || !removedTrackId) return state;
                    const nextProject = mapTracks(state.currentProject, track =>
                        track.id !== removedTrackId
                            ? track
                            : {
                                  ...track,
                                  clips: track.clips.filter(entry => entry.id !== clipId),
                              },
                    );
                    const removedSpanStart = removedClip.startTime;
                    const removedSpanDuration = removedClip.duration;
                    const finalProject = options?.ripple
                        ? mapTracks(nextProject, track =>
                              track.id !== removedTrackId
                                  ? track
                                  : {
                                        ...track,
                                        clips: track.clips.map(clip =>
                                            clip.startTime >= removedSpanStart + removedSpanDuration
                                                ? {
                                                      ...clip,
                                                      startTime: snapTime(
                                                          clip.startTime - removedSpanDuration,
                                                          true,
                                                      ),
                                                  }
                                                : clip,
                                        ),
                                    },
                          )
                        : nextProject;
                    return {
                        ...commitProject(state.currentProject, finalProject, state.undoStack),
                        selectedClipId: selectedClipIdOf(finalProject),
                    };
                }),
            removeScene: sceneId =>
                set(state => {
                    if (!state.currentProject) return state;
                    const nextScenes = state.currentProject.scenes
                        .filter(scene => scene.id !== sceneId)
                        .map((scene, index) => ({ ...scene, order: index }));
                    return {
                        ...commitProject(
                            state.currentProject,
                            {
                                ...state.currentProject,
                                scenes: nextScenes,
                            },
                            state.undoStack,
                        ),
                        selectedSceneId: nextScenes[0]?.id ?? null,
                    };
                }),
            moveScene: (sceneId, direction) =>
                set(state => {
                    if (!state.currentProject) return state;
                    const scenes = [...state.currentProject.scenes];
                    const index = scenes.findIndex(scene => scene.id === sceneId);
                    if (index < 0) return state;
                    const target = direction === "up" ? index - 1 : index + 1;
                    if (target < 0 || target >= scenes.length) return state;
                    const [scene] = scenes.splice(index, 1);
                    scenes.splice(target, 0, scene);
                    const reordered = scenes.map((item, order) => ({ ...item, order }));
                    return commitProject(
                        state.currentProject,
                        {
                            ...state.currentProject,
                            scenes: reordered,
                        },
                        state.undoStack,
                    );
                }),
            markSaved: filePath =>
                set(state => {
                    if (!state.currentProject) return state;
                    return {
                        currentProject: {
                            ...touchProject(state.currentProject),
                            filePath: filePath ?? state.currentProject.filePath,
                        },
                        isDirty: false,
                        undoStack: state.undoStack,
                        redoStack: state.redoStack,
                        ...historyFlags(state.undoStack, state.redoStack),
                    };
                }),
            clearProject: () =>
                set({
                    currentProject: null,
                    selectedSceneId: null,
                    selectedClipId: null,
                    isDirty: false,
                    canUndo: false,
                    canRedo: false,
                    undoStack: [],
                    redoStack: [],
                }),
        }),
        { name: "waldiez-editor-store" },
    ),
);
