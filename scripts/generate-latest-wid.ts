import { readFile, writeFile } from "node:fs/promises";

const DEFAULT_OUT = "static/cdn/repo/latest-auto.wid";
const DEFAULT_MODE = "storm";
const DEFAULT_FEED = "static/cdn/repo/latest-feed.sample.json";
const DEFAULT_MAX_AGE_HOURS = 72;
const DEFAULT_MIN_KEYWORD_HITS = 1;

const DEFAULT_NEWS_KEYWORDS = [
    "news",
    "breaking",
    "headline",
    "headlines",
    "update",
    "updates",
    "report",
    "reports",
    "live",
    "world",
    "politics",
    "economy",
    "market",
    "markets",
    "election",
    "war",
    "analysis",
];

const DEFAULT_BLOCKED_KEYWORDS = [
    "lyrics",
    "official audio",
    "music video",
    "remix",
    "slowed",
    "reverb",
    "amv",
    "nightcore",
    "lofi",
];

const MOODS = ["journey", "dock", "storm", "fest", "rock", "pop", "disco"] as const;
type Mood = (typeof MOODS)[number];

type LlmProvider = "openai" | "anthropic";

type Track = {
    type?: "youtube";
    ytType?: "video" | "playlist";
    videoId?: string;
    listId?: string;
    name?: string;
    artist?: string;
    chapter?: null;
};

type FeedTrack = Track & {
    mood?: Mood;
};

type ValidationConfig = {
    maxAgeHours?: number;
    minKeywordHits?: number;
    newsKeywords?: string[];
    blockedKeywords?: string[];
    trustedChannels?: string[];
    requireTrustedChannel?: boolean;
    llmProvider?: LlmProvider;
    llmModel?: string;
    llmMinScore?: number;
};

type Feed = {
    generatedAt?: string;
    mode?: string;
    descriptionName?: string;
    descriptionPurpose?: string;
    tags?: string[];
    lifecycleNote?: string;
    eq?: { bass?: number; mid?: number; treble?: number };
    fx?: { reverb?: boolean; echo?: boolean; fuzz?: boolean; vinyl?: boolean };
    moodCustomizations?: Record<string, { label?: string; accent?: string; bg?: string }>;
    modeDefaults?: Partial<Record<Mood, Track[]>>;
    tracks?: FeedTrack[];
    validation?: ValidationConfig;
};

type CliArgs = {
    feed: string;
    out: string;
    verifyNews: boolean;
    strictNews: boolean;
    dryRunReport: boolean;
    dryRun: boolean;
    maxAgeHours?: number;
    minKeywordHits?: number;
    keywords?: string[];
    blockedKeywords?: string[];
    trustedChannels?: string[];
    requireTrustedChannel?: boolean;
    llmProvider?: LlmProvider;
    llmModel?: string;
    llmMinScore?: number;
};

type YouTubeMeta = {
    videoId: string;
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    tags: string[];
};

type TrackValidationResult = {
    track: Track;
    mood: Mood;
    accepted: boolean;
    reason: string;
    keywordHits: number;
    ageHours: number | null;
    llmScore?: number;
};

function usage(): string {
    return [
        "Usage:",
        "  bun scripts/generate-latest-wid.ts [--feed <path-or-url>] [--out <path>] [validation options]",
        "",
        "Validation options:",
        "  --verify-news                 Validate YouTube IDs for recency + news relevance",
        "  --strict-news                 Fail if any track fails validation",
        "  --dry-run-report              Print per-track validation table",
        "  --dry-run                     Validate and report, but do not write output file",
        "  --max-age-hours <number>      Recency threshold (default 72)",
        "  --min-keyword-hits <number>   Minimum news keyword matches (default 1)",
        "  --keywords <csv>              Override news keywords",
        "  --blocked-keywords <csv>      Override blocked keywords",
        "  --trusted-channels <csv>      Optional allowlist channel names",
        "  --require-trusted-channel     Require channel to be in trusted list",
        "  --llm-provider <openai|anthropic>",
        "  --llm-model <model-name>",
        "  --llm-min-score <0-100>       Minimum semantic score from LLM",
        "",
        "Environment variables:",
        "  YOUTUBE_API_KEY               Required when --verify-news is enabled",
        "  OPENAI_API_KEY                Needed when --llm-provider openai",
        "  OPENAI_LLM_FALLBACK_MODEL     Optional OpenAI model for low-score retry (default: gpt-4.1 for gpt-4.1-mini)",
        "  ANTHROPIC_API_KEY             Needed when --llm-provider anthropic",
    ].join("\n");
}

function parseCsv(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    const out = value
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
    return out.length > 0 ? out : undefined;
}

function parseBoolishFlag(arg: string, argv: string[], i: number): { value: boolean; advance: number } {
    const maybe = argv[i + 1];
    if (!maybe || maybe.startsWith("--")) return { value: true, advance: 0 };
    if (maybe === "true" || maybe === "1") return { value: true, advance: 1 };
    if (maybe === "false" || maybe === "0") return { value: false, advance: 1 };
    return { value: true, advance: 0 };
}

function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = {
        feed: DEFAULT_FEED,
        out: DEFAULT_OUT,
        verifyNews: false,
        strictNews: false,
        dryRunReport: false,
        dryRun: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") {
            console.log(usage());
            process.exit(0);
        }
        if (arg === "--feed") {
            args.feed = argv[i + 1] ?? "";
            i++;
            continue;
        }
        if (arg === "--out") {
            args.out = argv[i + 1] ?? "";
            i++;
            continue;
        }
        if (arg === "--verify-news") {
            const { value, advance } = parseBoolishFlag(arg, argv, i);
            args.verifyNews = value;
            i += advance;
            continue;
        }
        if (arg === "--strict-news") {
            const { value, advance } = parseBoolishFlag(arg, argv, i);
            args.strictNews = value;
            i += advance;
            continue;
        }
        if (arg === "--dry-run-report") {
            const { value, advance } = parseBoolishFlag(arg, argv, i);
            args.dryRunReport = value;
            i += advance;
            continue;
        }
        if (arg === "--dry-run") {
            const { value, advance } = parseBoolishFlag(arg, argv, i);
            args.dryRun = value;
            i += advance;
            continue;
        }
        if (arg === "--require-trusted-channel") {
            const { value, advance } = parseBoolishFlag(arg, argv, i);
            args.requireTrustedChannel = value;
            i += advance;
            continue;
        }
        if (arg === "--max-age-hours") {
            const raw = argv[i + 1] ?? "";
            args.maxAgeHours = Number(raw);
            i++;
            continue;
        }
        if (arg === "--min-keyword-hits") {
            const raw = argv[i + 1] ?? "";
            args.minKeywordHits = Number(raw);
            i++;
            continue;
        }
        if (arg === "--keywords") {
            args.keywords = parseCsv(argv[i + 1]);
            i++;
            continue;
        }
        if (arg === "--blocked-keywords") {
            args.blockedKeywords = parseCsv(argv[i + 1]);
            i++;
            continue;
        }
        if (arg === "--trusted-channels") {
            args.trustedChannels = parseCsv(argv[i + 1]);
            i++;
            continue;
        }
        if (arg === "--llm-provider") {
            const provider = (argv[i + 1] ?? "") as LlmProvider;
            if (provider !== "openai" && provider !== "anthropic") {
                throw new Error(`Unsupported --llm-provider value: ${provider}`);
            }
            args.llmProvider = provider;
            i++;
            continue;
        }
        if (arg === "--llm-model") {
            args.llmModel = argv[i + 1] ?? "";
            i++;
            continue;
        }
        if (arg === "--llm-min-score") {
            const raw = argv[i + 1] ?? "";
            args.llmMinScore = Number(raw);
            i++;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    if (!args.feed) throw new Error("--feed requires a value");
    if (!args.out) throw new Error("--out requires a value");
    if (args.maxAgeHours !== undefined && (!Number.isFinite(args.maxAgeHours) || args.maxAgeHours < 1)) {
        throw new Error("--max-age-hours must be a positive number");
    }
    if (
        args.minKeywordHits !== undefined &&
        (!Number.isFinite(args.minKeywordHits) || args.minKeywordHits < 0)
    ) {
        throw new Error("--min-keyword-hits must be zero or a positive number");
    }
    if (args.llmMinScore !== undefined && (!Number.isFinite(args.llmMinScore) || args.llmMinScore < 0)) {
        throw new Error("--llm-min-score must be zero or a positive number");
    }

    return args;
}

async function readFeed(feedPathOrUrl: string): Promise<Feed> {
    const isUrl = /^https?:\/\//i.test(feedPathOrUrl);
    if (isUrl) {
        const response = await fetch(feedPathOrUrl, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(
                `Failed to fetch feed (${response.status} ${response.statusText}): ${feedPathOrUrl}`,
            );
        }
        return (await response.json()) as Feed;
    }

    const text = await readFile(feedPathOrUrl, "utf8");
    return JSON.parse(text) as Feed;
}

function asMood(value: string | undefined): Mood | null {
    if (!value) return null;
    return MOODS.includes(value as Mood) ? (value as Mood) : null;
}

function sanitizeTrack(track: Track): Track | null {
    const ytType = track.ytType ?? "video";
    if (ytType === "video") {
        if (!track.videoId || typeof track.videoId !== "string") return null;
        return {
            type: "youtube",
            ytType: "video",
            videoId: track.videoId,
            name: track.name ?? `YouTube · ${track.videoId}`,
            artist: track.artist ?? "YouTube",
            chapter: null,
        };
    }

    if (!track.listId || typeof track.listId !== "string") return null;
    return {
        type: "youtube",
        ytType: "playlist",
        listId: track.listId,
        name: track.name ?? `YouTube Playlist · ${track.listId}`,
        artist: track.artist ?? "YouTube",
        chapter: null,
    };
}

function normalizeModeDefaults(feed: Feed): Partial<Record<Mood, Track[]>> {
    if (feed.modeDefaults && typeof feed.modeDefaults === "object") {
        const out: Partial<Record<Mood, Track[]>> = {};
        for (const mood of MOODS) {
            const tracks = feed.modeDefaults[mood] ?? [];
            const clean = tracks.map(sanitizeTrack).filter((t): t is Track => t !== null);
            if (clean.length > 0) out[mood] = clean;
        }
        if (Object.keys(out).length > 0) return out;
    }

    const out: Partial<Record<Mood, Track[]>> = {};
    const fallbackMood = asMood(feed.mode) ?? DEFAULT_MODE;
    for (const track of feed.tracks ?? []) {
        const mood = asMood(track.mood) ?? (fallbackMood as Mood);
        const clean = sanitizeTrack(track);
        if (!clean) continue;
        out[mood] = [...(out[mood] ?? []), clean];
    }
    return out;
}

function flattenModeDefaults(
    modeDefaults: Partial<Record<Mood, Track[]>>,
): Array<{ mood: Mood; track: Track }> {
    const out: Array<{ mood: Mood; track: Track }> = [];
    for (const mood of MOODS) {
        for (const track of modeDefaults[mood] ?? []) out.push({ mood, track });
    }
    return out;
}

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

async function fetchYouTubeVideoMeta(videoIds: string[], apiKey: string): Promise<Map<string, YouTubeMeta>> {
    const meta = new Map<string, YouTubeMeta>();
    for (const ids of chunk(videoIds, 50)) {
        const url = new URL("https://www.googleapis.com/youtube/v3/videos");
        url.searchParams.set("part", "snippet");
        url.searchParams.set("id", ids.join(","));
        url.searchParams.set("key", apiKey);
        url.searchParams.set("maxResults", "50");

        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`YouTube API error (${response.status}): ${body.slice(0, 300)}`);
        }

        const data = (await response.json()) as {
            items?: Array<{
                id?: string;
                snippet?: {
                    title?: string;
                    description?: string;
                    channelTitle?: string;
                    publishedAt?: string;
                    tags?: string[];
                };
            }>;
        };

        for (const item of data.items ?? []) {
            const id = item.id;
            const snippet = item.snippet;
            if (!id || !snippet?.title || !snippet?.publishedAt) continue;
            meta.set(id, {
                videoId: id,
                title: snippet.title,
                description: snippet.description ?? "",
                channelTitle: snippet.channelTitle ?? "",
                publishedAt: snippet.publishedAt,
                tags: snippet.tags ?? [],
            });
        }
    }
    return meta;
}

function countKeywordHits(text: string, keywords: string[]): number {
    const lower = text.toLowerCase();
    let hits = 0;
    for (const keyword of keywords) {
        if (!keyword) continue;
        if (lower.includes(keyword.toLowerCase())) hits++;
    }
    return hits;
}

function isTrustedChannel(channelTitle: string, trustedChannels: string[]): boolean {
    if (trustedChannels.length === 0) return true;
    const lower = channelTitle.toLowerCase();
    return trustedChannels.some(channel => lower.includes(channel.toLowerCase()));
}

async function scoreWithOpenAIOnce(meta: YouTubeMeta, model: string, retry = false): Promise<number> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for --llm-provider openai");

    const prompt = [
        'Return only JSON: {"score": number, "reason": string}.',
        "Score 0-100 for whether this video is current hard-news content.",
        "Rubric:",
        "90-100: breaking/current hard news with clear civic/global significance.",
        "70-89: timely hard-news analysis/update on current events.",
        "40-69: mixed/unclear relevance to current hard news.",
        "0-39: non-news content (music, entertainment, gaming, memes, clickbait, unrelated).",
        "Do not use 0 unless it is clearly non-news.",
        retry
            ? "This is a retry after an anomalous low score; re-evaluate carefully from metadata only."
            : "",
    ]
        .filter(Boolean)
        .join("\n");
    const input = [
        `title: ${meta.title}`,
        `channel: ${meta.channelTitle}`,
        `publishedAt: ${meta.publishedAt}`,
        `description: ${meta.description.slice(0, 1500)}`,
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            input: [
                { role: "system", content: [{ type: "input_text", text: prompt }] },
                { role: "user", content: [{ type: "input_text", text: input }] },
            ],
            text: {
                format: {
                    type: "json_schema",
                    name: "news_score",
                    schema: {
                        type: "object",
                        properties: {
                            score: { type: "number" },
                            reason: { type: "string" },
                        },
                        required: ["score", "reason"],
                        additionalProperties: false,
                    },
                    strict: true,
                },
            },
            max_output_tokens: 120,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const scoreFromParsed = extractOpenAIParsedScore(data);
    if (scoreFromParsed !== null) return scoreFromParsed;

    const text = extractOpenAIText(data);
    const score = extractScoreFromText(text);
    if (score === null) {
        throw new Error(`OpenAI response did not include a parseable score. Raw: ${text.slice(0, 260)}`);
    }
    return score;
}

async function scoreWithOpenAI(meta: YouTubeMeta, model: string): Promise<number> {
    const first = await scoreWithOpenAIOnce(meta, model, false);
    if (first >= 30) return first;

    // Retry once to reduce strict-mode false negatives from anomalous low scores (< 30).
    const second = await scoreWithOpenAIOnce(meta, model, true);
    return Math.max(first, second);
}

async function scoreWithAnthropic(meta: YouTubeMeta, model: string): Promise<number> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for --llm-provider anthropic");

    const prompt = [
        'Return only JSON: {"score": number, "reason": string}.',
        "Score 0-100 on whether this video is current hard-news content.",
        `title: ${meta.title}`,
        `channel: ${meta.channelTitle}`,
        `publishedAt: ${meta.publishedAt}`,
        `description: ${meta.description.slice(0, 1500)}`,
    ].join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model,
            max_tokens: 120,
            messages: [{ role: "user", content: prompt }],
        }),
    });

    if (!response.ok) {
        throw new Error(`Anthropic API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
    };
    const text = (data.content ?? [])
        .filter(part => part.type === "text" && typeof part.text === "string")
        .map(part => part.text)
        .join("\n");

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
        const parsed = JSON.parse(match[0]) as { score?: number };
        if (Number.isFinite(parsed.score)) return Number(parsed.score);
    }

    const score = extractScoreFromText(text);
    if (score === null) throw new Error(`Anthropic response missing parseable score: ${text.slice(0, 260)}`);
    return score;
}

function extractScoreFromText(text: string): number | null {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]) as { score?: number };
            if (Number.isFinite(parsed.score)) return clampScore(Number(parsed.score));
        } catch {
            // fall through to regex extraction
        }
    }

    const labeled =
        text.match(/"score"\s*:\s*(-?\d+(?:\.\d+)?)/i) ?? text.match(/\bscore\b\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);
    if (labeled && labeled[1]) return clampScore(Number(labeled[1]));
    return null;
}

function clampScore(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
}

function extractOpenAIParsedScore(data: Record<string, unknown>): number | null {
    const output = data.output;
    if (!Array.isArray(output)) return null;

    for (const item of output) {
        if (!item || typeof item !== "object") continue;
        const content = (item as { content?: unknown }).content;
        if (!Array.isArray(content)) continue;
        for (const part of content) {
            if (!part || typeof part !== "object") continue;
            const parsed = (part as { parsed?: unknown }).parsed;
            if (!parsed || typeof parsed !== "object") continue;
            const score = (parsed as { score?: unknown }).score;
            if (typeof score === "number" && Number.isFinite(score)) return clampScore(score);
        }
    }
    return null;
}

function extractOpenAIText(data: Record<string, unknown>): string {
    const chunks: string[] = [];

    const outputText = data.output_text;
    if (typeof outputText === "string" && outputText.trim()) chunks.push(outputText);

    const output = data.output;
    if (Array.isArray(output)) {
        for (const item of output) {
            if (!item || typeof item !== "object") continue;
            const content = (item as { content?: unknown }).content;
            if (!Array.isArray(content)) continue;
            for (const part of content) {
                if (!part || typeof part !== "object") continue;
                const text = (part as { text?: unknown }).text;
                if (typeof text === "string" && text.trim()) chunks.push(text);
            }
        }
    }

    if (chunks.length > 0) return chunks.join("\n");
    return JSON.stringify(data);
}

async function maybeScoreSemantics(
    meta: YouTubeMeta,
    cfg: ResolvedValidationConfig,
): Promise<number | undefined> {
    if (!cfg.llmProvider) return undefined;
    if (cfg.llmProvider === "openai") {
        const primaryScore = await scoreWithOpenAI(meta, cfg.llmModel);
        if (primaryScore >= cfg.llmMinScore) return primaryScore;

        const fallbackModel = resolveOpenAIFallbackModel(cfg.llmModel);
        if (!fallbackModel || fallbackModel === cfg.llmModel) return primaryScore;

        try {
            const fallbackScore = await scoreWithOpenAI(meta, fallbackModel);
            return Math.max(primaryScore, fallbackScore);
        } catch {
            // Preserve primary score if fallback call fails (network/rate limits/model access).
            return primaryScore;
        }
    }
    return scoreWithAnthropic(meta, cfg.llmModel);
}

function resolveOpenAIFallbackModel(primaryModel: string): string | undefined {
    const envModel = process.env.OPENAI_LLM_FALLBACK_MODEL?.trim();
    if (envModel) {
        if (envModel.toLowerCase() === "off") return undefined;
        return envModel;
    }

    // gpt-4.1-mini can be overly conservative for this classifier; use one stronger retry model.
    if (primaryModel === "gpt-4.1-mini") return "gpt-4.1";
    return undefined;
}

type ResolvedValidationConfig = {
    enabled: boolean;
    strict: boolean;
    maxAgeHours: number;
    minKeywordHits: number;
    newsKeywords: string[];
    blockedKeywords: string[];
    trustedChannels: string[];
    requireTrustedChannel: boolean;
    llmProvider?: LlmProvider;
    llmModel: string;
    llmMinScore: number;
};

function resolveValidationConfig(feed: Feed, cli: CliArgs): ResolvedValidationConfig {
    const fromFeed = feed.validation ?? {};
    const llmProvider = cli.llmProvider ?? fromFeed.llmProvider;
    const llmModel =
        cli.llmModel ??
        fromFeed.llmModel ??
        (llmProvider === "anthropic" ? "claude-3-5-haiku-latest" : "gpt-4.1-mini");

    return {
        enabled: cli.verifyNews,
        strict: cli.strictNews,
        maxAgeHours: cli.maxAgeHours ?? fromFeed.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS,
        minKeywordHits: cli.minKeywordHits ?? fromFeed.minKeywordHits ?? DEFAULT_MIN_KEYWORD_HITS,
        newsKeywords: cli.keywords ?? fromFeed.newsKeywords ?? DEFAULT_NEWS_KEYWORDS,
        blockedKeywords: cli.blockedKeywords ?? fromFeed.blockedKeywords ?? DEFAULT_BLOCKED_KEYWORDS,
        trustedChannels: cli.trustedChannels ?? fromFeed.trustedChannels ?? [],
        requireTrustedChannel: cli.requireTrustedChannel ?? fromFeed.requireTrustedChannel ?? false,
        llmProvider,
        llmModel,
        llmMinScore: cli.llmMinScore ?? fromFeed.llmMinScore ?? 70,
    };
}

async function validateLatestNewsTracks(
    modeDefaults: Partial<Record<Mood, Track[]>>,
    cfg: ResolvedValidationConfig,
): Promise<{
    filtered: Partial<Record<Mood, Track[]>>;
    summary: string[];
    results: TrackValidationResult[];
    acceptedCount: number;
    rejectedCount: number;
}> {
    if (!cfg.enabled) {
        return {
            filtered: modeDefaults,
            summary: ["news validation disabled"],
            results: [],
            acceptedCount: flattenModeDefaults(modeDefaults).length,
            rejectedCount: 0,
        };
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        throw new Error("YOUTUBE_API_KEY is required when --verify-news is enabled");
    }

    const flattened = flattenModeDefaults(modeDefaults);
    const videoTracks = flattened.filter(item => item.track.ytType !== "playlist" && !!item.track.videoId);
    const playlistTracks = flattened.filter(item => item.track.ytType === "playlist");

    const uniqueVideoIds = [...new Set(videoTracks.map(item => item.track.videoId as string))];
    const metaByVideoId = await fetchYouTubeVideoMeta(uniqueVideoIds, apiKey);

    const results: TrackValidationResult[] = [];
    const cutoff = Date.now() - cfg.maxAgeHours * 3600 * 1000;

    for (const item of videoTracks) {
        const track = item.track;
        const videoId = track.videoId as string;
        const meta = metaByVideoId.get(videoId);

        if (!meta) {
            results.push({
                track,
                mood: item.mood,
                accepted: false,
                reason: "missing metadata from YouTube API",
                keywordHits: 0,
                ageHours: null,
            });
            continue;
        }

        const publishedMs = new Date(meta.publishedAt).getTime();
        const ageHours = Number.isFinite(publishedMs) ? (Date.now() - publishedMs) / 3600000 : null;
        const text = `${meta.title}\n${meta.description}\n${meta.channelTitle}\n${meta.tags.join(" ")}`;
        const keywordHits = countKeywordHits(text, cfg.newsKeywords);
        const blockedHits = countKeywordHits(text, cfg.blockedKeywords);
        const trusted = isTrustedChannel(meta.channelTitle, cfg.trustedChannels);

        const recencyPass = Number.isFinite(publishedMs) && publishedMs >= cutoff;
        const keywordPass = keywordHits >= cfg.minKeywordHits;
        const blockedPass = blockedHits === 0;
        const trustedPass = !cfg.requireTrustedChannel || trusted;

        let llmScore: number | undefined;
        let llmPass = true;
        if (cfg.llmProvider) {
            llmScore = await maybeScoreSemantics(meta, cfg);
            llmPass = (llmScore ?? 0) >= cfg.llmMinScore;
        }

        // When the LLM gives a confident news score, treat blocked terms as advisory:
        // keyword-based blocked terms check can match innocuous words in a news description
        // (e.g. "live", "reverb"), and the LLM is the stronger signal for actual content type.
        const llmConfident = cfg.llmProvider !== undefined && (llmScore ?? 0) >= cfg.llmMinScore;
        const accepted =
            recencyPass && keywordPass && (blockedPass || llmConfident) && trustedPass && llmPass;

        if (!track.name || track.name.startsWith("YouTube · ")) {
            track.name = meta.title;
        }

        const reasonParts = [
            recencyPass ? "recent" : `older than ${cfg.maxAgeHours}h`,
            keywordPass ? `keywords:${keywordHits}` : `keyword hits ${keywordHits} < ${cfg.minKeywordHits}`,
            blockedPass
                ? "no blocked terms"
                : llmConfident
                  ? "blocked terms (llm override)"
                  : "contains blocked terms",
            trustedPass ? "trusted-channel ok" : "channel not in trusted list",
        ];
        if (cfg.llmProvider) {
            reasonParts.push(llmPass ? `llm:${llmScore}` : `llm score ${llmScore} < ${cfg.llmMinScore}`);
        }

        results.push({
            track,
            mood: item.mood,
            accepted,
            reason: reasonParts.join(", "),
            keywordHits,
            ageHours,
            llmScore,
        });
    }

    for (const item of playlistTracks) {
        results.push({
            track: item.track,
            mood: item.mood,
            accepted: false,
            reason: "playlist tracks are not validated for recency/news",
            keywordHits: 0,
            ageHours: null,
        });
    }

    const accepted = results.filter(r => r.accepted);
    const rejected = results.filter(r => !r.accepted);

    const filtered: Partial<Record<Mood, Track[]>> = {};
    for (const row of accepted) {
        filtered[row.mood] = [...(filtered[row.mood] ?? []), row.track];
    }

    if (Object.keys(filtered).length === 0) {
        const details = rejected
            .map(r => `${r.mood}:${r.track.videoId ?? r.track.listId} -> ${r.reason}`)
            .join("; ");
        throw new Error(`all tracks failed news validation: ${details}`);
    }

    const summary = [
        `validation enabled: accepted ${accepted.length}/${results.length} tracks`,
        `maxAgeHours=${cfg.maxAgeHours} minKeywordHits=${cfg.minKeywordHits}`,
    ];

    if (rejected.length > 0) {
        summary.push(
            `rejected: ${rejected.map(r => `${r.track.videoId ?? r.track.listId} (${r.reason})`).join(" | ")}`,
        );
    }

    return {
        filtered,
        summary,
        results,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
    };
}

function toStamp(date: Date): string {
    const p = (n: number, len = 2) => n.toString().padStart(len, "0");
    const ms = p(date.getUTCMilliseconds(), 3);
    return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}.${ms}Z`;
}

function yamlQuote(value: string): string {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function renderTrack(track: Track): string[] {
    const lines = ['      - type: "youtube"', `        ytType: ${yamlQuote(track.ytType ?? "video")}`];
    if (track.ytType === "playlist") {
        lines.push(`        listId: ${yamlQuote(track.listId ?? "")}`);
    } else {
        lines.push(`        videoId: ${yamlQuote(track.videoId ?? "")}`);
    }
    lines.push(`        name: ${yamlQuote(track.name ?? "")}`);
    lines.push(`        artist: ${yamlQuote(track.artist ?? "YouTube")}`);
    lines.push("        chapter: null");
    return lines;
}

function pad(value: string, len: number): string {
    if (value.length >= len) return value;
    return `${value}${" ".repeat(len - value.length)}`;
}

function fmtAgeHours(ageHours: number | null): string {
    if (ageHours === null || !Number.isFinite(ageHours)) return "-";
    return ageHours.toFixed(1);
}

function printValidationReport(results: TrackValidationResult[]): void {
    if (results.length === 0) {
        console.log("Validation report: no rows (enable --verify-news for per-track trust checks)");
        return;
    }
    const headers = ["status", "mood", "id", "age(h)", "kw", "llm", "reason"];
    const widths = [8, 8, 14, 8, 4, 6, 0];
    const line = `${pad(headers[0], widths[0])} ${pad(headers[1], widths[1])} ${pad(headers[2], widths[2])} ${pad(headers[3], widths[3])} ${pad(headers[4], widths[4])} ${pad(headers[5], widths[5])} ${headers[6]}`;
    console.log(line);
    console.log(
        `${"-".repeat(widths[0])} ${"-".repeat(widths[1])} ${"-".repeat(widths[2])} ${"-".repeat(widths[3])} ${"-".repeat(widths[4])} ${"-".repeat(widths[5])} ${"-".repeat(36)}`,
    );

    for (const row of results) {
        const id = row.track.videoId ?? row.track.listId ?? "-";
        const status = row.accepted ? "ok" : "reject";
        const llm = row.llmScore === undefined ? "-" : String(Math.round(row.llmScore));
        const out = `${pad(status, widths[0])} ${pad(row.mood, widths[1])} ${pad(id, widths[2])} ${pad(fmtAgeHours(row.ageHours), widths[3])} ${pad(String(row.keywordHits), widths[4])} ${pad(llm, widths[5])} ${row.reason}`;
        console.log(out);
    }
}

async function buildWid(feed: Feed, generated: Date, cli: CliArgs): Promise<string> {
    const generatedIso = generated.toISOString();
    const stamp = toStamp(generated);

    const rawModeDefaults = normalizeModeDefaults(feed);
    if (Object.keys(rawModeDefaults).length === 0) {
        throw new Error("Feed produced no valid tracks. Provide at least one YouTube track.");
    }

    const validationCfg = resolveValidationConfig(feed, cli);
    const validation = await validateLatestNewsTracks(rawModeDefaults, validationCfg);
    if (cli.dryRunReport || cli.dryRun) {
        printValidationReport(validation.results);
        console.log(
            `Validation summary: accepted=${validation.acceptedCount} rejected=${validation.rejectedCount}`,
        );
    }
    if (validationCfg.strict && validation.rejectedCount > 0) {
        const rejected = validation.results.filter(r => !r.accepted);
        const details = rejected
            .map(r => `${r.mood}:${r.track.videoId ?? r.track.listId} -> ${r.reason}`)
            .join("; ");
        throw new Error(`strict news validation failed: ${details}`);
    }
    const modeDefaults = validation.filtered;

    const mode = asMood(feed.mode) ?? DEFAULT_MODE;
    const descriptionName = feed.descriptionName ?? "Waldiez Repo - Latest (Auto-Generated)";
    const descriptionPurpose =
        feed.descriptionPurpose ?? "Auto-generated latest preset (news + trends pipeline output).";
    const tags =
        feed.tags && feed.tags.length > 0
            ? feed.tags
            : ["waldiez", "player", "latest", "auto-generated", "cron", "news"];

    const eq = {
        bass: feed.eq?.bass ?? 0,
        mid: feed.eq?.mid ?? 1,
        treble: feed.eq?.treble ?? 1,
    };

    const fx = {
        reverb: feed.fx?.reverb ?? false,
        echo: feed.fx?.echo ?? false,
        fuzz: feed.fx?.fuzz ?? false,
        vinyl: feed.fx?.vinyl ?? false,
    };

    const lines: string[] = [];
    lines.push('$schema: "https://xperiens.waldiez.io/schema/v1/manifest"', "");
    lines.push("identity:");
    lines.push(`  wid: ${yamlQuote(`wdz://waldiez/player/repo/latest-auto/${stamp}-l4t35t`)}`);
    lines.push('  type: "state"');
    lines.push(`  created: ${yamlQuote(generatedIso)}`, "");

    lines.push("description:");
    lines.push(`  name: ${yamlQuote(descriptionName)}`);
    lines.push(`  purpose: ${yamlQuote(descriptionPurpose)}`);
    lines.push("  tags:");
    for (const tag of tags) lines.push(`    - ${yamlQuote(tag)}`);
    lines.push("");

    lines.push("interface:");
    lines.push("  capabilities:");
    lines.push('    - "waldiez.player.state.preferences.v1"');
    lines.push("  capability_ids:");
    lines.push(
        `    "waldiez.player.state.preferences.v1": ${yamlQuote(
            `wdz://waldiez/player/capability/${stamp}-l4t35t`,
        )}`,
    );
    lines.push("  operations:");
    lines.push('    - name: "import-preferences"');
    lines.push('      description: "Apply preset to local player settings."');
    lines.push("      params: {}");
    lines.push("      returns:");
    lines.push('        type: "boolean"');
    lines.push("  state_schema:");
    lines.push('    mode: { type: "string", mutable: true }');
    lines.push('    modeDefaults: { type: "object", mutable: true }');
    lines.push('    moodCustomizations: { type: "object", mutable: true }', "");

    lines.push("state:");
    lines.push("  v: 2");
    lines.push(`  mode: ${yamlQuote(mode)}`);
    lines.push("  volume: 0.75");
    lines.push("  muted: false");
    lines.push("  loop: false");
    lines.push("  shuffle: true");
    lines.push("  eq:");
    lines.push(`    bass: ${eq.bass}`);
    lines.push(`    mid: ${eq.mid}`);
    lines.push(`    treble: ${eq.treble}`);
    lines.push("  fx:");
    lines.push(`    reverb: ${fx.reverb}`);
    lines.push(`    echo: ${fx.echo}`);
    lines.push(`    fuzz: ${fx.fuzz}`);
    lines.push(`    vinyl: ${fx.vinyl}`);
    lines.push("  modes: {}");
    lines.push("  modeDefaults:");

    for (const mood of MOODS) {
        const tracks = modeDefaults[mood] ?? [];
        if (tracks.length === 0) continue;
        lines.push(`    ${mood}:`);
        for (const track of tracks) lines.push(...renderTrack(track));
    }

    lines.push("  moodCustomizations:");
    const moodCustomizations = feed.moodCustomizations ?? {};
    if (Object.keys(moodCustomizations).length === 0) {
        lines.push("    {}");
    } else {
        for (const mood of MOODS) {
            const custom = moodCustomizations[mood];
            if (!custom) continue;
            lines.push(`    ${mood}:`);
            if (custom.label) lines.push(`      label: ${yamlQuote(custom.label)}`);
            if (custom.accent) lines.push(`      accent: ${yamlQuote(custom.accent)}`);
            if (custom.bg) lines.push(`      bg: ${yamlQuote(custom.bg)}`);
        }
    }
    lines.push("  syncDefaultsFromLatest: true", "");

    lines.push("execution:");
    lines.push('  runtime: "wdz://runtimes/browser"');
    lines.push('  protocol: "wdz://protocols/local-storage-v1"', "");

    lines.push("lifecycle:");
    lines.push(`  exported_at: ${yamlQuote(generatedIso)}`);
    lines.push(
        `  note: ${yamlQuote(feed.lifecycleNote ?? "Generated by scripts/generate-latest-wid.ts from feed JSON.")}`,
    );
    lines.push(`  source_generated_at: ${yamlQuote(feed.generatedAt ?? generatedIso)}`);
    lines.push(`  validation: ${yamlQuote(validation.summary.join("; "))}`);

    return `${lines.join("\n")}\n`;
}

async function main() {
    const cli = parseArgs(process.argv.slice(2));
    const feedData = await readFeed(cli.feed);
    const generated = new Date();
    if (Number.isNaN(generated.getTime())) throw new Error("Invalid system date");

    const content = await buildWid(feedData, generated, cli);
    if (cli.dryRun) {
        console.log(`Dry run complete for feed ${cli.feed} (no file written)`);
        return;
    }

    await writeFile(cli.out, content, "utf8");
    console.log(`Generated ${cli.out} from ${cli.feed}`);
}

main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`generate-latest-wid failed: ${message}`);
    process.exit(1);
});
