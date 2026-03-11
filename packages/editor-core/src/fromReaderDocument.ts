import type { EditorProject, EditorTimelineClip, EditorTimelineTrack, ReaderDocumentInput } from "./types";

function slugify(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}

function buildSceneId(projectTitle: string, index: number): string {
    const base = slugify(projectTitle) || "reader";
    return `scene-${base}-${String(index + 1).padStart(2, "0")}`;
}

function estimateSceneDuration(text: string): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(6, Math.min(45, Math.ceil(words / 3)));
}

function buildDefaultTimeline(
    projectId: string,
    title: string,
    scenes: EditorProject["scenes"],
): { tracks: EditorTimelineTrack[] } {
    const captionTrackId = `${projectId}-captions`;
    const clips: EditorTimelineClip[] = [];
    let startTime = 0;
    for (const scene of scenes) {
        clips.push({
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
        });
        startTime += scene.duration;
    }

    return {
        tracks: [
            {
                id: captionTrackId,
                name: `${title} Captions`,
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

export function createEditorProjectFromReaderDocument(document: ReaderDocumentInput): EditorProject {
    const now = new Date().toISOString();
    const sections = document.sections.length
        ? document.sections
        : [
              {
                  id: `${document.id}-section-1`,
                  title: "Document",
                  content: document.plainText || document.rawText || "",
                  level: 1,
              },
          ];

    const project: EditorProject = {
        id: `editor-${slugify(document.title) || "project"}`,
        title: `${document.title} Draft`,
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
            sourceType: document.sourceType,
            sourceName: document.sourceName,
            sourcePath: document.sourcePath,
            importedAt: document.openedAt ?? now,
        },
        scenes: sections.map((section, index) => ({
            id: buildSceneId(document.title, index),
            title: section.title || `Section ${index + 1}`,
            order: index,
            text: section.content,
            duration: estimateSceneDuration(section.content),
            mediaFit: "cover",
            audioOffset: 0,
            audioVolume: 0.8,
            sourceSectionId: section.id,
            lineStart: section.lineStart,
        })),
        timeline: {
            tracks: [],
        },
        metadata: {
            readerDocumentId: document.id,
            sectionCount: sections.length,
            sourceMetadata: document.metadata ?? {},
        },
    };

    project.timeline = buildDefaultTimeline(project.id, project.title, project.scenes);
    return project;
}
