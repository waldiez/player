import { Button, DragHandle } from "@/components/ui";
import { useSplitDrag } from "@/hooks/useSplitDrag";
import { reportDiagnostic } from "@/lib/diagnostics";
import { importReaderDocumentFromBytes, importReaderDocumentFromFile } from "@/lib/readerImport";
import { getRuntimeContext } from "@/lib/runtime";
import { pdfCheck, pdfExtractText, pdfGetInfo, pdfRenderPage } from "@/lib/tauriPdf";
import { cn } from "@/lib/utils";
import { useEditorStore, usePlayerStore, useReaderStore } from "@/stores";

import { useEffect, useRef, useState } from "react";

import {
    BookOpenText,
    Braces,
    FileCode2,
    FileSearch,
    FolderOpen,
    LayoutPanelLeft,
    ListTree,
    RefreshCw,
} from "lucide-react";

import { createEditorProjectFromReaderDocument } from "@waldiez/editor-core";

type ReaderTab = "read" | "structure" | "source";

const TAB_BUTTONS: Array<{
    id: ReaderTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    { id: "read", label: "Read", icon: BookOpenText },
    { id: "structure", label: "Structure", icon: ListTree },
    { id: "source", label: "Source", icon: FileCode2 },
];

export function ReaderView({ onSettingsOpen }: { onSettingsOpen?: () => void }) {
    const runtime = getRuntimeContext();
    const leftPanel = useSplitDrag({ initial: 288, min: 160, max: 480 });
    const rightPanel = useSplitDrag({ initial: 320, min: 160, max: 480, reverse: true });
    const document = useReaderStore(s => s.currentDocument);
    const setCurrentDocument = useReaderStore(s => s.setCurrentDocument);
    const clearCurrentDocument = useReaderStore(s => s.clearCurrentDocument);
    const currentProject = useEditorStore(s => s.currentProject);
    const setCurrentProject = useEditorStore(s => s.setCurrentProject);
    const setPlayerMode = usePlayerStore(s => s.setPlayerMode);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<ReaderTab>("read");
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [pdfAvailable, setPdfAvailable] = useState(false);
    const [pdfPageCount, setPdfPageCount] = useState(1);
    const [pdfPage, setPdfPage] = useState(1);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [pdfPageText, setPdfPageText] = useState<string>("");
    const [pdfLoading, setPdfLoading] = useState(false);

    const selectedSection =
        document?.sections.find(section => section.id === selectedSectionId) ?? document?.sections[0] ?? null;

    useEffect(() => {
        if (!runtime.isTauri) return;
        void pdfCheck()
            .then(setPdfAvailable)
            .catch(() => setPdfAvailable(false));
    }, [runtime.isTauri]);

    useEffect(() => {
        setPdfPage(1);
        setPdfPreviewUrl(null);
        setPdfPageText("");
        if (!document || document.sourceType !== "pdf" || !document.sourcePath || !pdfAvailable) return;
        void pdfGetInfo(document.sourcePath)
            .then(info => setPdfPageCount(Math.max(1, info.pageCount)))
            .catch(error =>
                reportDiagnostic({
                    level: "warn",
                    area: "reader",
                    message: "Failed to inspect PDF page metadata.",
                    detail: error,
                }),
            );
    }, [document, pdfAvailable]);

    useEffect(() => {
        if (!document || document.sourceType !== "pdf" || !document.sourcePath || !pdfAvailable) return;
        let cancelled = false;
        setPdfLoading(true);
        void Promise.all([
            pdfRenderPage(document.sourcePath, pdfPage, 1400),
            pdfExtractText(document.sourcePath, pdfPage),
        ])
            .then(([previewUrl, pageText]) => {
                if (cancelled) return;
                setPdfPreviewUrl(previewUrl);
                setPdfPageText(pageText.trim());
            })
            .catch(error => {
                if (cancelled) return;
                reportDiagnostic({
                    level: "warn",
                    area: "reader",
                    message: "Desktop PDF rendering fell back to extracted text.",
                    detail: error,
                });
                setPdfPreviewUrl(null);
                setPdfPageText("");
            })
            .finally(() => {
                if (!cancelled) setPdfLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [document, pdfAvailable, pdfPage]);

    async function handleOpenDocument() {
        if (!runtime.isTauri) {
            fileInputRef.current?.click();
            return;
        }

        setLoading(true);
        try {
            const [{ open }, { readFile }, { convertFileSrc }] = await Promise.all([
                import("@tauri-apps/plugin-dialog"),
                import("@tauri-apps/plugin-fs"),
                import("@tauri-apps/api/core"),
            ]);
            const chosen = await open({ multiple: false });
            if (!chosen || typeof chosen !== "string") return;
            const bytes = await readFile(chosen);
            const name = chosen.replace(/.*[\\/]/, "");
            const nextDocument = await importReaderDocumentFromBytes({
                name,
                path: chosen,
                sourceUrl: convertFileSrc(chosen),
                bytes,
            });
            setCurrentDocument(nextDocument);
            setPlayerMode("reader");
            setSelectedSectionId(nextDocument.sections[0]?.id ?? null);
        } catch (error) {
            reportDiagnostic({
                level: "error",
                area: "reader",
                message: "Failed to open a local reader document.",
                detail: error,
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setLoading(true);
        try {
            const nextDocument = await importReaderDocumentFromFile(file);
            setCurrentDocument(nextDocument);
            setPlayerMode("reader");
            setSelectedSectionId(nextDocument.sections[0]?.id ?? null);
        } catch (error) {
            reportDiagnostic({
                level: "error",
                area: "reader",
                message: `Failed to import ${file.name} into reader mode.`,
                detail: error,
            });
        } finally {
            setLoading(false);
        }
    }

    function handlePrepareEditorDraft() {
        if (!document) return;
        try {
            const project = createEditorProjectFromReaderDocument(document);
            setCurrentProject(project);
            setPlayerMode("editor");
            reportDiagnostic({
                level: "info",
                area: "editor",
                message: `Prepared editor draft from ${document.sourceName}.`,
                detail: `${project.scenes.length} scenes`,
            });
        } catch (error) {
            reportDiagnostic({
                level: "error",
                area: "editor",
                message: "Failed to prepare an editor draft from the current document.",
                detail: error,
            });
        }
    }

    if (!document) {
        return (
            <div className="flex h-full flex-col bg-player-bg">
                <div className="border-b border-player-border bg-player-surface px-6 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-player-text">Reader</h2>
                            <p className="mt-1 text-sm text-player-text-muted">
                                Open text, Markdown, manifest, bundle, or PDF documents in a desktop-first
                                reading surface.
                            </p>
                        </div>
                        <Button variant="secondary" onClick={() => setPlayerMode("standard")}>
                            Exit reader
                        </Button>
                    </div>
                </div>
                <div className="flex flex-1 items-center justify-center px-6">
                    <div className="w-full max-w-3xl rounded-2xl border border-player-border bg-player-surface p-8 shadow-xl">
                        <div className="flex items-start gap-4">
                            <div className="rounded-2xl bg-player-accent/15 p-3 text-player-accent">
                                <FileSearch className="h-7 w-7" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-xl font-semibold text-player-text">No document open</h3>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-player-text-muted">
                                    Reader mode supports `.txt`, `.md`, `.json`, `.yaml`, `MANIFEST`, `.wid`,
                                    `.waldiez`, and best-effort `.pdf` extraction.
                                </p>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <Button onClick={() => void handleOpenDocument()} disabled={loading}>
                                        <FolderOpen className="mr-2 h-4 w-4" />
                                        {loading ? "Opening..." : "Open document"}
                                    </Button>
                                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Import from browser
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".txt,.md,.markdown,.pdf,.html,.htm,.wid,.waldiez,.json,.yaml,.yml"
                            onChange={event => void handleFileInputChange(event)}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-player-bg">
            <div className="border-b border-player-border bg-player-surface px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-player-text">
                            <LayoutPanelLeft className="h-4 w-4 text-player-accent" />
                            <h2 className="truncate text-lg font-semibold">{document.title}</h2>
                        </div>
                        <p className="mt-1 truncate text-xs text-player-text-muted">
                            {document.sourceType} {document.sourcePath ? `· ${document.sourcePath}` : ""}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => void handleOpenDocument()}
                            disabled={loading}
                        >
                            <FolderOpen className="mr-2 h-4 w-4" />
                            {loading ? "Opening..." : "Open"}
                        </Button>
                        <Button variant="secondary" onClick={handlePrepareEditorDraft}>
                            Prepare editor draft
                        </Button>
                        {onSettingsOpen && (
                            <Button variant="ghost" onClick={onSettingsOpen}>
                                Settings
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            onClick={() => {
                                clearCurrentDocument();
                                setSelectedSectionId(null);
                            }}
                        >
                            Clear
                        </Button>
                        <Button variant="ghost" onClick={() => setPlayerMode("standard")}>
                            Exit reader
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex min-h-0 flex-1">
                <aside
                    className="min-h-0 overflow-auto border-r border-player-border bg-player-surface px-4 py-4"
                    style={{ width: leftPanel.px, flexShrink: 0 }}
                >
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-player-text-muted">
                        Sections
                    </div>
                    <div className="space-y-2">
                        {document.sections.map(section => (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() => setSelectedSectionId(section.id)}
                                className={cn(
                                    "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                                    selectedSection?.id === section.id
                                        ? "border-player-accent bg-player-accent/10"
                                        : "border-player-border bg-player-bg/40 hover:border-player-accent/40",
                                )}
                            >
                                <div className="truncate text-sm font-medium text-player-text">
                                    {section.title}
                                </div>
                                <div className="mt-1 text-[11px] text-player-text-muted">
                                    Level {section.level}
                                    {section.lineStart ? ` · line ${section.lineStart}` : ""}
                                </div>
                            </button>
                        ))}
                    </div>
                </aside>

                <DragHandle
                    direction="horizontal"
                    onPointerDown={leftPanel.onPointerDown}
                    onPointerMove={leftPanel.onPointerMove}
                    onPointerUp={leftPanel.onPointerUp}
                    className="border-x border-player-border"
                />

                <main className="min-h-0 flex-1 overflow-auto px-6 py-5">
                    <div className="mb-4 flex gap-2">
                        {TAB_BUTTONS.map(tab => {
                            const Icon = tab.icon;
                            const active = tab.id === activeTab;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                                        active
                                            ? "border-player-accent bg-player-accent text-white"
                                            : "border-player-border bg-player-surface text-player-text-muted hover:text-player-text",
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {activeTab === "read" && (
                        <article className="space-y-4">
                            {document.sourceType === "pdf" && (document.sourceUrl || pdfPreviewUrl) && (
                                <div className="overflow-hidden rounded-3xl border border-player-border bg-player-surface">
                                    <div className="flex items-center justify-between border-b border-player-border px-4 py-3">
                                        <div>
                                            <h3 className="text-base font-semibold text-player-text">
                                                PDF preview
                                            </h3>
                                            <p className="text-xs text-player-text-muted">
                                                {pdfAvailable
                                                    ? `Rendered page ${pdfPage} of ${pdfPageCount} with desktop PDF support.`
                                                    : "Native preview when available, extracted text below."}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {pdfAvailable && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setPdfPage(current => Math.max(1, current - 1))
                                                        }
                                                        disabled={pdfLoading || pdfPage <= 1}
                                                    >
                                                        Prev page
                                                    </Button>
                                                    <div className="rounded-full border border-player-border px-3 py-1 text-xs text-player-text-muted">
                                                        {pdfPage} / {pdfPageCount}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setPdfPage(current =>
                                                                Math.min(pdfPageCount, current + 1),
                                                            )
                                                        }
                                                        disabled={pdfLoading || pdfPage >= pdfPageCount}
                                                    >
                                                        Next page
                                                    </Button>
                                                </>
                                            )}
                                            {document.sourceUrl && (
                                                <a
                                                    href={document.sourceUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-sm text-player-accent hover:underline"
                                                >
                                                    Open separately
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    {pdfPreviewUrl ? (
                                        <div className="max-h-[42rem] overflow-auto bg-[#d7dbe2] p-6">
                                            <img
                                                src={pdfPreviewUrl}
                                                alt={`${document.title} page ${pdfPage}`}
                                                className="mx-auto w-full max-w-5xl rounded-2xl bg-white shadow-2xl"
                                            />
                                        </div>
                                    ) : document.sourceUrl ? (
                                        <iframe
                                            title={document.title}
                                            src={document.sourceUrl}
                                            className="h-[28rem] w-full bg-white"
                                        />
                                    ) : null}
                                </div>
                            )}
                            <div className="prose prose-invert max-w-none">
                                <h3 className="mb-3 text-xl font-semibold text-player-text">
                                    {selectedSection?.title ?? document.title}
                                </h3>
                                <pre className="whitespace-pre-wrap rounded-2xl border border-player-border bg-player-surface p-5 text-sm leading-7 text-player-text">
                                    {(document.sourceType === "pdf" && pdfPageText) ||
                                        (selectedSection?.content ?? document.plainText) ||
                                        "No readable text extracted."}
                                </pre>
                            </div>
                        </article>
                    )}

                    {activeTab === "structure" && (
                        <div className="rounded-2xl border border-player-border bg-player-surface p-5">
                            <div className="mb-3 flex items-center gap-2 text-player-text">
                                <Braces className="h-4 w-4 text-player-accent" />
                                <h3 className="text-lg font-semibold">Structure</h3>
                            </div>
                            <pre className="whitespace-pre-wrap text-sm leading-7 text-player-text">
                                {JSON.stringify(document.metadata, null, 2)}
                            </pre>
                        </div>
                    )}

                    {activeTab === "source" && (
                        <div className="rounded-2xl border border-player-border bg-player-surface p-5">
                            <div className="mb-3 flex items-center gap-2 text-player-text">
                                <FileCode2 className="h-4 w-4 text-player-accent" />
                                <h3 className="text-lg font-semibold">Source</h3>
                            </div>
                            <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-player-text">
                                {document.rawText || "No raw source available."}
                            </pre>
                        </div>
                    )}
                </main>

                <DragHandle
                    direction="horizontal"
                    onPointerDown={rightPanel.onPointerDown}
                    onPointerMove={rightPanel.onPointerMove}
                    onPointerUp={rightPanel.onPointerUp}
                    className="border-x border-player-border"
                />

                <aside
                    className="min-h-0 overflow-auto border-l border-player-border bg-player-surface px-4 py-4"
                    style={{ width: rightPanel.px, flexShrink: 0 }}
                >
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-player-text-muted">
                        Metadata
                    </div>
                    <div className="space-y-3">
                        <ReaderMetaRow label="Source" value={document.sourceType} />
                        <ReaderMetaRow label="Sections" value={String(document.sections.length)} />
                        <ReaderMetaRow label="Opened" value={new Date(document.openedAt).toLocaleString()} />
                        {document.mimeType && <ReaderMetaRow label="MIME" value={document.mimeType} />}
                    </div>

                    <div className="mt-6">
                        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-player-text-muted">
                            Editor Handoff
                        </div>
                        {currentProject ? (
                            <div className="rounded-xl border border-player-border bg-player-bg/40 px-3 py-3">
                                <div className="text-sm font-medium text-player-text">
                                    {currentProject.title}
                                </div>
                                <div className="mt-1 text-xs text-player-text-muted">
                                    {currentProject.scenes.length} scenes · {currentProject.source.sourceType}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-player-text-muted">No editor draft prepared yet.</p>
                        )}
                    </div>

                    <div className="mt-6">
                        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-player-text-muted">
                            Diagnostics
                        </div>
                        {document.diagnostics.length === 0 ? (
                            <p className="text-sm text-player-text-muted">No reader diagnostics.</p>
                        ) : (
                            <div className="space-y-2">
                                {document.diagnostics.map((diagnostic, index) => (
                                    <div
                                        key={`${diagnostic.message}-${index}`}
                                        className={cn(
                                            "rounded-xl border px-3 py-2 text-sm",
                                            diagnostic.level === "error"
                                                ? "border-red-500/40 bg-red-500/10 text-red-100"
                                                : diagnostic.level === "warn"
                                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                                                  : "border-sky-500/40 bg-sky-500/10 text-sky-100",
                                        )}
                                    >
                                        {diagnostic.message}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}

function ReaderMetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-player-border bg-player-bg/40 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-player-text-muted">
                {label}
            </div>
            <div className="mt-1 break-words text-sm text-player-text">{value}</div>
        </div>
    );
}
