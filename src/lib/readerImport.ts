import { reportDiagnostic } from "@/lib/diagnostics";
import { nextWid } from "@/lib/wid";
import type { ReaderDiagnostic, ReaderDocument, ReaderSection, ReaderSourceType } from "@/types/reader";
import YAML from "yaml";

const MANIFEST_BASENAME = "manifest";
const TEXT_DECODER = new TextDecoder();

function encodeId(suffix: string): string {
    return `reader-${suffix}-${nextWid()}`;
}

function basename(path: string): string {
    const parts = path.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? path;
}

function normalizeLineEndings(input: string): string {
    return input.replace(/\r\n?/g, "\n");
}

function createSection(title: string, content: string, level: number, lineStart?: number): ReaderSection {
    return {
        id: encodeId("section"),
        title,
        content: content.trim(),
        level,
        lineStart,
    };
}

function splitPlainTextSections(text: string): ReaderSection[] {
    const normalized = normalizeLineEndings(text);
    const chunks = normalized
        .split(/\n{2,}/)
        .map((chunk, index) => ({
            chunk: chunk.trim(),
            lineStart: normalized.slice(0, normalized.indexOf(chunk)).split("\n").length,
            index,
        }))
        .filter(item => item.chunk.length > 0);

    if (chunks.length === 0) {
        return [createSection("Document", normalized.trim() || "No readable text extracted.", 1, 1)];
    }

    return chunks.map(item =>
        createSection(
            item.index === 0 ? "Overview" : `Section ${item.index + 1}`,
            item.chunk,
            1,
            item.lineStart,
        ),
    );
}

function splitMarkdownSections(text: string): ReaderSection[] {
    const normalized = normalizeLineEndings(text);
    const lines = normalized.split("\n");
    const sections: ReaderSection[] = [];
    let currentTitle = "Overview";
    let currentLevel = 1;
    let currentLines: string[] = [];
    let currentStart = 1;

    const flush = () => {
        const content = currentLines.join("\n").trim();
        if (!content) return;
        sections.push(createSection(currentTitle, content, currentLevel, currentStart));
    };

    lines.forEach((line, index) => {
        const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
        if (!match) {
            currentLines.push(line);
            return;
        }

        flush();
        currentTitle = match[2] ?? "Section";
        currentLevel = match[1]?.length ?? 1;
        currentLines = [];
        currentStart = index + 1;
    });

    flush();
    return sections.length > 0 ? sections : splitPlainTextSections(normalized);
}

function buildStructuredSections(value: unknown, title = "Root", level = 1): ReaderSection[] {
    if (value === null || value === undefined) {
        return [createSection(title, String(value), level)];
    }

    if (typeof value !== "object") {
        return [createSection(title, String(value), level)];
    }

    if (Array.isArray(value)) {
        const rendered = value
            .map((item, index) =>
                typeof item === "object"
                    ? `${index + 1}. ${JSON.stringify(item, null, 2)}`
                    : `${index + 1}. ${item}`,
            )
            .join("\n\n");
        return [createSection(title, rendered || "[]", level)];
    }

    const record = value as Record<string, unknown>;
    const sections: ReaderSection[] = [];
    const summary = Object.entries(record)
        .filter(([, fieldValue]) => typeof fieldValue !== "object" || fieldValue === null)
        .map(([key, fieldValue]) => `${key}: ${String(fieldValue)}`);

    if (summary.length > 0) {
        sections.push(createSection(title, summary.join("\n"), level));
    }

    for (const [key, nested] of Object.entries(record)) {
        if (nested && typeof nested === "object") {
            const nestedSections = buildStructuredSections(nested, key, Math.min(level + 1, 6));
            sections.push(...nestedSections);
        }
    }

    return sections.length > 0 ? sections : [createSection(title, JSON.stringify(record, null, 2), level)];
}

function listZipEntries(bytes: Uint8Array): string[] {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 4; i++) {
        if (dv.getUint32(i, true) !== 0x06054b50) continue;
        const centralOffset = dv.getUint32(i + 16, true);
        const totalEntries = dv.getUint16(i + 10, true);
        const entries: string[] = [];
        let p = centralOffset;
        for (let n = 0; n < totalEntries; n++) {
            if (dv.getUint32(p, true) !== 0x02014b50) return entries;
            const nameLen = dv.getUint16(p + 28, true);
            const extraLen = dv.getUint16(p + 30, true);
            const commentLen = dv.getUint16(p + 32, true);
            const nameBytes = bytes.slice(p + 46, p + 46 + nameLen);
            entries.push(TEXT_DECODER.decode(nameBytes));
            p += 46 + nameLen + extraLen + commentLen;
        }
        return entries;
    }
    return [];
}

function readZipEntry(bytes: Uint8Array, entryName: string): Uint8Array | null {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 4; i++) {
        if (dv.getUint32(i, true) !== 0x06054b50) continue;
        const centralOffset = dv.getUint32(i + 16, true);
        const totalEntries = dv.getUint16(i + 10, true);
        let p = centralOffset;
        for (let n = 0; n < totalEntries; n++) {
            if (dv.getUint32(p, true) !== 0x02014b50) return null;
            const method = dv.getUint16(p + 10, true);
            const compSize = dv.getUint32(p + 20, true);
            const nameLen = dv.getUint16(p + 28, true);
            const extraLen = dv.getUint16(p + 30, true);
            const commentLen = dv.getUint16(p + 32, true);
            const localOffset = dv.getUint32(p + 42, true);
            const nameBytes = bytes.slice(p + 46, p + 46 + nameLen);
            const name = TEXT_DECODER.decode(nameBytes);
            if (name === entryName) {
                if (method !== 0) return null;
                if (dv.getUint32(localOffset, true) !== 0x04034b50) return null;
                const localNameLen = dv.getUint16(localOffset + 26, true);
                const localExtraLen = dv.getUint16(localOffset + 28, true);
                const dataStart = localOffset + 30 + localNameLen + localExtraLen;
                return bytes.slice(dataStart, dataStart + compSize);
            }
            p += 46 + nameLen + extraLen + commentLen;
        }
    }
    return null;
}

function parseMaybeManifest(obj: unknown): Record<string, unknown> | null {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const root = obj as Record<string, unknown>;
    if (
        typeof root.$schema === "string" &&
        root.$schema.includes("/manifest") &&
        root.state &&
        typeof root.state === "object" &&
        !Array.isArray(root.state)
    ) {
        return root.state as Record<string, unknown>;
    }
    if (
        typeof root.$schema === "string" &&
        root.$schema.includes("/wid") &&
        root.state &&
        typeof root.state === "object" &&
        !Array.isArray(root.state)
    ) {
        return root.state as Record<string, unknown>;
    }
    return root;
}

function inferSourceType(name: string): ReaderSourceType {
    const lower = basename(name).toLowerCase();
    if (lower === MANIFEST_BASENAME) return "manifest";
    if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
    if (lower.endsWith(".pdf")) return "pdf";
    if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
    if (lower.endsWith(".wid")) return "manifest";
    if (lower.endsWith(".waldiez")) return "archive";
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
    if (lower.endsWith(".json")) return "json";
    return "text";
}

function isStructuredSource(type: ReaderSourceType): boolean {
    return type === "manifest" || type === "yaml" || type === "json" || type === "archive";
}

function buildReaderDocument(input: {
    sourceName: string;
    sourcePath?: string;
    sourceUrl?: string;
    sourceType: ReaderSourceType;
    plainText: string;
    rawText: string;
    sections: ReaderSection[];
    metadata?: Record<string, unknown>;
    diagnostics?: ReaderDiagnostic[];
    mimeType?: string;
}): ReaderDocument {
    return {
        id: encodeId("doc"),
        title: input.sourceName,
        sourceName: input.sourceName,
        sourcePath: input.sourcePath,
        sourceUrl: input.sourceUrl,
        sourceType: input.sourceType,
        mimeType: input.mimeType,
        plainText: input.plainText,
        rawText: input.rawText,
        sections: input.sections,
        metadata: input.metadata ?? {},
        diagnostics: input.diagnostics ?? [],
        openedAt: new Date().toISOString(),
    };
}

function unescapePdfText(input: string): string {
    return input
        .replace(/\\([()\\])/g, "$1")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\t/g, "\t")
        .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

async function inflatePdfStream(bytes: Uint8Array): Promise<string | null> {
    if (typeof DecompressionStream === "undefined") return null;
    try {
        const view = new Uint8Array(bytes);
        const stream = new Blob([view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)])
            .stream()
            .pipeThrough(new DecompressionStream("deflate"));
        const arrayBuffer = await new Response(stream).arrayBuffer();
        return TEXT_DECODER.decode(new Uint8Array(arrayBuffer));
    } catch {
        return null;
    }
}

async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; diagnostics: ReaderDiagnostic[] }> {
    const diagnostics: ReaderDiagnostic[] = [];
    const raw = TEXT_DECODER.decode(bytes);
    const texts: string[] = [];

    const directMatches = raw.matchAll(/\((?:\\.|[^\\()])+\)\s*Tj/g);
    for (const match of directMatches) {
        const fragment = /\((.*)\)\s*Tj$/.exec(match[0] ?? "");
        if (fragment?.[1]) texts.push(unescapePdfText(fragment[1]));
    }

    const arrayMatches = raw.matchAll(/\[(.*?)\]\s*TJ/gs);
    for (const match of arrayMatches) {
        const segments = (match[1] ?? "").match(/\((?:\\.|[^\\()])+\)/g) ?? [];
        for (const segment of segments) {
            texts.push(unescapePdfText(segment.slice(1, -1)));
        }
    }

    if (texts.join(" ").trim().length > 80) {
        return { text: texts.join("\n"), diagnostics };
    }

    const streamMatches = raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g);
    for (const match of streamMatches) {
        const fragment = match[1];
        if (!fragment) continue;
        const inflated = await inflatePdfStream(encodePdfStreamBytes(fragment));
        if (!inflated) continue;
        const nestedTj = inflated.matchAll(/\((?:\\.|[^\\()])+\)\s*Tj/g);
        for (const nested of nestedTj) {
            const inner = /\((.*)\)\s*Tj$/.exec(nested[0] ?? "");
            if (inner?.[1]) texts.push(unescapePdfText(inner[1]));
        }
    }

    const text = texts.join("\n").replace(/\s+\n/g, "\n").trim();
    if (!text) {
        diagnostics.push({
            level: "warn",
            message:
                "PDF text extraction was limited for this file. Open text-based formats for more reliable reading.",
        });
    }
    return { text, diagnostics };
}

function encodePdfStreamBytes(streamContent: string): Uint8Array {
    return Uint8Array.from(streamContent.split("").map(ch => ch.charCodeAt(0) & 0xff));
}

function buildDocumentFromStructured(
    sourceName: string,
    sourceType: ReaderSourceType,
    rawText: string,
    parsed: Record<string, unknown>,
    options?: {
        sourcePath?: string;
        sourceUrl?: string;
        mimeType?: string;
        diagnostics?: ReaderDiagnostic[];
        metadata?: Record<string, unknown>;
    },
): ReaderDocument {
    const sections = buildStructuredSections(parsed, "Manifest");
    const plainText = sections.map(section => `${section.title}\n${section.content}`).join("\n\n");
    return buildReaderDocument({
        sourceName,
        sourcePath: options?.sourcePath,
        sourceUrl: options?.sourceUrl,
        sourceType,
        rawText,
        plainText,
        sections,
        diagnostics: options?.diagnostics,
        metadata: options?.metadata ?? parsed,
        mimeType: options?.mimeType,
    });
}

export function isReaderFileName(name: string): boolean {
    const lower = basename(name).toLowerCase();
    return (
        lower === MANIFEST_BASENAME ||
        lower.endsWith(".txt") ||
        lower.endsWith(".md") ||
        lower.endsWith(".markdown") ||
        lower.endsWith(".pdf") ||
        lower.endsWith(".html") ||
        lower.endsWith(".htm") ||
        lower.endsWith(".wid") ||
        lower.endsWith(".waldiez") ||
        lower.endsWith(".json") ||
        lower.endsWith(".yaml") ||
        lower.endsWith(".yml")
    );
}

export async function importReaderDocumentFromBytes(input: {
    name: string;
    bytes: Uint8Array;
    path?: string;
    sourceUrl?: string;
    mimeType?: string;
}): Promise<ReaderDocument> {
    const sourceType = inferSourceType(input.name);
    const diagnostics: ReaderDiagnostic[] = [];

    if (sourceType === "archive") {
        const manifestBytes = readZipEntry(input.bytes, "MANIFEST");
        const entryNames = listZipEntries(input.bytes);
        if (!manifestBytes) {
            diagnostics.push({ level: "error", message: "No MANIFEST entry found in the .waldiez archive." });
            return buildReaderDocument({
                sourceName: input.name,
                sourcePath: input.path,
                sourceUrl: input.sourceUrl,
                sourceType,
                rawText: "",
                plainText: "",
                sections: [createSection("Archive", "No MANIFEST entry found.", 1)],
                diagnostics,
                metadata: { entries: entryNames },
                mimeType: input.mimeType,
            });
        }
        const manifestText = TEXT_DECODER.decode(manifestBytes);
        const parsed = parseMaybeManifest(YAML.parse(manifestText) as unknown) ?? {};
        const document = buildDocumentFromStructured(input.name, sourceType, manifestText, parsed, {
            sourcePath: input.path,
            sourceUrl: input.sourceUrl,
            mimeType: input.mimeType,
            diagnostics,
            metadata: {
                archiveEntries: entryNames,
                manifestKeys: Object.keys(parsed),
            },
        });
        document.title = basename(input.name);
        return document;
    }

    if (sourceType === "pdf") {
        const { text, diagnostics: pdfDiagnostics } = await extractPdfText(input.bytes);
        const combinedDiagnostics = [...diagnostics, ...pdfDiagnostics];
        return buildReaderDocument({
            sourceName: basename(input.name),
            sourcePath: input.path,
            sourceUrl: input.sourceUrl,
            sourceType,
            rawText: text,
            plainText: text,
            sections: splitPlainTextSections(text),
            diagnostics: combinedDiagnostics,
            metadata: {
                format: "pdf",
                extractedCharacters: text.length,
            },
            mimeType: input.mimeType,
        });
    }

    const rawText = normalizeLineEndings(TEXT_DECODER.decode(input.bytes));
    if (isStructuredSource(sourceType)) {
        try {
            const parsed = parseMaybeManifest(YAML.parse(rawText) as unknown);
            if (parsed) {
                return buildDocumentFromStructured(basename(input.name), sourceType, rawText, parsed, {
                    sourcePath: input.path,
                    sourceUrl: input.sourceUrl,
                    mimeType: input.mimeType,
                });
            }
        } catch (error) {
            diagnostics.push({
                level: "warn",
                message: "Structured parse failed; showing raw text instead.",
            });
            reportDiagnostic({
                level: "warn",
                area: "reader",
                message: `Reader structured parse failed for ${basename(input.name)}.`,
                detail: error,
            });
        }
    }

    const sections =
        sourceType === "markdown" ? splitMarkdownSections(rawText) : splitPlainTextSections(rawText);
    return buildReaderDocument({
        sourceName: basename(input.name),
        sourcePath: input.path,
        sourceUrl: input.sourceUrl,
        sourceType,
        rawText,
        plainText: rawText,
        sections,
        diagnostics,
        metadata: {
            lineCount: rawText ? rawText.split("\n").length : 0,
            characterCount: rawText.length,
        },
        mimeType: input.mimeType,
    });
}

export async function importReaderDocumentFromFile(file: File): Promise<ReaderDocument> {
    return importReaderDocumentFromBytes({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        sourceUrl: URL.createObjectURL(file),
        mimeType: file.type || undefined,
    });
}
