import { readFile, readdir, writeFile } from "node:fs/promises";

const DEFAULT_OUT = "static/cdn/repo/latest-feed.generated.json";
const DEFAULT_QUERY = "latest world news live";
const DEFAULT_MAX_RESULTS = 12;
const DEFAULT_LOOKBACK_HOURS = 24;
const DEFAULT_REGION = "US";
const DEFAULT_SEED = "static/cdn/repo/latest-feed.sample.json";
const DEFAULT_BLOCKED_TERMS =
    "sports,highlights,points table,scorecard,cricket,football,nba,nfl,ipl,shorts,clip";

// News tracks go to "storm" (Breaking) only; all other moods keep their
// own hardcoded/curated defaults.
const MOOD_ORDER = ["storm"] as const;

type Mood = "journey" | "dock" | "storm" | "fest" | "rock" | "pop" | "disco";

type SeedFeed = {
    mode?: Mood;
    descriptionName?: string;
    descriptionPurpose?: string;
    tags?: string[];
    lifecycleNote?: string;
    eq?: { bass?: number; mid?: number; treble?: number };
    fx?: { reverb?: boolean; echo?: boolean; fuzz?: boolean; vinyl?: boolean };
    moodCustomizations?: Record<string, { label?: string; accent?: string; bg?: string }>;
    validation?: Record<string, unknown>;
};

type CliArgs = {
    out: string;
    query: string;
    maxResults: number;
    lookbackHours: number;
    region: string;
    language?: string;
    channelIds: string[];
    minDurationSeconds: number;
    blockedTerms: string[];
    seed: string;
};

type SearchItem = {
    id?: { videoId?: string };
    snippet?: { liveBroadcastContent?: string };
};

type VideoSnippet = {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
};

type VideoItem = {
    id?: string;
    snippet?: VideoSnippet & { channelId?: string };
    contentDetails?: { duration?: string };
};

function usage(): string {
    return [
        "Usage:",
        "  bun scripts/build-latest-news-feed.ts [--out <path>] [--query <text>] [--max-results <n>] [--lookback-hours <n>]",
        "",
        "Options:",
        "  --out <path>                Output feed json (default static/cdn/repo/latest-feed.generated.json)",
        "  --query <text>              YouTube search query (default: latest world news live)",
        "  --max-results <n>           Number of videos to keep (default 12)",
        "  --lookback-hours <n>        publishedAfter window in hours (default 24)",
        "  --region <code>             regionCode (default US)",
        "  --language <code>           relevanceLanguage (optional)",
        "  --channel-ids <csv>         Restrict search to these channel IDs",
        "  --min-duration-seconds <n>  Reject short clips (default 180)",
        "  --blocked-terms <csv>       Reject titles/channels containing these terms",
        "  --seed <path>               Seed feed to inherit metadata/validation defaults",
        "",
        "Environment:",
        "  YOUTUBE_API_KEY             required",
        "  LATEST_WID_YT_QUERY         optional fallback for --query",
        "  LATEST_WID_YT_CHANNEL_IDS   optional fallback CSV for --channel-ids",
        "  LATEST_WID_MIN_DURATION_SECONDS optional fallback for --min-duration-seconds",
        "  LATEST_WID_BLOCKED_TERMS    optional fallback CSV for --blocked-terms",
    ].join("\n");
}

function parseCsv(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);
}

function envNonEmpty(name: string): string | undefined {
    const value = process.env[name];
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function parseNumberEnv(name: string, fallback: number): number {
    const raw = envNonEmpty(name);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = {
        out: DEFAULT_OUT,
        query: envNonEmpty("LATEST_WID_YT_QUERY") ?? DEFAULT_QUERY,
        maxResults: DEFAULT_MAX_RESULTS,
        lookbackHours: DEFAULT_LOOKBACK_HOURS,
        region: DEFAULT_REGION,
        language: undefined,
        channelIds: parseCsv(envNonEmpty("LATEST_WID_YT_CHANNEL_IDS")),
        minDurationSeconds: parseNumberEnv("LATEST_WID_MIN_DURATION_SECONDS", 180),
        blockedTerms: parseCsv(envNonEmpty("LATEST_WID_BLOCKED_TERMS") ?? DEFAULT_BLOCKED_TERMS),
        seed: DEFAULT_SEED,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") {
            console.log(usage());
            process.exit(0);
        }
        if (arg === "--out") {
            args.out = argv[i + 1] ?? "";
            i++;
            continue;
        }
        if (arg === "--query") {
            args.query = argv[i + 1] ?? "";
            i++;
            continue;
        }
        if (arg === "--max-results") {
            args.maxResults = Number(argv[i + 1] ?? "0");
            i++;
            continue;
        }
        if (arg === "--lookback-hours") {
            args.lookbackHours = Number(argv[i + 1] ?? "0");
            i++;
            continue;
        }
        if (arg === "--region") {
            args.region = (argv[i + 1] ?? "").toUpperCase();
            i++;
            continue;
        }
        if (arg === "--language") {
            args.language = argv[i + 1] ?? "";
            i++;
            continue;
        }
        if (arg === "--channel-ids") {
            args.channelIds = parseCsv(argv[i + 1]);
            i++;
            continue;
        }
        if (arg === "--min-duration-seconds") {
            args.minDurationSeconds = Number(argv[i + 1] ?? "0");
            i++;
            continue;
        }
        if (arg === "--blocked-terms") {
            args.blockedTerms = parseCsv(argv[i + 1]);
            i++;
            continue;
        }
        if (arg === "--seed") {
            args.seed = argv[i + 1] ?? "";
            i++;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    if (!args.out) throw new Error("--out requires a value");
    if (!args.query) throw new Error("--query requires a value");
    if (!Number.isFinite(args.maxResults) || args.maxResults < 1 || args.maxResults > 50) {
        throw new Error("--max-results must be between 1 and 50");
    }
    if (!Number.isFinite(args.lookbackHours) || args.lookbackHours < 1) {
        throw new Error("--lookback-hours must be a positive number");
    }
    if (!Number.isFinite(args.minDurationSeconds) || args.minDurationSeconds < 0) {
        throw new Error("--min-duration-seconds must be zero or positive");
    }

    return args;
}

async function readSeed(path: string): Promise<SeedFeed> {
    try {
        const text = await readFile(path, "utf8");
        return JSON.parse(text) as SeedFeed;
    } catch {
        return {};
    }
}

function isoHoursAgo(hours: number): string {
    return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

async function searchLatestVideoIds(args: CliArgs, apiKey: string): Promise<string[]> {
    const base = new URL("https://www.googleapis.com/youtube/v3/search");
    base.searchParams.set("part", "snippet");
    base.searchParams.set("type", "video");
    base.searchParams.set("order", "date");
    base.searchParams.set("q", args.query);
    base.searchParams.set("publishedAfter", isoHoursAgo(args.lookbackHours));
    base.searchParams.set("maxResults", String(Math.min(50, Math.max(args.maxResults, 10))));
    base.searchParams.set("regionCode", args.region);
    base.searchParams.set("key", apiKey);
    if (args.language) base.searchParams.set("relevanceLanguage", args.language);

    const ids: string[] = [];

    async function runSearch(channelId?: string): Promise<void> {
        const url = new URL(base.toString());
        if (channelId) url.searchParams.set("channelId", channelId);

        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`YouTube search API error (${response.status}): ${await response.text()}`);
        }
        const data = (await response.json()) as { items?: SearchItem[] };
        for (const item of data.items ?? []) {
            const id = item.id?.videoId;
            if (!id) continue;
            if (item.snippet?.liveBroadcastContent === "none") {
                // keep normal videos and scheduled streams both; explicit no-op branch for readability
            }
            ids.push(id);
        }
    }

    if (args.channelIds.length > 0) {
        for (const channelId of args.channelIds) await runSearch(channelId);
    } else {
        await runSearch();
    }

    return [...new Set(ids)].slice(0, args.maxResults);
}

async function loadExistingVideoIds(): Promise<Set<string>> {
    const known = new Set<string>();
    const files: string[] = ["public/default.wid"];
    try {
        const repoEntries = await readdir("static/cdn/repo");
        for (const entry of repoEntries) {
            if (entry.endsWith(".wid")) files.push(`static/cdn/repo/${entry}`);
        }
    } catch {
        // ignore if folder does not exist
    }

    for (const file of files) {
        try {
            const text = await readFile(file, "utf8");
            const matches = text.matchAll(/videoId:\s*"([^"]+)"/g);
            for (const match of matches) {
                const id = match[1];
                if (id) known.add(id);
            }
        } catch {
            // ignore unreadable files
        }
    }
    return known;
}

async function fetchVideoSnippets(videoIds: string[], apiKey: string): Promise<VideoItem[]> {
    if (videoIds.length === 0) return [];
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", videoIds.join(","));
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok)
        throw new Error(`YouTube videos API error (${response.status}): ${await response.text()}`);

    const data = (await response.json()) as { items?: VideoItem[] };
    return data.items ?? [];
}

function parseIsoDurationSeconds(value: string | undefined): number {
    if (!value) return 0;
    const match = value.match(/^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!match) return 0;
    const h = Number(match[1] ?? "0");
    const m = Number(match[2] ?? "0");
    const s = Number(match[3] ?? "0");
    return h * 3600 + m * 60 + s;
}

function isLikelyLiveTitle(title: string): boolean {
    const lower = title.toLowerCase();
    return lower.includes(" live") || lower.startsWith("live ") || lower.includes("🔴live");
}

function hasBlockedTerm(text: string, blockedTerms: string[]): boolean {
    const lower = text.toLowerCase();
    return blockedTerms.some(term => lower.includes(term.toLowerCase()));
}

function buildFeed(seed: SeedFeed, videos: VideoItem[], args: CliArgs): Record<string, unknown> {
    const tracks = videos
        .filter(v => !!v.id)
        .filter(v => {
            const durationSeconds = parseIsoDurationSeconds(v.contentDetails?.duration);
            if (durationSeconds >= args.minDurationSeconds) return true;
            const title = v.snippet?.title ?? "";
            return durationSeconds === 0 && isLikelyLiveTitle(title);
        })
        .filter(v => {
            const title = v.snippet?.title ?? "";
            const channel = v.snippet?.channelTitle ?? "";
            return !hasBlockedTerm(`${title}\n${channel}`, args.blockedTerms);
        })
        .sort((a, b) => {
            const ta = new Date(a.snippet?.publishedAt ?? 0).getTime();
            const tb = new Date(b.snippet?.publishedAt ?? 0).getTime();
            return tb - ta;
        })
        .slice(0, args.maxResults)
        .map((video, index) => {
            const mood = MOOD_ORDER[index % MOOD_ORDER.length];
            const title = video.snippet?.title ?? `YouTube · ${video.id}`;
            return {
                mood,
                videoId: video.id,
                name: title,
                artist: video.snippet?.channelTitle ?? "YouTube",
            };
        });

    if (tracks.length === 0) {
        throw new Error("No videos found for current query/channel filters and recency window");
    }

    return {
        generatedAt: new Date().toISOString(),
        mode: seed.mode ?? "dock",
        descriptionName: seed.descriptionName ?? "Waldiez Repo - Latest (YouTube News Search)",
        descriptionPurpose:
            seed.descriptionPurpose ??
            "Auto-generated latest preset from YouTube News Search API (query + recency + channel filters).",
        tags: seed.tags ?? ["waldiez", "player", "latest", "news", "auto-generated", "youtube"],
        lifecycleNote:
            seed.lifecycleNote ??
            `Generated from YouTube query='${args.query}', lookbackHours=${args.lookbackHours}, region=${args.region}.`,
        eq: seed.eq ?? { bass: 1, mid: 1, treble: 1 },
        fx: seed.fx ?? { reverb: false, echo: false, fuzz: false, vinyl: false },
        validation: seed.validation ?? {
            maxAgeHours: Math.max(args.lookbackHours, 24),
            minKeywordHits: 1,
            trustedChannels: [],
            requireTrustedChannel: false,
            llmMinScore: 70,
        },
        moodCustomizations: seed.moodCustomizations ?? {},
        tracks,
        sourceFilters: {
            minDurationSeconds: args.minDurationSeconds,
            blockedTerms: args.blockedTerms,
            channelIds: args.channelIds,
        },
    };
}

async function main() {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY is required");

    const args = parseArgs(process.argv.slice(2));
    const seed = await readSeed(args.seed);
    const existingIds = await loadExistingVideoIds();
    const discoveredIds = await searchLatestVideoIds(args, apiKey);
    let videoIds = discoveredIds.filter(id => !existingIds.has(id)).slice(0, args.maxResults * 2);
    let reusedKnownIds = false;
    if (videoIds.length === 0) {
        videoIds = discoveredIds.slice(0, args.maxResults * 2);
        reusedKnownIds = true;
    }

    let videos = await fetchVideoSnippets(videoIds, apiKey);
    // eslint-disable-next-line no-useless-assignment
    let feed: Record<string, unknown> | null = null;
    try {
        feed = buildFeed(seed, videos, args);
    } catch {
        const widened: CliArgs = {
            ...args,
            lookbackHours: args.lookbackHours * 3,
            maxResults: Math.min(50, args.maxResults * 2),
        };
        const retryIds = await searchLatestVideoIds(widened, apiKey);
        const retryFiltered = retryIds.filter(id => !existingIds.has(id)).slice(0, widened.maxResults);
        const finalIds = retryFiltered.length > 0 ? retryFiltered : retryIds.slice(0, widened.maxResults);
        videos = await fetchVideoSnippets(finalIds, apiKey);
        feed = buildFeed(seed, videos, widened);
        reusedKnownIds = reusedKnownIds || retryFiltered.length === 0;
    }

    await writeFile(args.out, `${JSON.stringify(feed, null, 4)}\n`, "utf8");
    const excluded = Math.max(discoveredIds.length - videoIds.length, 0);
    console.log(`Generated ${args.out} with ${videos.length} videos (excluded ${excluded} known IDs)`);
    if (reusedKnownIds) {
        console.log("Note: reused known IDs due to low fresh-candidate volume.");
    }
}

main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`build-latest-news-feed failed: ${message}`);
    process.exit(1);
});
