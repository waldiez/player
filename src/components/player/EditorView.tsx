import {
    Field,
    InspectorCard,
    MiniAction,
    SegmentedChoiceField,
    SelectField,
} from "@/components/player/EditorInspectorFields";
import { Button, DragHandle } from "@/components/ui";
import { useEditorFileOps } from "@/hooks/useEditorFileOps";
import { useSplitDrag } from "@/hooks/useSplitDrag";
import { createEmptyEditorProject } from "@/lib/editorPersistence";
import {
    type RenderProgress,
    cancelEditorRender,
    chooseRenderDestination,
    getEditorRenderProgress,
    reportEditorRenderError,
    startEditorRender,
} from "@/lib/editorRender";
import { getRuntimeContext } from "@/lib/runtime";
import { cn } from "@/lib/utils";
import { useEditorStore, usePlayerStore } from "@/stores";

import { useEffect, useMemo, useState } from "react";

import {
    AudioLines,
    BookText,
    Clapperboard,
    Copy,
    FileJson2,
    FilePlus2,
    FolderOpen,
    ImagePlus,
    LayoutTemplate,
    PencilRuler,
    Play,
    Plus,
    Redo2,
    Save,
    Settings2,
    Sparkles,
    Square,
    Trash2,
    Undo2,
} from "lucide-react";

import type { EditorRenderSettings } from "@waldiez/editor-core";

const DEFAULT_RENDER_SETTINGS: Omit<EditorRenderSettings, "format"> & {
    format: EditorRenderSettings["format"];
} = {
    resolution: { width: 1920, height: 1080 },
    frameRate: 30,
    format: "mp4",
    quality: "high",
};

function formatSeconds(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return "0s";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.round(seconds % 60);
    return `${minutes}m ${remaining}s`;
}

function buildProjectSummary(sceneCount: number, totalDuration: number) {
    return [
        { label: "Scenes", value: String(sceneCount) },
        { label: "Runtime", value: formatSeconds(totalDuration) },
        { label: "Pacing", value: sceneCount > 0 ? `${Math.round(totalDuration / sceneCount)}s avg` : "n/a" },
    ];
}

export function EditorView({ onSettingsOpen }: { onSettingsOpen?: () => void }) {
    const runtime = getRuntimeContext();
    const setPlayerMode = usePlayerStore(s => s.setPlayerMode);
    const leftPanel = useSplitDrag({ initial: 320, min: 160, max: 520 });
    const rightPanel = useSplitDrag({ initial: 384, min: 160, max: 560, reverse: true });
    const currentProject = useEditorStore(s => s.currentProject);
    const selectedSceneId = useEditorStore(s => s.selectedSceneId);
    const selectedClipId = useEditorStore(s => s.selectedClipId);
    const isDirty = useEditorStore(s => s.isDirty);
    const setCurrentProject = useEditorStore(s => s.setCurrentProject);
    const setSelectedSceneId = useEditorStore(s => s.setSelectedSceneId);
    const setSelectedClipId = useEditorStore(s => s.setSelectedClipId);
    const undo = useEditorStore(s => s.undo);
    const redo = useEditorStore(s => s.redo);
    const canUndo = useEditorStore(s => s.canUndo);
    const canRedo = useEditorStore(s => s.canRedo);
    const updateProjectMeta = useEditorStore(s => s.updateProjectMeta);
    const updateProjectSettings = useEditorStore(s => s.updateProjectSettings);
    const updateScene = useEditorStore(s => s.updateScene);
    const updateClip = useEditorStore(s => s.updateClip);
    const moveClip = useEditorStore(s => s.moveClip);
    const trimClipStart = useEditorStore(s => s.trimClipStart);
    const trimClipEnd = useEditorStore(s => s.trimClipEnd);
    const slipClipContent = useEditorStore(s => s.slipClipContent);
    const addScene = useEditorStore(s => s.addScene);
    const duplicateScene = useEditorStore(s => s.duplicateScene);
    const addTrack = useEditorStore(s => s.addTrack);
    const addClipToTrack = useEditorStore(s => s.addClipToTrack);
    const removeClip = useEditorStore(s => s.removeClip);
    const removeScene = useEditorStore(s => s.removeScene);
    const moveScene = useEditorStore(s => s.moveScene);
    const { saving, opening, exporting, handleOpen, handleSave, handleExportJson } = useEditorFileOps();
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [previewElapsed, setPreviewElapsed] = useState(0);
    const [renderSettings, setRenderSettings] = useState<EditorRenderSettings>(() => ({
        ...DEFAULT_RENDER_SETTINGS,
        format: runtime.isTauri ? "mp4" : "html",
    }));
    const [renderJobId, setRenderJobId] = useState<string | null>(null);
    const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);

    const scenes = useMemo(() => currentProject?.scenes ?? [], [currentProject?.scenes]);
    const tracks = useMemo(() => currentProject?.timeline.tracks ?? [], [currentProject?.timeline.tracks]);
    const totalDuration = useMemo(() => scenes.reduce((sum, scene) => sum + scene.duration, 0), [scenes]);
    const previewScene = useMemo(() => {
        if (scenes.length === 0) return null;
        let cursor = 0;
        for (const scene of scenes) {
            const next = cursor + scene.duration;
            if (previewElapsed < next) return scene;
            cursor = next;
        }
        return scenes[scenes.length - 1] ?? null;
    }, [previewElapsed, scenes]);
    const selectedScene =
        scenes.find(scene => scene.id === selectedSceneId) ?? previewScene ?? scenes[0] ?? null;
    const selectedClip =
        tracks.flatMap(track => track.clips).find(clip => clip.id === selectedClipId) ?? null;
    const summary = useMemo(
        () => buildProjectSummary(scenes.length, totalDuration),
        [scenes.length, totalDuration],
    );

    useEffect(() => {
        if (!isPreviewPlaying || scenes.length === 0) return;
        const timer = window.setInterval(() => {
            setPreviewElapsed(current => {
                const next = current + 0.25;
                if (next >= totalDuration) {
                    setIsPreviewPlaying(false);
                    return 0;
                }
                return next;
            });
        }, 250);
        return () => window.clearInterval(timer);
    }, [isPreviewPlaying, scenes.length, totalDuration]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const isMod = event.metaKey || event.ctrlKey;
            if (!isMod) return;
            if (event.key.toLowerCase() === "z" && !event.shiftKey) {
                event.preventDefault();
                undo();
                return;
            }
            if (event.key.toLowerCase() === "z" && event.shiftKey) {
                event.preventDefault();
                redo();
                return;
            }
            if (event.key.toLowerCase() === "y") {
                event.preventDefault();
                redo();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [redo, undo]);

    useEffect(() => {
        if (!renderJobId) return;
        const timer = window.setInterval(() => {
            void getEditorRenderProgress(renderJobId)
                .then(progress => {
                    setRenderProgress(progress);
                    if (
                        progress.status === "completed" ||
                        progress.status === "failed" ||
                        progress.status === "cancelled"
                    ) {
                        window.clearInterval(timer);
                        setRenderJobId(null);
                    }
                })
                .catch(error => {
                    window.clearInterval(timer);
                    setRenderJobId(null);
                    reportEditorRenderError("progress", error);
                });
        }, 600);
        return () => window.clearInterval(timer);
    }, [renderJobId]);

    async function handleSelectSceneMedia() {
        if (!selectedScene) return;
        try {
            if (runtime.isTauri) {
                const { open } = await import("@tauri-apps/plugin-dialog");
                const chosen = await open({
                    multiple: false,
                    filters: [
                        { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
                        { name: "Videos", extensions: ["mp4", "mov", "webm", "mkv"] },
                    ],
                });
                if (!chosen || typeof chosen !== "string") return;
                const name = chosen.replace(/.*[\\/]/, "");
                const ext = name.split(".").pop()?.toLowerCase() ?? "";
                updateScene(selectedScene.id, {
                    mediaPath: chosen,
                    mediaName: name,
                    mediaKind: ["mp4", "mov", "webm", "mkv"].includes(ext) ? "video" : "image",
                });
                return;
            }

            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*,video/*";
            input.onchange = event => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (!file) return;
                updateScene(selectedScene.id, {
                    mediaPath: URL.createObjectURL(file),
                    mediaName: file.name,
                    mediaKind: file.type.startsWith("video/") ? "video" : "image",
                });
            };
            input.click();
        } catch (error) {
            reportEditorRenderError("media attach", error);
        }
    }

    async function handleSelectSceneAudio() {
        if (!selectedScene) return;
        try {
            if (runtime.isTauri) {
                const { open } = await import("@tauri-apps/plugin-dialog");
                const chosen = await open({
                    multiple: false,
                    filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "aac", "flac"] }],
                });
                if (!chosen || typeof chosen !== "string") return;
                updateScene(selectedScene.id, {
                    audioPath: chosen,
                    audioName: chosen.replace(/.*[\\/]/, ""),
                });
                return;
            }

            const input = document.createElement("input");
            input.type = "file";
            input.accept = "audio/*";
            input.onchange = event => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (!file) return;
                updateScene(selectedScene.id, {
                    audioPath: URL.createObjectURL(file),
                    audioName: file.name,
                });
            };
            input.click();
        } catch (error) {
            reportEditorRenderError("audio attach", error);
        }
    }

    async function handleStartRender() {
        if (!currentProject) return;
        try {
            const destination = await chooseRenderDestination(currentProject, renderSettings.format);
            if (!destination) return;
            const jobId = await startEditorRender(currentProject, renderSettings, destination);
            if (jobId === "browser-export") {
                setRenderProgress({
                    jobId,
                    status: "completed",
                    progress: 1,
                    message: "Browser export completed.",
                    outputPath: destination,
                });
                return;
            }
            setRenderJobId(jobId);
            setRenderProgress({
                jobId,
                status: "queued",
                progress: 0,
                message: "Queued",
                outputPath: destination,
            });
        } catch (error) {
            reportEditorRenderError("start", error);
        }
    }

    async function handleCancelRender() {
        if (!renderJobId) return;
        try {
            await cancelEditorRender(renderJobId);
        } catch (error) {
            reportEditorRenderError("cancel", error);
        }
    }

    if (!currentProject) {
        return (
            <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.18),_transparent_38%),linear-gradient(180deg,#08111a,#0f172a)] text-white">
                <div className="border-b border-white/10 px-6 py-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="flex items-center gap-2 text-xl font-semibold">
                                <PencilRuler className="h-5 w-5 text-teal-300" />
                                Editor
                            </h2>
                            <p className="mt-1 text-sm text-slate-300">
                                Desktop-first authoring workspace backed by `editor-core`.
                            </p>
                        </div>
                        <Button variant="secondary" onClick={() => setPlayerMode("standard")}>
                            Exit editor
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-center px-6 py-10">
                    <div className="grid w-full max-w-6xl gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                        <div className="rounded-[30px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
                            <div className="flex items-start gap-4">
                                <div className="rounded-3xl bg-teal-400/15 p-4 text-teal-200">
                                    <LayoutTemplate className="h-8 w-8" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-2xl font-semibold">No editor project open</h3>
                                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                                        Create a blank project, open an existing `.wdz` bundle, or prepare a
                                        draft from reader mode. The desktop path saves through Rust and
                                        exports storyboard renders directly from the editor.
                                    </p>
                                    <div className="mt-6 flex flex-wrap gap-3">
                                        <Button
                                            onClick={() => {
                                                setCurrentProject(createEmptyEditorProject());
                                                setPlayerMode("editor");
                                            }}
                                        >
                                            <FilePlus2 className="mr-2 h-4 w-4" />
                                            New project
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={() => void handleOpen()}
                                            disabled={opening}
                                        >
                                            <FolderOpen className="mr-2 h-4 w-4" />
                                            {opening ? "Opening..." : "Open project"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[30px] border border-white/10 bg-black/20 p-6 backdrop-blur">
                            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
                                <Sparkles className="h-4 w-4 text-amber-300" />
                                Current scope
                            </div>
                            <ul className="space-y-3 text-sm leading-6 text-slate-300">
                                <li>Scene-based authoring with desktop `.wdz` save and load.</li>
                                <li>Scene visuals for image and video-backed preview composition.</li>
                                <li>Storyboard HTML, SRT, and JSON export from the editor.</li>
                                <li>
                                    {runtime.isTauri
                                        ? "Running with Rust desktop export enabled."
                                        : "Running in browser export fallback mode."}
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-[linear-gradient(180deg,#06131a,#0f172a)] text-white">
            <div className="border-b border-white/10 bg-black/10 px-5 py-4 backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <PencilRuler className="h-5 w-5 text-teal-300" />
                            <h2 className="truncate text-xl font-semibold">{currentProject.title}</h2>
                            {isDirty && (
                                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-200">
                                    Unsaved
                                </span>
                            )}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-400">
                            {currentProject.filePath ?? "Unsaved project"} ·{" "}
                            {currentProject.source.sourceName} ·{" "}
                            {runtime.isTauri ? "Desktop backend" : "Browser fallback"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => setCurrentProject(createEmptyEditorProject())}
                        >
                            <FilePlus2 className="mr-2 h-4 w-4" />
                            New
                        </Button>
                        <Button variant="secondary" onClick={() => void handleOpen()} disabled={opening}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            {opening ? "Opening..." : "Open"}
                        </Button>
                        <Button onClick={() => void handleSave()} disabled={saving}>
                            <Save className="mr-2 h-4 w-4" />
                            {saving ? "Saving..." : "Save"}
                        </Button>
                        <Button variant="secondary" onClick={() => void handleSave(true)} disabled={saving}>
                            Save as
                        </Button>
                        <Button variant="secondary" onClick={undo} disabled={!canUndo}>
                            <Undo2 className="mr-2 h-4 w-4" />
                            Undo
                        </Button>
                        <Button variant="secondary" onClick={redo} disabled={!canRedo}>
                            <Redo2 className="mr-2 h-4 w-4" />
                            Redo
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => void handleExportJson()}
                            disabled={exporting}
                        >
                            <FileJson2 className="mr-2 h-4 w-4" />
                            {exporting ? "Exporting..." : "Export JSON"}
                        </Button>
                        {onSettingsOpen && (
                            <Button variant="ghost" onClick={onSettingsOpen}>
                                <Settings2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="ghost" onClick={() => setPlayerMode("standard")}>
                            Exit editor
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex min-h-0 flex-1">
                <aside
                    className="min-h-0 overflow-auto border-r border-white/10 bg-black/20 px-4 py-4"
                    style={{ width: leftPanel.px, flexShrink: 0 }}
                >
                    <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                Project pulse
                            </div>
                            <BookText className="h-4 w-4 text-teal-300" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {summary.map(item => (
                                <div
                                    key={item.label}
                                    className="rounded-2xl border border-white/10 bg-black/20 p-3"
                                >
                                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                        {item.label}
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 mb-3 flex items-center justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Scenes
                        </div>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={addScene}
                                className="rounded-full border border-white/10 bg-white/5 p-1 text-slate-300 transition hover:bg-white/10"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => addTrack("video")}
                                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 transition hover:bg-white/10"
                            >
                                + lane
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {scenes.map((scene, index) => {
                            const start = scenes
                                .slice(0, index)
                                .reduce((sum, item) => sum + item.duration, 0);
                            return (
                                <button
                                    key={scene.id}
                                    type="button"
                                    onClick={() => setSelectedSceneId(scene.id)}
                                    className={cn(
                                        "w-full rounded-2xl border px-3 py-3 text-left transition",
                                        selectedScene?.id === scene.id
                                            ? "border-teal-400/60 bg-teal-400/10 shadow-lg shadow-teal-950/30"
                                            : "border-white/10 bg-white/5 hover:border-white/20",
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-white">
                                                {scene.title}
                                            </div>
                                            <div className="mt-1 text-[11px] text-slate-400">
                                                {formatSeconds(start)} start · {scene.duration}s
                                                {scene.mediaKind ? ` · ${scene.mediaKind}` : ""}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <MiniAction
                                                onClick={() => moveScene(scene.id, "up")}
                                                label="Move up"
                                            >
                                                ↑
                                            </MiniAction>
                                            <MiniAction
                                                onClick={() => moveScene(scene.id, "down")}
                                                label="Move down"
                                            >
                                                ↓
                                            </MiniAction>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-5 rounded-[26px] border border-white/10 bg-white/5 p-4">
                        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Timeline Lanes
                        </div>
                        <div className="space-y-3">
                            {tracks.map(track => (
                                <div
                                    key={track.id}
                                    className="rounded-2xl border border-white/10 bg-black/20 p-3"
                                >
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <div className="text-xs font-semibold text-white">
                                            {track.name}
                                            <span className="ml-2 text-slate-400">{track.type}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => addClipToTrack(track.id)}
                                            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300"
                                        >
                                            + clip
                                        </button>
                                    </div>
                                    <div className="relative overflow-x-auto">
                                        <div className="relative h-14 min-w-[36rem] rounded-xl border border-white/10 bg-black/20">
                                            {track.clips.map(clip => (
                                                <button
                                                    key={clip.id}
                                                    type="button"
                                                    onClick={() => setSelectedClipId(clip.id)}
                                                    className={cn(
                                                        "absolute top-2 h-10 rounded-xl border px-2 text-left text-[11px] transition",
                                                        selectedClip?.id === clip.id
                                                            ? "border-amber-400/70 bg-amber-500/20 text-white"
                                                            : "border-white/10 bg-white/10 text-slate-200",
                                                    )}
                                                    style={{
                                                        left: `${clip.startTime * 18}px`,
                                                        width: `${Math.max(72, clip.duration * 24)}px`,
                                                    }}
                                                >
                                                    <div className="truncate">{clip.title}</div>
                                                    {track.type === "audio" && (
                                                        <div className="mt-1 h-1 rounded-full bg-white/10">
                                                            <div
                                                                className="h-full rounded-full bg-teal-300"
                                                                style={{
                                                                    width: `${Math.max(8, (clip.opacity ?? 1) * 100)}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                <DragHandle
                    direction="horizontal"
                    onPointerDown={leftPanel.onPointerDown}
                    onPointerMove={leftPanel.onPointerMove}
                    onPointerUp={leftPanel.onPointerUp}
                    className="border-x border-white/10"
                />

                <main className="min-h-0 flex-1 overflow-auto px-5 py-5">
                    <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Composition
                                </div>
                                <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                                    Shape a document into scenes, pacing, preview visuals, and storyboard
                                    outputs.
                                </div>
                            </div>
                            <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                                {currentProject.settings.resolution.width}x
                                {currentProject.settings.resolution.height} ·{" "}
                                {currentProject.settings.frameRate} fps
                            </div>
                        </div>

                        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
                            {scenes.map((scene, index) => {
                                const start = scenes
                                    .slice(0, index)
                                    .reduce((sum, item) => sum + item.duration, 0);
                                return (
                                    <button
                                        key={scene.id}
                                        type="button"
                                        onClick={() => setSelectedSceneId(scene.id)}
                                        style={{ width: `${Math.max(160, scene.duration * 20)}px` }}
                                        className={cn(
                                            "shrink-0 rounded-[24px] border px-4 py-4 text-left transition",
                                            previewScene?.id === scene.id
                                                ? "border-amber-400/70 bg-amber-500/15"
                                                : selectedScene?.id === scene.id
                                                  ? "border-fuchsia-400/70 bg-fuchsia-500/15"
                                                  : "border-white/10 bg-black/20 hover:border-white/20",
                                        )}
                                    >
                                        <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                            {formatSeconds(start)}
                                        </div>
                                        <div className="mt-2 truncate text-sm font-medium text-white">
                                            {scene.title}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-400">
                                            {scene.duration}s block
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {selectedScene && (
                        <section className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                            Live Preview
                                        </div>
                                        <div className="mt-1 text-sm text-slate-300">
                                            {previewScene?.title ?? selectedScene.title} ·{" "}
                                            {formatSeconds(previewElapsed)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                if (isPreviewPlaying) setIsPreviewPlaying(false);
                                                else setIsPreviewPlaying(true);
                                            }}
                                        >
                                            {isPreviewPlaying ? (
                                                <>
                                                    <Square className="mr-2 h-4 w-4" />
                                                    Pause
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="mr-2 h-4 w-4" />
                                                    Preview
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setPreviewElapsed(0);
                                                setIsPreviewPlaying(false);
                                            }}
                                        >
                                            Reset
                                        </Button>
                                    </div>
                                </div>

                                <div
                                    className="relative min-h-[22rem] overflow-hidden rounded-[24px] border border-white/10 p-8 shadow-inner"
                                    style={{
                                        background: `linear-gradient(135deg, ${currentProject.settings.backgroundColor}, rgba(15,23,42,0.92))`,
                                    }}
                                >
                                    {previewScene?.mediaKind === "image" && previewScene.mediaPath && (
                                        <img
                                            src={previewScene.mediaPath}
                                            alt={previewScene.mediaName ?? previewScene.title}
                                            className={cn(
                                                "absolute inset-0 h-full w-full opacity-35",
                                                previewScene.mediaFit === "contain"
                                                    ? "object-contain"
                                                    : "object-cover",
                                            )}
                                        />
                                    )}
                                    {previewScene?.mediaKind === "video" && previewScene.mediaPath && (
                                        <video
                                            src={previewScene.mediaPath}
                                            className={cn(
                                                "absolute inset-0 h-full w-full opacity-45",
                                                previewScene.mediaFit === "contain"
                                                    ? "object-contain"
                                                    : "object-cover",
                                            )}
                                            muted
                                            autoPlay
                                            loop
                                            playsInline
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                                    <div className="relative z-10 max-w-3xl">
                                        <div className="mb-4 text-xs uppercase tracking-[0.3em] text-white/60">
                                            {previewScene?.title ?? selectedScene.title}
                                        </div>
                                        <pre className="font-sans whitespace-pre-wrap text-lg leading-8 text-white">
                                            {(previewScene?.text ?? selectedScene.text) ||
                                                "Scene text appears here."}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Source context
                                </div>
                                <div className="space-y-3 text-sm text-slate-300">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                        <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                            Imported from
                                        </div>
                                        <div className="mt-1 font-medium text-white">
                                            {currentProject.source.sourceName}
                                        </div>
                                        <div className="mt-1 break-all text-xs text-slate-400">
                                            {currentProject.source.sourcePath ?? "No local path recorded"}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                        <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                            Scene asset
                                        </div>
                                        <div className="mt-1 text-white">
                                            {selectedScene.mediaName ?? "No visual attached"}
                                        </div>
                                        <div className="mt-1 break-all text-xs text-slate-400">
                                            {selectedScene.mediaPath ??
                                                "Attach an image or video for scene preview"}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                        <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                            Scene audio
                                        </div>
                                        <div className="mt-1 text-white">
                                            {selectedScene.audioName ?? "No audio attached"}
                                        </div>
                                        <div className="mt-1 break-all text-xs text-slate-400">
                                            {selectedScene.audioPath ??
                                                "Attach an audio bed or voice track for this scene"}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-400">
                                        MP4 export now runs through the desktop render job path first. If
                                        video render is unavailable, the export system still has storyboard
                                        outputs as fallback.
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                </main>

                <DragHandle
                    direction="horizontal"
                    onPointerDown={rightPanel.onPointerDown}
                    onPointerMove={rightPanel.onPointerMove}
                    onPointerUp={rightPanel.onPointerUp}
                    className="border-x border-white/10"
                />

                <aside
                    className="min-h-0 overflow-auto border-l border-white/10 bg-black/20 px-4 py-4"
                    style={{ width: rightPanel.px, flexShrink: 0 }}
                >
                    <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Inspector
                    </div>

                    <InspectorCard title="Project">
                        <Field
                            label="Title"
                            value={currentProject.title}
                            onChange={value => updateProjectMeta({ title: value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <Field
                                label="Width"
                                value={String(currentProject.settings.resolution.width)}
                                onChange={value =>
                                    updateProjectSettings({
                                        resolution: {
                                            ...currentProject.settings.resolution,
                                            width: Number(value) || currentProject.settings.resolution.width,
                                        },
                                    })
                                }
                            />
                            <Field
                                label="Height"
                                value={String(currentProject.settings.resolution.height)}
                                onChange={value =>
                                    updateProjectSettings({
                                        resolution: {
                                            ...currentProject.settings.resolution,
                                            height:
                                                Number(value) || currentProject.settings.resolution.height,
                                        },
                                    })
                                }
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Field
                                label="FPS"
                                value={String(currentProject.settings.frameRate)}
                                onChange={value =>
                                    updateProjectSettings({
                                        frameRate: Number(value) || currentProject.settings.frameRate,
                                    })
                                }
                            />
                            <Field
                                label="Background"
                                value={currentProject.settings.backgroundColor}
                                onChange={value => updateProjectSettings({ backgroundColor: value })}
                            />
                        </div>
                    </InspectorCard>

                    {selectedScene && (
                        <InspectorCard title="Scene">
                            <Field
                                label="Scene title"
                                value={selectedScene.title}
                                onChange={value => updateScene(selectedScene.id, { title: value })}
                            />
                            <Field
                                label="Duration (s)"
                                value={String(selectedScene.duration)}
                                onChange={value =>
                                    updateScene(selectedScene.id, {
                                        duration: Math.max(1, Number(value) || 1),
                                    })
                                }
                            />
                            <Field
                                label="Media path or URL"
                                value={selectedScene.mediaPath ?? ""}
                                onChange={value =>
                                    updateScene(selectedScene.id, {
                                        mediaPath: value || undefined,
                                        mediaKind:
                                            selectedScene.mediaKind ??
                                            (/(\.mp4|\.mov|\.webm|\.mkv)$/i.test(value)
                                                ? "video"
                                                : value
                                                  ? "image"
                                                  : undefined),
                                    })
                                }
                            />
                            <SelectField
                                label="Media fit"
                                value={selectedScene.mediaFit ?? "cover"}
                                options={[
                                    { value: "cover", label: "Cover" },
                                    { value: "contain", label: "Contain" },
                                ]}
                                onChange={value =>
                                    updateScene(selectedScene.id, {
                                        mediaFit: value as "cover" | "contain",
                                    })
                                }
                            />
                            <SegmentedChoiceField
                                label="Media fit quick"
                                value={selectedScene.mediaFit ?? "cover"}
                                options={[
                                    { value: "cover", label: "Cover" },
                                    { value: "contain", label: "Contain" },
                                ]}
                                onChange={value =>
                                    updateScene(selectedScene.id, {
                                        mediaFit: value as "cover" | "contain",
                                    })
                                }
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => void handleSelectSceneMedia()}
                                    className="justify-center"
                                >
                                    <ImagePlus className="mr-2 h-4 w-4" />
                                    Attach media
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => duplicateScene(selectedScene.id)}
                                    className="justify-center"
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicate
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => void handleSelectSceneAudio()}
                                    className="justify-center"
                                >
                                    <AudioLines className="mr-2 h-4 w-4" />
                                    Attach audio
                                </Button>
                                <Field
                                    label="Audio volume"
                                    value={String(selectedScene.audioVolume ?? 0.8)}
                                    onChange={value =>
                                        updateScene(selectedScene.id, {
                                            audioVolume: Math.max(0, Math.min(2, Number(value) || 0)),
                                        })
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Field
                                    label="Audio path"
                                    value={selectedScene.audioPath ?? ""}
                                    onChange={value =>
                                        updateScene(selectedScene.id, {
                                            audioPath: value || undefined,
                                        })
                                    }
                                />
                                <Field
                                    label="Audio offset (s)"
                                    value={String(selectedScene.audioOffset ?? 0)}
                                    onChange={value =>
                                        updateScene(selectedScene.id, {
                                            audioOffset: Math.max(0, Number(value) || 0),
                                        })
                                    }
                                />
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => removeScene(selectedScene.id)}
                                className="w-full justify-center text-red-200 hover:text-red-100"
                                disabled={scenes.length <= 1}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove scene
                            </Button>
                            <label className="block">
                                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Scene text
                                </span>
                                <textarea
                                    value={selectedScene.text}
                                    onChange={event =>
                                        updateScene(selectedScene.id, { text: event.target.value })
                                    }
                                    className="min-h-[16rem] w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none transition focus:border-teal-400/60"
                                />
                            </label>
                        </InspectorCard>
                    )}

                    <InspectorCard title="Render">
                        <div className="grid grid-cols-2 gap-2">
                            <SelectField
                                label="Format"
                                value={renderSettings.format}
                                options={[
                                    ...(runtime.isTauri ? [{ value: "mp4", label: "MP4" }] : []),
                                    { value: "html", label: "HTML" },
                                    { value: "srt", label: "SRT" },
                                    { value: "json", label: "JSON" },
                                ]}
                                onChange={value =>
                                    setRenderSettings(current => ({
                                        ...current,
                                        format: value as EditorRenderSettings["format"],
                                    }))
                                }
                            />
                            <SelectField
                                label="Quality"
                                value={renderSettings.quality}
                                options={[
                                    { value: "medium", label: "Medium" },
                                    { value: "high", label: "High" },
                                    { value: "lossless", label: "Lossless" },
                                ]}
                                onChange={value =>
                                    setRenderSettings(current => ({
                                        ...current,
                                        quality: value as EditorRenderSettings["quality"],
                                    }))
                                }
                            />
                            <SegmentedChoiceField
                                label="Quick quality"
                                value={renderSettings.quality}
                                options={[
                                    { value: "medium", label: "Medium" },
                                    { value: "high", label: "High" },
                                    { value: "lossless", label: "Lossless" },
                                ]}
                                onChange={value =>
                                    setRenderSettings(current => ({
                                        ...current,
                                        quality: value as EditorRenderSettings["quality"],
                                    }))
                                }
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Field
                                label="Render width"
                                value={String(renderSettings.resolution.width)}
                                onChange={value =>
                                    setRenderSettings(current => ({
                                        ...current,
                                        resolution: {
                                            ...current.resolution,
                                            width: Number(value) || current.resolution.width,
                                        },
                                    }))
                                }
                            />
                            <Field
                                label="Render height"
                                value={String(renderSettings.resolution.height)}
                                onChange={value =>
                                    setRenderSettings(current => ({
                                        ...current,
                                        resolution: {
                                            ...current.resolution,
                                            height: Number(value) || current.resolution.height,
                                        },
                                    }))
                                }
                            />
                        </div>
                        <Button onClick={() => void handleStartRender()} className="w-full justify-center">
                            <Clapperboard className="mr-2 h-4 w-4" />
                            Export render
                        </Button>
                        {renderProgress && (
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                                    <span>{renderProgress.status}</span>
                                    <span>{Math.round(renderProgress.progress * 100)}%</span>
                                </div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                                    <div
                                        className="h-full rounded-full bg-teal-400 transition-[width]"
                                        style={{ width: `${Math.max(4, renderProgress.progress * 100)}%` }}
                                    />
                                </div>
                                <p className="mt-2 text-xs text-slate-300">{renderProgress.message}</p>
                                {renderProgress.outputPath && (
                                    <p className="mt-1 break-all text-[11px] text-slate-500">
                                        {renderProgress.outputPath}
                                    </p>
                                )}
                                {renderJobId && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => void handleCancelRender()}
                                        className="mt-2 w-full justify-center"
                                    >
                                        Cancel render
                                    </Button>
                                )}
                            </div>
                        )}
                    </InspectorCard>

                    {selectedClip && (
                        <InspectorCard title="Clip">
                            <Field
                                label="Clip title"
                                value={selectedClip.title}
                                onChange={value => updateClip(selectedClip.id, { title: value })}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Field
                                    label="Start time"
                                    value={String(selectedClip.startTime)}
                                    onChange={value =>
                                        updateClip(selectedClip.id, {
                                            startTime: Math.max(0, Number(value) || 0),
                                        })
                                    }
                                />
                                <Field
                                    label="Duration"
                                    value={String(selectedClip.duration)}
                                    onChange={value =>
                                        updateClip(selectedClip.id, {
                                            duration: Math.max(0.25, Number(value) || 0.25),
                                        })
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Field
                                    label={selectedClip.trackType === "audio" ? "Volume" : "Opacity"}
                                    value={String(selectedClip.opacity)}
                                    onChange={value =>
                                        updateClip(selectedClip.id, {
                                            opacity: Math.max(0, Math.min(2, Number(value) || 0)),
                                        })
                                    }
                                />
                                <Field
                                    label="In point"
                                    value={String(selectedClip.inPoint)}
                                    onChange={value =>
                                        updateClip(selectedClip.id, {
                                            inPoint: Math.max(0, Number(value) || 0),
                                        })
                                    }
                                />
                            </div>
                            <SelectField
                                label="Transition"
                                value={selectedClip.transitions[0]?.type ?? "none"}
                                options={[
                                    { value: "none", label: "None" },
                                    { value: "fade", label: "Fade" },
                                ]}
                                onChange={value =>
                                    updateClip(selectedClip.id, {
                                        transitions:
                                            value === "none"
                                                ? []
                                                : [
                                                      {
                                                          id: `${selectedClip.id}-transition`,
                                                          type: value,
                                                          duration: 0.6,
                                                          position: "in",
                                                          easing: "linear",
                                                          parameters: {},
                                                      },
                                                  ],
                                    })
                                }
                            />
                            <SegmentedChoiceField
                                label="Quick transition"
                                value={selectedClip.transitions[0]?.type ?? "none"}
                                options={[
                                    { value: "none", label: "None" },
                                    { value: "fade", label: "Fade" },
                                ]}
                                onChange={value =>
                                    updateClip(selectedClip.id, {
                                        transitions:
                                            value === "none"
                                                ? []
                                                : [
                                                      {
                                                          id: `${selectedClip.id}-transition`,
                                                          type: value,
                                                          duration: 0.6,
                                                          position: "in",
                                                          easing: "linear",
                                                          parameters: {},
                                                      },
                                                  ],
                                    })
                                }
                            />
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                                    Keyframes
                                </div>
                                <div className="flex gap-2 overflow-x-auto">
                                    {(selectedClip.keyframes.length
                                        ? selectedClip.keyframes
                                        : [
                                              {
                                                  id: "default",
                                                  time: 0,
                                                  value: selectedClip.opacity,
                                                  easing: "linear",
                                              },
                                          ]
                                    ).map(keyframe => (
                                        <button
                                            key={keyframe.id}
                                            type="button"
                                            onClick={() =>
                                                updateClip(selectedClip.id, {
                                                    keyframes: selectedClip.keyframes.length
                                                        ? selectedClip.keyframes
                                                        : [
                                                              {
                                                                  id: `${selectedClip.id}-kf-0`,
                                                                  time: 0,
                                                                  value: selectedClip.opacity,
                                                                  easing: "linear",
                                                              },
                                                          ],
                                                })
                                            }
                                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200"
                                        >
                                            {keyframe.time}s → {keyframe.value}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => moveClip(selectedClip.id, -0.25)}
                                    className="justify-center"
                                >
                                    Move -0.25s
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => moveClip(selectedClip.id, 0.25)}
                                    className="justify-center"
                                >
                                    Move +0.25s
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => trimClipStart(selectedClip.id, 0.25)}
                                    className="justify-center"
                                >
                                    Trim in +0.25s
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => trimClipEnd(selectedClip.id, -0.25)}
                                    className="justify-center"
                                >
                                    Trim out -0.25s
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => slipClipContent(selectedClip.id, -0.25)}
                                    className="justify-center"
                                >
                                    Slip -0.25s
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => slipClipContent(selectedClip.id, 0.25)}
                                    className="justify-center"
                                >
                                    Slip +0.25s
                                </Button>
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => removeClip(selectedClip.id, { ripple: true })}
                                className="w-full justify-center text-red-200 hover:text-red-100"
                            >
                                Ripple delete clip
                            </Button>
                        </InspectorCard>
                    )}
                </aside>
            </div>
        </div>
    );
}
