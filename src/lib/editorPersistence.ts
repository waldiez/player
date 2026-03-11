import { reportDiagnostic } from "@/lib/diagnostics";
import { getRuntimeContext } from "@/lib/runtime";

import type { DesktopProjectFile, EditorProject } from "@waldiez/editor-core";
import { fromDesktopProjectFile, toDesktopProjectFile } from "@waldiez/editor-core";

function triggerDownload(text: string, filename: string, mimeType: string): void {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function parseProjectJson(text: string): EditorProject {
    const parsed = JSON.parse(text) as DesktopProjectFile | EditorProject;
    if (parsed && typeof parsed === "object" && "composition" in parsed && "assets" in parsed) {
        return fromDesktopProjectFile(parsed as DesktopProjectFile);
    }
    return parsed as EditorProject;
}

export async function loadEditorProjectFromDesktopPath(path: string): Promise<EditorProject> {
    const runtime = getRuntimeContext();
    if (!runtime.isTauri) {
        throw new Error("Desktop project paths are only available in Tauri runtime");
    }

    const { invoke } = await import("@tauri-apps/api/core");
    const loaded = (await invoke("load_project", { path })) as DesktopProjectFile;
    return fromDesktopProjectFile(loaded);
}

export async function saveEditorProject(project: EditorProject): Promise<string> {
    return saveEditorProjectInternal(project, false);
}

export async function saveEditorProjectAs(project: EditorProject): Promise<string> {
    return saveEditorProjectInternal(project, true);
}

async function saveEditorProjectInternal(project: EditorProject, forceDialog: boolean): Promise<string> {
    const runtime = getRuntimeContext();
    const desktopProject = toDesktopProjectFile(project);

    if (runtime.isTauri) {
        const [{ invoke }, { save }] = await Promise.all([
            import("@tauri-apps/api/core"),
            import("@tauri-apps/plugin-dialog"),
        ]);
        const chosenPath =
            !forceDialog && project.filePath
                ? project.filePath
                : await save({
                      title: forceDialog ? "Save editor project as" : "Save editor project",
                      defaultPath: `${project.title.replace(/\s+/g, "-").toLowerCase() || "waldiez-editor"}.wdz`,
                      filters: [
                          { name: "Waldiez Project", extensions: ["wdz", "json"] },
                          { name: "JSON", extensions: ["json"] },
                      ],
                  });
        if (!chosenPath || typeof chosenPath !== "string") {
            throw new Error("Save cancelled");
        }
        await invoke("save_project", {
            project: desktopProject,
            path: chosenPath,
        });
        return chosenPath;
    }

    const filename = `${project.title.replace(/\s+/g, "-").toLowerCase() || "waldiez-editor"}.json`;
    triggerDownload(`${JSON.stringify(desktopProject, null, 2)}\n`, filename, "application/json");
    return filename;
}

export async function openEditorProject(): Promise<EditorProject> {
    const runtime = getRuntimeContext();

    if (runtime.isTauri) {
        const [{ open }, { invoke }] = await Promise.all([
            import("@tauri-apps/plugin-dialog"),
            import("@tauri-apps/api/core"),
        ]);
        const chosen = await open({
            multiple: false,
            filters: [
                { name: "Waldiez Project", extensions: ["wdz", "json"] },
                { name: "JSON", extensions: ["json"] },
            ],
        });
        if (!chosen || typeof chosen !== "string") {
            throw new Error("Open cancelled");
        }
        const loaded = (await invoke("load_project", { path: chosen })) as DesktopProjectFile;
        return fromDesktopProjectFile(loaded);
    }

    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".wdz,.json";
        input.onchange = async event => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) {
                reject(new Error("Open cancelled"));
                return;
            }
            try {
                resolve(parseProjectJson(await file.text()));
            } catch (error) {
                reject(error);
            }
        };
        input.click();
    });
}

export function exportEditorProjectJson(project: EditorProject): string {
    const desktopProject = toDesktopProjectFile(project);
    const filename = `${project.title.replace(/\s+/g, "-").toLowerCase() || "waldiez-editor"}.json`;
    triggerDownload(`${JSON.stringify(desktopProject, null, 2)}\n`, filename, "application/json");
    return filename;
}

export function createEmptyEditorProject(): EditorProject {
    const now = new Date().toISOString();
    const stamp = Date.now();
    const projectId = `editor-${stamp}`;
    const sceneId = `scene-${stamp}`;
    const trackId = `track-caption-${stamp}`;
    const clipId = `clip-${stamp}`;
    return {
        id: projectId,
        title: "Untitled Editor Project",
        createdAt: now,
        updatedAt: now,
        settings: {
            resolution: { width: 1920, height: 1080 },
            frameRate: 30,
            backgroundColor: "#0f172a",
            duration: "auto",
        },
        source: {
            kind: "reader-document",
            sourceType: "manual",
            sourceName: "Manual project",
            importedAt: now,
        },
        scenes: [
            {
                id: sceneId,
                title: "Scene 1",
                order: 0,
                text: "",
                duration: 8,
                mediaFit: "cover",
                audioOffset: 0,
                audioVolume: 0.8,
            },
        ],
        timeline: {
            tracks: [
                {
                    id: trackId,
                    name: "Scenes",
                    type: "caption",
                    isVisible: true,
                    isMuted: false,
                    isLocked: false,
                    opacity: 1,
                    blendMode: "normal",
                    clips: [
                        {
                            id: clipId,
                            trackId,
                            trackType: "caption",
                            title: "Scene 1",
                            captionText: "",
                            startTime: 0,
                            duration: 8,
                            inPoint: 0,
                            outPoint: 8,
                            opacity: 1,
                            sourceSceneId: sceneId,
                            effects: [],
                            transitions: [],
                            keyframes: [],
                        },
                    ],
                },
            ],
        },
        metadata: {
            createdInEditor: true,
        },
    };
}

export function reportEditorPersistenceError(action: string, error: unknown): void {
    reportDiagnostic({
        level: "error",
        area: "editor",
        message: `Editor ${action} failed.`,
        detail: error,
    });
}
