import { reportDiagnostic } from "@/lib/diagnostics";
import { getRuntimeContext } from "@/lib/runtime";

import type { DesktopProjectFile, EditorProject, EditorRenderSettings } from "@waldiez/editor-core";
import { toDesktopProjectFile } from "@waldiez/editor-core";

export interface RenderProgress {
    jobId: string;
    status: "queued" | "rendering" | "completed" | "failed" | "cancelled";
    progress: number;
    message: string;
    outputPath?: string | null;
}

function triggerDownload(text: string, filename: string, mimeType: string): string {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return filename;
}

function formatTimestamp(seconds: number): string {
    const clamped = Math.max(0, seconds);
    const hours = Math.floor(clamped / 3600);
    const minutes = Math.floor((clamped % 3600) / 60);
    const secs = Math.floor(clamped % 60);
    const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(
        2,
        "0",
    )},${String(millis).padStart(3, "0")}`;
}

function buildSrt(project: EditorProject): string {
    let cursor = 0;
    return `${project.scenes
        .map((scene, index) => {
            const start = cursor;
            cursor += scene.duration;
            return `${index + 1}\n${formatTimestamp(start)} --> ${formatTimestamp(cursor)}\n${scene.text.trim() || scene.title}\n`;
        })
        .join("\n")}\n`;
}

function buildHtml(project: EditorProject): string {
    const cards = project.scenes
        .map(
            (scene, index) => `
            <section class="scene">
              <div class="meta">Scene ${index + 1} · ${scene.duration}s${scene.mediaKind ? ` · ${scene.mediaKind}` : ""}</div>
              <h2>${escapeHtml(scene.title)}</h2>
              ${scene.mediaPath ? `<div class="asset">${escapeHtml(scene.mediaPath)}</div>` : ""}
              <pre>${escapeHtml(scene.text || "")}</pre>
            </section>`,
        )
        .join("\n");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(project.title)}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: "IBM Plex Sans", sans-serif; background: linear-gradient(180deg,#08111a,#0f172a); color: #f8fafc; }
    header { padding: 48px; border-bottom: 1px solid rgba(255,255,255,0.1); background: radial-gradient(circle at top left, rgba(45,212,191,0.18), transparent 38%); }
    h1 { margin: 0 0 8px; font-size: 40px; }
    main { padding: 32px; display: grid; gap: 20px; }
    .scene { border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 24px; background: rgba(255,255,255,0.04); }
    .meta { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; }
    h2 { margin: 12px 0; font-size: 22px; }
    .asset { margin-bottom: 12px; color: #5eead4; font-size: 14px; }
    pre { margin: 0; white-space: pre-wrap; font: 16px/1.8 "IBM Plex Mono", monospace; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(project.title)}</h1>
    <p>${project.scenes.length} scenes · ${project.settings.resolution.width}x${project.settings.resolution.height} · ${project.settings.frameRate} fps</p>
  </header>
  <main>${cards}</main>
</body>
</html>`;
}

function escapeHtml(input: string): string {
    return input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function extensionForFormat(format: EditorRenderSettings["format"]): string {
    return format;
}

export async function startEditorRender(
    project: EditorProject,
    settings: EditorRenderSettings,
    outputPath: string,
): Promise<string> {
    const runtime = getRuntimeContext();
    if (!runtime.isTauri) {
        const desktopProject = toDesktopProjectFile(project);
        if (settings.format === "srt") {
            triggerDownload(
                buildSrt(project),
                `${project.title || "waldiez-editor"}.srt`,
                "application/x-subrip",
            );
        } else if (settings.format === "html" || settings.format === "mp4") {
            triggerDownload(buildHtml(project), `${project.title || "waldiez-editor"}.html`, "text/html");
        } else {
            triggerDownload(
                `${JSON.stringify(desktopProject, null, 2)}\n`,
                `${project.title || "waldiez-editor"}.json`,
                "application/json",
            );
        }
        return "browser-export";
    }

    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("start_render_project", {
        project: toDesktopProjectFile(project) as DesktopProjectFile,
        settings: {
            resolution: [settings.resolution.width, settings.resolution.height],
            frameRate: settings.frameRate,
            format: settings.format,
            quality: settings.quality,
        },
        outputPath,
    });
}

export async function getEditorRenderProgress(jobId: string): Promise<RenderProgress> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<RenderProgress>("get_render_progress", { jobId });
}

export async function cancelEditorRender(jobId: string): Promise<void> {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("cancel_render", { jobId });
}

export async function chooseRenderDestination(
    project: EditorProject,
    format: EditorRenderSettings["format"],
): Promise<string | null> {
    const runtime = getRuntimeContext();
    if (!runtime.isTauri) {
        return `${project.title.replace(/\s+/g, "-").toLowerCase() || "waldiez-editor"}.${extensionForFormat(format)}`;
    }

    const { save } = await import("@tauri-apps/plugin-dialog");
    const chosen = await save({
        title: "Export editor render",
        defaultPath: `${project.title.replace(/\s+/g, "-").toLowerCase() || "waldiez-editor"}.${extensionForFormat(format)}`,
        filters: [
            { name: "MP4 video", extensions: ["mp4"] },
            { name: "HTML storyboard", extensions: ["html"] },
            { name: "SubRip captions", extensions: ["srt"] },
            { name: "JSON project", extensions: ["json"] },
        ],
    });
    if (!chosen || typeof chosen !== "string") return null;
    return chosen;
}

export function reportEditorRenderError(action: string, error: unknown): void {
    reportDiagnostic({
        level: "error",
        area: "editor",
        message: `Editor render ${action} failed.`,
        detail: error,
    });
}
