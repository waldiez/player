import { writeFile } from "node:fs/promises";

type Mood = "journey" | "dock" | "storm" | "fest" | "rock" | "pop" | "disco";

type YtCandidate = {
    videoId: string;
    title: string;
    channelTitle: string;
    description: string;
};

type Track = {
    type: "youtube";
    ytType: "video";
    videoId: string;
    name: string;
    artist: string;
    chapter: null;
};

type WidSpec = {
    file: string;
    slug: string;
    name: string;
    purpose: string;
    tags: string[];
    mode: Mood;
    volume: number;
    shuffle: boolean;
    eq: { bass: number; mid: number; treble: number };
    moodCustomizations?: Record<string, { label?: string; accent?: string; bg?: string }>;
    tracksByMood: Partial<Record<Mood, Track[]>>;
};

type SearchPlan = {
    query: string;
    mood: Mood;
    limit: number;
    keywords: string[];
    blocked: string[];
};

const SEARCH_API = "https://www.googleapis.com/youtube/v3/search";

function nowIso(): string {
    return new Date().toISOString();
}

function stamp(date: Date): string {
    const p = (n: number, len = 2) => n.toString().padStart(len, "0");
    const ms = p(date.getUTCMilliseconds(), 3);
    return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}.${ms}Z`;
}

function yamlQuote(value: string): string {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function countHits(text: string, words: string[]): number {
    const lower = text.toLowerCase();
    let hits = 0;
    for (const word of words) {
        if (lower.includes(word.toLowerCase())) hits++;
    }
    return hits;
}

function scoreCandidate(candidate: YtCandidate, keywords: string[], blocked: string[]): number {
    const text = `${candidate.title}\n${candidate.description}\n${candidate.channelTitle}`;
    const k = countHits(text, keywords);
    const b = countHits(text, blocked);
    return k * 10 - b * 25;
}

async function searchYouTube(query: string, maxResults: number, apiKey: string): Promise<YtCandidate[]> {
    const url = new URL(SEARCH_API);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", String(Math.min(50, Math.max(maxResults, 1))));
    url.searchParams.set("q", query);
    url.searchParams.set("order", "relevance");
    url.searchParams.set("regionCode", process.env.LATEST_WID_REGION ?? "US");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error(`YouTube search failed (${response.status}): ${await response.text()}`);

    const data = (await response.json()) as {
        items?: Array<{
            id?: { videoId?: string };
            snippet?: {
                title?: string;
                channelTitle?: string;
                description?: string;
            };
        }>;
    };

    const out: YtCandidate[] = [];
    for (const item of data.items ?? []) {
        const id = item.id?.videoId;
        if (!id) continue;
        out.push({
            videoId: id,
            title: item.snippet?.title ?? `YouTube · ${id}`,
            channelTitle: item.snippet?.channelTitle ?? "YouTube",
            description: item.snippet?.description ?? "",
        });
    }
    return out;
}

function pickRelevant(
    candidates: YtCandidate[],
    usedIds: Set<string>,
    keywords: string[],
    blocked: string[],
    limit: number,
): Track[] {
    const scored = candidates
        .map(candidate => ({
            candidate,
            score: scoreCandidate(candidate, keywords, blocked),
        }))
        .filter(row => row.score > 0)
        .sort((a, b) => b.score - a.score);

    const tracks: Track[] = [];
    for (const row of scored) {
        if (tracks.length >= limit) break;
        if (usedIds.has(row.candidate.videoId)) continue;
        usedIds.add(row.candidate.videoId);
        tracks.push({
            type: "youtube",
            ytType: "video",
            videoId: row.candidate.videoId,
            name: row.candidate.title,
            artist: row.candidate.channelTitle,
            chapter: null,
        });
    }
    return tracks;
}

function renderWid(spec: WidSpec): string {
    const created = new Date();
    const createdIso = created.toISOString();
    const idStamp = stamp(created);

    const lines: string[] = [];
    lines.push('$schema: "https://xperiens.waldiez.io/schema/v1/manifest"', "");
    lines.push("identity:");
    lines.push(`  wid: ${yamlQuote(`wdz://waldiez/player/repo/${spec.slug}/${idStamp}-${spec.slug}`)}`);
    lines.push('  type: "state"');
    lines.push(`  created: ${yamlQuote(createdIso)}`, "");

    lines.push("description:");
    lines.push(`  name: ${yamlQuote(spec.name)}`);
    lines.push(`  purpose: ${yamlQuote(spec.purpose)}`);
    lines.push("  tags:");
    for (const tag of spec.tags) lines.push(`    - ${yamlQuote(tag)}`);
    lines.push("");

    lines.push("interface:");
    lines.push("  capabilities:");
    lines.push('    - "waldiez.player.state.preferences.v1"');
    lines.push("  capability_ids:");
    lines.push(
        `    "waldiez.player.state.preferences.v1": ${yamlQuote(`wdz://waldiez/player/capability/${idStamp}-${spec.slug}`)}`,
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
    lines.push(`  mode: ${yamlQuote(spec.mode)}`);
    lines.push(`  volume: ${spec.volume}`);
    lines.push("  muted: false");
    lines.push("  loop: false");
    lines.push(`  shuffle: ${spec.shuffle}`);
    lines.push("  eq:");
    lines.push(`    bass: ${spec.eq.bass}`);
    lines.push(`    mid: ${spec.eq.mid}`);
    lines.push(`    treble: ${spec.eq.treble}`);
    lines.push("  fx:");
    lines.push("    reverb: false");
    lines.push("    echo: false");
    lines.push("    fuzz: false");
    lines.push("    vinyl: false");
    lines.push("  modes: {}");
    lines.push("  modeDefaults:");

    const moods: Mood[] = ["journey", "dock", "storm", "fest", "rock", "pop", "disco"];
    for (const mood of moods) {
        const tracks = spec.tracksByMood[mood] ?? [];
        if (tracks.length === 0) continue;
        lines.push(`    ${mood}:`);
        for (const track of tracks) {
            lines.push('      - type: "youtube"');
            lines.push('        ytType: "video"');
            lines.push(`        videoId: ${yamlQuote(track.videoId)}`);
            lines.push(`        name: ${yamlQuote(track.name)}`);
            lines.push(`        artist: ${yamlQuote(track.artist)}`);
            lines.push("        chapter: null");
        }
    }

    lines.push("  moodCustomizations:");
    if (!spec.moodCustomizations || Object.keys(spec.moodCustomizations).length === 0) {
        lines.push("    {}");
    } else {
        for (const [mood, custom] of Object.entries(spec.moodCustomizations)) {
            lines.push(`    ${mood}:`);
            if (custom.label) lines.push(`      label: ${yamlQuote(custom.label)}`);
            if (custom.accent) lines.push(`      accent: ${yamlQuote(custom.accent)}`);
            if (custom.bg) lines.push(`      bg: ${yamlQuote(custom.bg)}`);
        }
    }
    lines.push("  syncDefaultsFromLatest: false", "");

    lines.push("execution:");
    lines.push('  runtime: "wdz://runtimes/browser"');
    lines.push('  protocol: "wdz://protocols/local-storage-v1"', "");

    lines.push("lifecycle:");
    lines.push(`  exported_at: ${yamlQuote(nowIso())}`);
    lines.push(
        `  note: ${yamlQuote("Generated by scripts/refresh-contrib-wids.ts using relevance scoring.")}`,
    );

    return `${lines.join("\n")}\n`;
}

async function main() {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY is required");

    const usedIds = new Set<string>();

    const traditionalPlans: SearchPlan[] = [
        {
            query: "traditional irish folk session music",
            mood: "journey",
            limit: 2,
            keywords: ["traditional", "irish", "folk", "session", "acoustic", "instrumental"],
            blocked: ["remix", "nightcore", "trap", "phonk", "sped up", "slowed"],
        },
        {
            query: "cuban son tradicional music",
            mood: "journey",
            limit: 1,
            keywords: ["cuban", "son", "traditional", "latin", "acoustic"],
            blocked: ["remix", "trap", "club mix", "edm"],
        },
        {
            query: "african traditional drums music",
            mood: "journey",
            limit: 1,
            keywords: ["african", "traditional", "drums", "folk", "tribal"],
            blocked: ["remix", "trap", "phonk"],
        },
        {
            query: "asian traditional instrumental music",
            mood: "journey",
            limit: 2,
            keywords: ["asian", "traditional", "instrumental", "strings", "folk"],
            blocked: ["remix", "nightcore", "trap", "phonk"],
        },
        {
            query: "traditional greek music",
            mood: "journey",
            limit: 2,
            keywords: ["traditional", "greek", "folk", "acoustic", "instrumental", "lute", "violin"],
            blocked: ["remix", "nightcore", "trap", "phonk", "sped up", "slowed"],
        },
    ];

    const dnbPlans: SearchPlan[] = [
        {
            query: "drum and bass mix",
            mood: "storm",
            limit: 2,
            keywords: ["drum and bass", "dnb", "bass", "mix", "jungle", "liquid"],
            blocked: ["news", "highlights", "points table", "tutorial", "reaction"],
        },
        {
            query: "liquid drum and bass set",
            mood: "storm",
            limit: 1,
            keywords: ["liquid", "drum and bass", "dnb", "set"],
            blocked: ["news", "tutorial", "reaction", "points table"],
        },
        {
            query: "jungle dnb mix",
            mood: "storm",
            limit: 1,
            keywords: ["jungle", "dnb", "drum and bass", "amen"],
            blocked: ["news", "highlights", "points table", "tutorial"],
        },
    ];

    const newsPlans: SearchPlan[] = [
        {
            query: "morning world headlines",
            mood: "journey",
            limit: 1,
            keywords: ["news", "headlines", "morning", "world", "report"],
            blocked: ["lyrics", "music video", "remix", "points table"],
        },
        {
            query: "global news analysis",
            mood: "dock",
            limit: 1,
            keywords: ["news", "analysis", "report", "world", "politics"],
            blocked: ["lyrics", "music video", "remix", "points table"],
        },
        {
            query: "breaking news live update",
            mood: "storm",
            limit: 1,
            keywords: ["breaking", "news", "live", "update", "report"],
            blocked: ["lyrics", "music video", "remix", "points table"],
        },
        {
            query: "positive news roundup",
            mood: "fest",
            limit: 1,
            keywords: ["news", "roundup", "good", "positive", "update"],
            blocked: ["lyrics", "music video", "remix", "points table"],
        },
    ];

    async function collect(plans: SearchPlan[]): Promise<Partial<Record<Mood, Track[]>>> {
        const out: Partial<Record<Mood, Track[]>> = {};
        if (!apiKey) {
            return out;
        }
        try {
            for (const plan of plans) {
                const candidates = await searchYouTube(plan.query, 20, apiKey);
                const picks = pickRelevant(candidates, usedIds, plan.keywords, plan.blocked, plan.limit);
                if (picks.length < plan.limit) {
                    throw new Error(
                        `Insufficient relevant results for query '${plan.query}' (needed ${plan.limit}, got ${picks.length})`,
                    );
                }
                out[plan.mood] = [...(out[plan.mood] ?? []), ...picks];
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e) {
            //
        }
        return out;
    }

    const traditionalTracks = await collect(traditionalPlans);
    const dnbTracks = await collect(dnbPlans);
    const newsTracks = await collect(newsPlans);

    const traditional: WidSpec = {
        file: "static/cdn/repo/traditional-ethnic.wid",
        slug: "traditional-ethnic",
        name: "Waldiez Repo - Traditional & Ethnic",
        purpose: "Traditional/folk-focused preset across Irish, Cuban, African, and Asian influences.",
        tags: ["waldiez", "player", "traditional", "ethnic", "irish", "cuban", "african", "asian"],
        mode: "journey",
        volume: 0.8,
        shuffle: false,
        eq: { bass: 1, mid: 1, treble: 0 },
        tracksByMood: traditionalTracks,
    };

    const dnb: WidSpec = {
        file: "static/cdn/repo/dnb.wid",
        slug: "dnb",
        name: "Waldiez Repo - Drum-n-Base",
        purpose: "High-energy drum and bass preset curated by DnB relevance scoring.",
        tags: ["waldiez", "player", "drum-and-bass", "dnb", "jungle", "liquid"],
        mode: "storm",
        volume: 0.84,
        shuffle: true,
        eq: { bass: 3, mid: 1, treble: 2 },
        tracksByMood: dnbTracks,
    };

    const news: WidSpec = {
        file: "static/cdn/repo/news-moods.wid",
        slug: "news-moods",
        name: "Waldiez Repo - News Moods",
        purpose: "News-oriented preset with mood-specific thematic slots.",
        tags: ["waldiez", "player", "news", "moods", "themes"],
        mode: "journey",
        volume: 0.72,
        shuffle: false,
        eq: { bass: 0, mid: 1, treble: 1 },
        tracksByMood: newsTracks,
        moodCustomizations: {
            journey: { label: "Headlines", accent: "#2f7fd3", bg: "#0f1d2d" },
            dock: { label: "Analysis", accent: "#1f9d73", bg: "#10261f" },
            storm: { label: "Breaking", accent: "#d95050", bg: "#2a1111" },
            fest: { label: "Uplift", accent: "#e7a93a", bg: "#2a2010" },
        },
    };

    await writeFile(traditional.file, renderWid(traditional), "utf8");
    await writeFile(dnb.file, renderWid(dnb), "utf8");
    await writeFile(news.file, renderWid(news), "utf8");

    console.log(`Refreshed contrib wids: ${traditional.file}, ${dnb.file}, ${news.file}`);
}

main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`refresh-contrib-wids failed: ${message}`);
    process.exit(1);
});
