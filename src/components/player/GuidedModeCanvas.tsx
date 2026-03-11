import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ReaderDocument } from "@/types";
import type { PlayerMode } from "@/types";

import type { ReactNode } from "react";

import {
    BookOpenText,
    Clapperboard,
    GraduationCap,
    LayoutPanelTop,
    LibraryBig,
    Presentation,
    ScrollText,
    Settings2,
    Sparkles,
} from "lucide-react";

const MODE_COPY: Record<
    Extract<PlayerMode, "storyteller" | "presentation" | "learning">,
    {
        icon: React.ComponentType<{ className?: string }>;
        eyebrow: string;
        title: string;
        description: string;
        bullets: string[];
        accent: string;
    }
> = {
    storyteller: {
        icon: ScrollText,
        eyebrow: "Narrative Flow",
        title: "Shape a calmer, chapter-first storytelling space.",
        description:
            "Use this mode for spoken stories, guided narration, and long-form listening where pacing matters more than raw transport density.",
        bullets: [
            "Sleep timer and loops stay close.",
            "Chapter cues and text should feel soft and readable.",
        ],
        accent: "from-amber-400/30 via-orange-500/10 to-transparent",
    },
    presentation: {
        icon: Presentation,
        eyebrow: "Slide Rhythm",
        title: "Keep presentations crisp, readable, and stage-ready.",
        description:
            "This mode favors structure, slide cadence, and confidence cues so the content feels more like a deck than a generic player.",
        bullets: [
            "Page controls should stay obvious.",
            "Large-status messaging matters more than ambient chrome.",
        ],
        accent: "from-sky-400/30 via-cyan-500/10 to-transparent",
    },
    learning: {
        icon: GraduationCap,
        eyebrow: "Study Session",
        title: "Combine playback with references, notes, and repetition.",
        description:
            "This mode works best when learning material and playback live together. Reader documents become the study companion, not a separate mode hidden elsewhere.",
        bullets: ["A-B loop should feel natural.", "Docs and references need a direct on-ramp."],
        accent: "from-emerald-400/30 via-teal-500/10 to-transparent",
    },
};

export function GuidedModeCanvas({
    mode,
    currentMediaName,
    currentDocument,
    onOpenFiles,
    onOpenReader,
    onOpenSettings,
    children,
}: {
    mode: Extract<PlayerMode, "storyteller" | "presentation" | "learning">;
    currentMediaName?: string | null;
    currentDocument?: ReaderDocument | null;
    onOpenFiles: () => void;
    onOpenReader: () => void;
    onOpenSettings: () => void;
    children: ReactNode;
}) {
    const copy = MODE_COPY[mode];
    const Icon = copy.icon;

    return (
        <div className="grid h-full min-h-0 grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-auto border-r border-player-border bg-player-surface px-5 py-5">
                <div
                    className={cn(
                        "rounded-[28px] border border-player-border bg-gradient-to-br p-5",
                        copy.accent,
                    )}
                >
                    <div className="mb-3 inline-flex rounded-full border border-white/10 bg-black/20 p-2 text-player-accent">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-player-text-muted">
                        {copy.eyebrow}
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-player-text">{copy.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-player-text-muted">{copy.description}</p>
                    <div className="mt-4 space-y-2">
                        {copy.bullets.map(item => (
                            <div
                                key={item}
                                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-player-text"
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-5 grid gap-3">
                    <InfoCard
                        icon={Clapperboard}
                        title="Active media"
                        text={
                            currentMediaName ?? "No media selected yet. Open a file or add a source to start."
                        }
                    />
                    <InfoCard
                        icon={LibraryBig}
                        title={mode === "learning" ? "Reference document" : "Companion notes"}
                        text={
                            currentDocument
                                ? `${currentDocument.title} · ${currentDocument.sections.length} sections`
                                : mode === "learning"
                                  ? "Open a document to keep course notes, MANIFESTs, or markdown nearby."
                                  : "Reader mode can hold scripts, cue notes, or structured manifests for this session."
                        }
                    />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={onOpenFiles}>
                        <LayoutPanelTop className="mr-2 h-4 w-4" />
                        Open files
                    </Button>
                    <Button variant="secondary" onClick={onOpenReader}>
                        <BookOpenText className="mr-2 h-4 w-4" />
                        {currentDocument ? "Open reader" : "Add docs"}
                    </Button>
                    <Button variant="ghost" onClick={onOpenSettings}>
                        <Settings2 className="mr-2 h-4 w-4" />
                        Settings
                    </Button>
                </div>

                <div className="mt-5 rounded-[24px] border border-player-border bg-player-bg/50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-player-text">
                        <Sparkles className="h-4 w-4 text-player-accent" />
                        Workspace intent
                    </div>
                    <p className="text-sm leading-6 text-player-text-muted">
                        {mode === "storyteller"
                            ? "Prioritize calm narration, clean text, and bedtime-friendly control density."
                            : mode === "presentation"
                              ? "Prioritize pace, clarity, and quick slide movement with less visual clutter."
                              : "Prioritize study loops, readable references, and frictionless jumps between docs and playback."}
                    </p>
                </div>
            </aside>

            <div className="min-h-0 overflow-hidden bg-player-bg">{children}</div>
        </div>
    );
}

function InfoCard({
    icon: Icon,
    title,
    text,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    text: string;
}) {
    return (
        <div className="rounded-[24px] border border-player-border bg-player-bg/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-player-text">
                <Icon className="h-4 w-4 text-player-accent" />
                {title}
            </div>
            <p className="text-sm leading-6 text-player-text-muted">{text}</p>
        </div>
    );
}
