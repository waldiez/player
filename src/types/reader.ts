export type ReaderSourceType =
    | "text"
    | "markdown"
    | "pdf"
    | "html"
    | "manifest"
    | "archive"
    | "json"
    | "yaml";

export interface ReaderSection {
    id: string;
    title: string;
    level: number;
    content: string;
    lineStart?: number;
}

export interface ReaderDiagnostic {
    level: "info" | "warn" | "error";
    message: string;
}

export interface ReaderDocument {
    id: string;
    title: string;
    sourceName: string;
    sourcePath?: string;
    sourceUrl?: string;
    sourceType: ReaderSourceType;
    mimeType?: string;
    plainText: string;
    rawText: string;
    sections: ReaderSection[];
    metadata: Record<string, unknown>;
    diagnostics: ReaderDiagnostic[];
    openedAt: string;
}
