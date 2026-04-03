import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EditorProject, EditorProjectSettings, EditorProjectSource } from "@waldiez/editor-core";

import { useEditorStore } from "./editorStore";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<EditorProject> = {}): EditorProject {
    const now = new Date().toISOString();
    const settings: EditorProjectSettings = {
        resolution: { width: 1920, height: 1080 },
        frameRate: 30,
        backgroundColor: "#000000",
        duration: "auto",
    };
    const source: EditorProjectSource = {
        kind: "reader-document",
        sourceType: "markdown",
        sourceName: "test.md",
        importedAt: now,
    };
    return {
        id: "proj-1",
        title: "Test Project",
        createdAt: now,
        updatedAt: now,
        settings,
        source,
        scenes: [],
        timeline: { tracks: [] },
        metadata: {},
        ...overrides,
    };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    useEditorStore.setState({
        currentProject: null,
        selectedSceneId: null,
        selectedClipId: null,
        isDirty: false,
        canUndo: false,
        canRedo: false,
        undoStack: [],
        redoStack: [],
    });
});

afterEach(() => {
    useEditorStore.setState({ currentProject: null });
});

// ── setCurrentProject ─────────────────────────────────────────────────────────

describe("setCurrentProject", () => {
    it("sets project and clears history flags", () => {
        const project = makeProject();
        useEditorStore.getState().setCurrentProject(project);
        const state = useEditorStore.getState();
        expect(state.currentProject?.id).toBe("proj-1");
        expect(state.isDirty).toBe(false);
        expect(state.canUndo).toBe(false);
        expect(state.canRedo).toBe(false);
        expect(state.undoStack).toHaveLength(0);
        expect(state.redoStack).toHaveLength(0);
    });

    it("auto-selects first scene and clip if present", () => {
        const project = makeProject({
            scenes: [{ id: "scene-1", title: "S1", order: 0, text: "", duration: 8 }],
            timeline: {
                tracks: [
                    {
                        id: "track-1",
                        name: "Video",
                        type: "video",
                        isVisible: true,
                        isMuted: false,
                        isLocked: false,
                        opacity: 1,
                        blendMode: "normal",
                        clips: [
                            {
                                id: "clip-1",
                                trackId: "track-1",
                                trackType: "video",
                                title: "Clip 1",
                                startTime: 0,
                                duration: 5,
                                inPoint: 0,
                                outPoint: 5,
                                opacity: 1,
                                effects: [],
                                transitions: [],
                                keyframes: [],
                            },
                        ],
                    },
                ],
            },
        });
        useEditorStore.getState().setCurrentProject(project);
        expect(useEditorStore.getState().selectedSceneId).toBe("scene-1");
        expect(useEditorStore.getState().selectedClipId).toBe("clip-1");
    });
});

// ── Undo / Redo ───────────────────────────────────────────────────────────────

describe("undo / redo", () => {
    beforeEach(() => {
        useEditorStore.getState().setCurrentProject(makeProject());
    });

    it("undo on empty stack is a no-op", () => {
        useEditorStore.getState().undo();
        expect(useEditorStore.getState().currentProject?.id).toBe("proj-1");
    });

    it("redo on empty stack is a no-op", () => {
        useEditorStore.getState().redo();
        expect(useEditorStore.getState().currentProject).not.toBeNull();
    });

    it("mutating project enables undo", () => {
        useEditorStore.getState().addScene();
        expect(useEditorStore.getState().canUndo).toBe(true);
        expect(useEditorStore.getState().canRedo).toBe(false);
    });

    it("undo restores previous state and enables redo", () => {
        useEditorStore.getState().addScene();
        expect(useEditorStore.getState().currentProject?.scenes).toHaveLength(1);
        useEditorStore.getState().undo();
        expect(useEditorStore.getState().currentProject?.scenes).toHaveLength(0);
        expect(useEditorStore.getState().canRedo).toBe(true);
        expect(useEditorStore.getState().canUndo).toBe(false);
    });

    it("redo re-applies the undone change", () => {
        useEditorStore.getState().addScene();
        useEditorStore.getState().undo();
        useEditorStore.getState().redo();
        expect(useEditorStore.getState().currentProject?.scenes).toHaveLength(1);
        expect(useEditorStore.getState().canRedo).toBe(false);
    });

    it("new mutation after undo clears the redo stack", () => {
        useEditorStore.getState().addScene();
        useEditorStore.getState().undo();
        useEditorStore.getState().addScene(); // new mutation
        expect(useEditorStore.getState().canRedo).toBe(false);
    });
});

// ── Scene management ──────────────────────────────────────────────────────────

describe("scene management", () => {
    beforeEach(() => {
        useEditorStore.getState().setCurrentProject(makeProject());
    });

    it("addScene adds a scene and marks dirty", () => {
        useEditorStore.getState().addScene();
        const state = useEditorStore.getState();
        expect(state.currentProject?.scenes).toHaveLength(1);
        expect(state.isDirty).toBe(true);
        expect(state.selectedSceneId).toBeTruthy();
    });

    it("addScene auto-assigns increasing order", () => {
        useEditorStore.getState().addScene();
        useEditorStore.getState().addScene();
        const scenes = useEditorStore.getState().currentProject!.scenes;
        expect(scenes[0]?.order).toBe(0);
        expect(scenes[1]?.order).toBe(1);
    });

    it("duplicateScene inserts a copy after the source", () => {
        useEditorStore.getState().addScene();
        const firstId = useEditorStore.getState().currentProject!.scenes[0]!.id;
        useEditorStore.getState().duplicateScene(firstId);
        const scenes = useEditorStore.getState().currentProject!.scenes;
        expect(scenes).toHaveLength(2);
        expect(scenes[1]?.title).toContain("Copy");
    });

    it("removeScene removes it and re-orders remaining scenes", () => {
        // Set up two scenes with known distinct IDs to avoid Date.now() collisions
        useEditorStore.getState().setCurrentProject(
            makeProject({
                scenes: [
                    { id: "s1", title: "Scene 1", order: 0, text: "", duration: 8 },
                    { id: "s2", title: "Scene 2", order: 1, text: "", duration: 8 },
                ],
            }),
        );
        useEditorStore.getState().removeScene("s1");
        const remaining = useEditorStore.getState().currentProject!.scenes;
        expect(remaining).toHaveLength(1);
        expect(remaining[0]?.id).toBe("s2");
        expect(remaining[0]?.order).toBe(0);
    });

    it("moveScene up shifts scene one position earlier", () => {
        useEditorStore.getState().addScene();
        useEditorStore.getState().addScene();
        const scenesBefore = useEditorStore.getState().currentProject!.scenes;
        const secondId = scenesBefore[1]!.id;
        useEditorStore.getState().moveScene(secondId, "up");
        const scenesAfter = useEditorStore.getState().currentProject!.scenes;
        expect(scenesAfter[0]?.id).toBe(secondId);
    });

    it("updateScene patches fields", () => {
        useEditorStore.getState().addScene();
        const sceneId = useEditorStore.getState().currentProject!.scenes[0]!.id;
        useEditorStore.getState().updateScene(sceneId, { title: "Updated", duration: 12 });
        const scene = useEditorStore.getState().currentProject!.scenes[0]!;
        expect(scene.title).toBe("Updated");
        expect(scene.duration).toBe(12);
    });
});

// ── Track & clip management ───────────────────────────────────────────────────

describe("track & clip management", () => {
    beforeEach(() => {
        useEditorStore.getState().setCurrentProject(makeProject());
    });

    it("addTrack adds a track of the specified type", () => {
        useEditorStore.getState().addTrack("video");
        const tracks = useEditorStore.getState().currentProject!.timeline.tracks;
        expect(tracks).toHaveLength(1);
        expect(tracks[0]?.type).toBe("video");
    });

    it("addClipToTrack adds a clip to the given track", () => {
        useEditorStore.getState().addTrack("audio");
        const trackId = useEditorStore.getState().currentProject!.timeline.tracks[0]!.id;
        useEditorStore.getState().addClipToTrack(trackId);
        const clips = useEditorStore.getState().currentProject!.timeline.tracks[0]!.clips;
        expect(clips).toHaveLength(1);
        expect(useEditorStore.getState().selectedClipId).toBe(clips[0]?.id);
    });

    it("removeClip removes the clip", () => {
        useEditorStore.getState().addTrack("video");
        const trackId = useEditorStore.getState().currentProject!.timeline.tracks[0]!.id;
        useEditorStore.getState().addClipToTrack(trackId);
        const clipId = useEditorStore.getState().currentProject!.timeline.tracks[0]!.clips[0]!.id;
        useEditorStore.getState().removeClip(clipId);
        const clips = useEditorStore.getState().currentProject!.timeline.tracks[0]!.clips;
        expect(clips).toHaveLength(0);
    });

    it("moveClip snaps to grid by default", () => {
        useEditorStore.getState().addTrack("video");
        const trackId = useEditorStore.getState().currentProject!.timeline.tracks[0]!.id;
        useEditorStore.getState().addClipToTrack(trackId);
        const clipId = useEditorStore.getState().currentProject!.timeline.tracks[0]!.clips[0]!.id;
        useEditorStore.getState().moveClip(clipId, 1.1);
        const clip = useEditorStore.getState().currentProject!.timeline.tracks[0]!.clips[0]!;
        // startTime 0 + 1.1 = 1.1 → snapped to nearest 0.25 = 1.0 (0.25 grid)
        // 1.1 / 0.25 = 4.4 → rounds to 4 → 4 * 0.25 = 1.0
        expect(clip.startTime).toBe(1.0);
    });

    it("moveClip with snap:false does not snap", () => {
        useEditorStore.getState().addTrack("video");
        const trackId = useEditorStore.getState().currentProject!.timeline.tracks[0]!.id;
        useEditorStore.getState().addClipToTrack(trackId);
        const clipId = useEditorStore.getState().currentProject!.timeline.tracks[0]!.clips[0]!.id;
        useEditorStore.getState().moveClip(clipId, 1.1, { snap: false });
        const clip = useEditorStore.getState().currentProject!.timeline.tracks[0]!.clips[0]!;
        expect(clip.startTime).toBe(1.1);
    });

    it("trimClipEnd shortens clip duration", () => {
        useEditorStore.getState().addTrack("video");
        const trackId = useEditorStore.getState().currentProject!.timeline.tracks[0]!.id;
        useEditorStore.getState().addClipToTrack(trackId);
        const clipId = useEditorStore.getState().currentProject!.timeline.tracks[0]!.clips[0]!.id;
        // default clip duration is 5; trim 1s from the end
        useEditorStore.getState().trimClipEnd(clipId, -1, { ripple: false });
        const clip = useEditorStore.getState().currentProject!.timeline.tracks[0]!.clips[0]!;
        expect(clip.duration).toBe(4);
    });

    it("removeClip with ripple shifts following clips", () => {
        // Use a project with pre-seeded clips to avoid Date.now() ID collisions
        useEditorStore.getState().setCurrentProject(
            makeProject({
                timeline: {
                    tracks: [
                        {
                            id: "track-v",
                            name: "Video",
                            type: "video",
                            isVisible: true,
                            isMuted: false,
                            isLocked: false,
                            opacity: 1,
                            blendMode: "normal",
                            clips: [
                                {
                                    id: "clip-a",
                                    trackId: "track-v",
                                    trackType: "video",
                                    title: "Clip A",
                                    startTime: 0,
                                    duration: 5,
                                    inPoint: 0,
                                    outPoint: 5,
                                    opacity: 1,
                                    effects: [],
                                    transitions: [],
                                    keyframes: [],
                                },
                                {
                                    id: "clip-b",
                                    trackId: "track-v",
                                    trackType: "video",
                                    title: "Clip B",
                                    startTime: 5,
                                    duration: 5,
                                    inPoint: 0,
                                    outPoint: 5,
                                    opacity: 1,
                                    effects: [],
                                    transitions: [],
                                    keyframes: [],
                                },
                            ],
                        },
                    ],
                },
            }),
        );
        // Remove first clip with ripple; second should shift left by 5s
        useEditorStore.getState().removeClip("clip-a", { ripple: true });
        const clips = useEditorStore.getState().currentProject!.timeline.tracks[0]!.clips;
        expect(clips).toHaveLength(1);
        expect(clips[0]?.id).toBe("clip-b");
        expect(clips[0]?.startTime).toBe(0);
    });
});

// ── Project meta & settings ───────────────────────────────────────────────────

describe("project meta & settings", () => {
    beforeEach(() => {
        useEditorStore.getState().setCurrentProject(makeProject());
    });

    it("updateProjectMeta patches title", () => {
        useEditorStore.getState().updateProjectMeta({ title: "New Title" });
        expect(useEditorStore.getState().currentProject?.title).toBe("New Title");
    });

    it("updateProjectSettings patches resolution", () => {
        useEditorStore.getState().updateProjectSettings({ resolution: { width: 1280, height: 720 } });
        const { resolution } = useEditorStore.getState().currentProject!.settings;
        expect(resolution.width).toBe(1280);
        expect(resolution.height).toBe(720);
    });

    it("markSaved clears isDirty", () => {
        useEditorStore.getState().addScene();
        expect(useEditorStore.getState().isDirty).toBe(true);
        useEditorStore.getState().markSaved();
        expect(useEditorStore.getState().isDirty).toBe(false);
    });

    it("markSaved optionally stores filePath", () => {
        useEditorStore.getState().markSaved("/path/to/project.wdz");
        expect(useEditorStore.getState().currentProject?.filePath).toBe("/path/to/project.wdz");
    });

    it("clearProject resets all state", () => {
        useEditorStore.getState().addScene();
        useEditorStore.getState().clearProject();
        const state = useEditorStore.getState();
        expect(state.currentProject).toBeNull();
        expect(state.isDirty).toBe(false);
        expect(state.undoStack).toHaveLength(0);
        expect(state.selectedSceneId).toBeNull();
    });
});
