import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { usePlayerStore } from "./playerStore";

// Reset store state before each test so tests are independent
beforeEach(() => {
    usePlayerStore.setState({
        playerMode: "standard",
        currentMedia: null,
        mediaLibrary: [],
        playback: {
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            volume: 1,
            isMuted: false,
            playbackRate: 1,
            isLooping: false,
            isFullscreen: false,
        },
        currentPage: 1,
        totalPages: 1,
        chapters: [],
        bookmarks: [],
        effects: [],
        sleepTimerMinutes: null,
        sleepTimerEndTime: null,
        abLoop: { a: null, b: null },
        repeatMode: "none",
        showEffectsPanel: false,
        showChaptersPanel: false,
        showAudioVisualizer: true,
        showModeSelector: false,
        showPlaylistPanel: false,
    });
});

afterEach(() => {
    usePlayerStore.setState({
        playerMode: "standard",
        currentMedia: null,
        mediaLibrary: [],
    });
});

// ── helpers ─────────────────────────────────────────────────────────────────

function makeMedia(id: string, name = `Track ${id}`) {
    return {
        id,
        name,
        path: `/media/${id}.mp4`,
        type: "video" as const,
        duration: 120,
        size: 0,
        createdAt: new Date(),
    };
}

// ── Playback controls ────────────────────────────────────────────────────────

describe("playback controls", () => {
    it("play sets isPlaying to true", () => {
        const { play } = usePlayerStore.getState();
        play();
        expect(usePlayerStore.getState().playback.isPlaying).toBe(true);
    });

    it("pause sets isPlaying to false", () => {
        usePlayerStore.getState().play();
        usePlayerStore.getState().pause();
        expect(usePlayerStore.getState().playback.isPlaying).toBe(false);
    });

    it("togglePlay flips isPlaying", () => {
        const { togglePlay } = usePlayerStore.getState();
        expect(usePlayerStore.getState().playback.isPlaying).toBe(false);
        togglePlay();
        expect(usePlayerStore.getState().playback.isPlaying).toBe(true);
        togglePlay();
        expect(usePlayerStore.getState().playback.isPlaying).toBe(false);
    });

    it("seek updates currentTime", () => {
        usePlayerStore.getState().seek(42);
        expect(usePlayerStore.getState().playback.currentTime).toBe(42);
    });

    it("setVolume updates volume and unmutes when > 0", () => {
        usePlayerStore.setState({ playback: { ...usePlayerStore.getState().playback, isMuted: true } });
        usePlayerStore.getState().setVolume(0.5);
        const { volume, isMuted } = usePlayerStore.getState().playback;
        expect(volume).toBe(0.5);
        expect(isMuted).toBe(false);
    });

    it("setVolume to 0 mutes", () => {
        usePlayerStore.getState().setVolume(0);
        expect(usePlayerStore.getState().playback.isMuted).toBe(true);
    });

    it("toggleMute flips isMuted", () => {
        usePlayerStore.getState().toggleMute();
        expect(usePlayerStore.getState().playback.isMuted).toBe(true);
        usePlayerStore.getState().toggleMute();
        expect(usePlayerStore.getState().playback.isMuted).toBe(false);
    });

    it("setPlaybackRate updates rate", () => {
        usePlayerStore.getState().setPlaybackRate(1.5);
        expect(usePlayerStore.getState().playback.playbackRate).toBe(1.5);
    });

    it("toggleLoop flips isLooping", () => {
        usePlayerStore.getState().toggleLoop();
        expect(usePlayerStore.getState().playback.isLooping).toBe(true);
        usePlayerStore.getState().toggleLoop();
        expect(usePlayerStore.getState().playback.isLooping).toBe(false);
    });

    it("toggleFullscreen flips isFullscreen", () => {
        usePlayerStore.getState().toggleFullscreen();
        expect(usePlayerStore.getState().playback.isFullscreen).toBe(true);
    });
});

// ── Media library ─────────────────────────────────────────────────────────────

describe("media library", () => {
    it("addToLibrary appends item", () => {
        usePlayerStore.getState().addToLibrary(makeMedia("a"));
        expect(usePlayerStore.getState().mediaLibrary).toHaveLength(1);
        expect(usePlayerStore.getState().mediaLibrary[0]?.id).toBe("a");
    });

    it("removeFromLibrary removes item by id", () => {
        usePlayerStore.getState().addToLibrary(makeMedia("a"));
        usePlayerStore.getState().addToLibrary(makeMedia("b"));
        usePlayerStore.getState().removeFromLibrary("a");
        const lib = usePlayerStore.getState().mediaLibrary;
        expect(lib).toHaveLength(1);
        expect(lib[0]?.id).toBe("b");
    });

    it("setMediaLibrary replaces entire library", () => {
        usePlayerStore.getState().addToLibrary(makeMedia("x"));
        usePlayerStore.getState().setMediaLibrary([makeMedia("a"), makeMedia("b")]);
        expect(usePlayerStore.getState().mediaLibrary.map(m => m.id)).toEqual(["a", "b"]);
    });

    it("reorderLibrary moves item from fromIndex to toIndex", () => {
        usePlayerStore.getState().setMediaLibrary([makeMedia("a"), makeMedia("b"), makeMedia("c")]);
        usePlayerStore.getState().reorderLibrary(0, 2);
        expect(usePlayerStore.getState().mediaLibrary.map(m => m.id)).toEqual(["b", "c", "a"]);
    });

    it("setCurrentMedia resets playback time", () => {
        usePlayerStore.setState({ playback: { ...usePlayerStore.getState().playback, currentTime: 30 } });
        usePlayerStore.getState().setCurrentMedia(makeMedia("a"));
        expect(usePlayerStore.getState().playback.currentTime).toBe(0);
        expect(usePlayerStore.getState().currentMedia?.id).toBe("a");
    });
});

// ── Playlist navigation ───────────────────────────────────────────────────────

describe("playlist navigation", () => {
    beforeEach(() => {
        usePlayerStore.getState().setMediaLibrary([makeMedia("1"), makeMedia("2"), makeMedia("3")]);
        usePlayerStore.getState().setCurrentMedia(usePlayerStore.getState().mediaLibrary[0]!);
    });

    it("playNextInLibrary advances to next track", () => {
        usePlayerStore.getState().playNextInLibrary();
        expect(usePlayerStore.getState().currentMedia?.id).toBe("2");
        expect(usePlayerStore.getState().playback.isPlaying).toBe(true);
    });

    it("playNextInLibrary at end of list pauses (repeatMode=none)", () => {
        usePlayerStore.getState().setCurrentMedia(usePlayerStore.getState().mediaLibrary[2]!);
        usePlayerStore.getState().playNextInLibrary();
        // Goes back to first track but paused
        expect(usePlayerStore.getState().currentMedia?.id).toBe("1");
        expect(usePlayerStore.getState().playback.isPlaying).toBe(false);
    });

    it("playNextInLibrary wraps to first when repeatMode=all", () => {
        usePlayerStore.setState({ repeatMode: "all" });
        usePlayerStore.getState().setCurrentMedia(usePlayerStore.getState().mediaLibrary[2]!);
        usePlayerStore.getState().playNextInLibrary();
        expect(usePlayerStore.getState().currentMedia?.id).toBe("1");
        expect(usePlayerStore.getState().playback.isPlaying).toBe(true);
    });

    it("playPrevInLibrary goes to previous track", () => {
        usePlayerStore.getState().setCurrentMedia(usePlayerStore.getState().mediaLibrary[1]!);
        usePlayerStore.getState().playPrevInLibrary();
        expect(usePlayerStore.getState().currentMedia?.id).toBe("1");
    });

    it("playPrevInLibrary restarts track if >3s in", () => {
        // setCurrentMedia resets currentTime to 0, so we must set currentMedia first,
        // then manually advance currentTime past 3s before calling playPrevInLibrary.
        usePlayerStore.getState().setCurrentMedia(usePlayerStore.getState().mediaLibrary[1]!);
        usePlayerStore.setState({ playback: { ...usePlayerStore.getState().playback, currentTime: 10 } });
        usePlayerStore.getState().playPrevInLibrary();
        expect(usePlayerStore.getState().currentMedia?.id).toBe("2"); // stays on same track
        expect(usePlayerStore.getState().playback.currentTime).toBe(0);
    });
});

// ── Repeat mode ───────────────────────────────────────────────────────────────

describe("repeat mode", () => {
    it("cycleRepeatMode cycles none → all → one → none", () => {
        const { cycleRepeatMode } = usePlayerStore.getState();
        expect(usePlayerStore.getState().repeatMode).toBe("none");
        cycleRepeatMode();
        expect(usePlayerStore.getState().repeatMode).toBe("all");
        cycleRepeatMode();
        expect(usePlayerStore.getState().repeatMode).toBe("one");
        cycleRepeatMode();
        expect(usePlayerStore.getState().repeatMode).toBe("none");
    });
});

// ── Page navigation ───────────────────────────────────────────────────────────

describe("page navigation", () => {
    beforeEach(() => {
        usePlayerStore.getState().setTotalPages(5);
        usePlayerStore.getState().setCurrentPage(1);
    });

    it("nextPage increments currentPage", () => {
        usePlayerStore.getState().nextPage();
        expect(usePlayerStore.getState().currentPage).toBe(2);
    });

    it("nextPage stops at totalPages", () => {
        usePlayerStore.getState().setCurrentPage(5);
        usePlayerStore.getState().nextPage();
        expect(usePlayerStore.getState().currentPage).toBe(5);
    });

    it("prevPage decrements currentPage", () => {
        usePlayerStore.getState().setCurrentPage(3);
        usePlayerStore.getState().prevPage();
        expect(usePlayerStore.getState().currentPage).toBe(2);
    });

    it("prevPage stops at 1", () => {
        usePlayerStore.getState().prevPage();
        expect(usePlayerStore.getState().currentPage).toBe(1);
    });

    it("setCurrentPage clamps to [1, totalPages]", () => {
        usePlayerStore.getState().setCurrentPage(0);
        expect(usePlayerStore.getState().currentPage).toBe(1);
        usePlayerStore.getState().setCurrentPage(99);
        expect(usePlayerStore.getState().currentPage).toBe(5);
    });
});

// ── Effects ───────────────────────────────────────────────────────────────────

describe("effects", () => {
    const makeEffect = (id: string) => ({
        id,
        type: "brightness" as const,
        enabled: true,
        parameters: { value: 1.2 },
    });

    it("addEffect appends effect", () => {
        usePlayerStore.getState().addEffect(makeEffect("e1"));
        expect(usePlayerStore.getState().effects).toHaveLength(1);
    });

    it("removeEffect removes by id", () => {
        usePlayerStore.getState().addEffect(makeEffect("e1"));
        usePlayerStore.getState().addEffect(makeEffect("e2"));
        usePlayerStore.getState().removeEffect("e1");
        expect(usePlayerStore.getState().effects.map(e => e.id)).toEqual(["e2"]);
    });

    it("toggleEffect flips enabled", () => {
        usePlayerStore.getState().addEffect(makeEffect("e1"));
        usePlayerStore.getState().toggleEffect("e1");
        expect(usePlayerStore.getState().effects[0]?.enabled).toBe(false);
        usePlayerStore.getState().toggleEffect("e1");
        expect(usePlayerStore.getState().effects[0]?.enabled).toBe(true);
    });

    it("updateEffect patches parameters", () => {
        usePlayerStore.getState().addEffect(makeEffect("e1"));
        usePlayerStore.getState().updateEffect("e1", { parameters: { value: 0.5 } });
        expect(usePlayerStore.getState().effects[0]?.parameters.value).toBe(0.5);
    });

    it("reorderEffects moves effect from fromIndex to toIndex", () => {
        usePlayerStore.getState().addEffect(makeEffect("e1"));
        usePlayerStore.getState().addEffect(makeEffect("e2"));
        usePlayerStore.getState().addEffect(makeEffect("e3"));
        usePlayerStore.getState().reorderEffects(0, 2);
        expect(usePlayerStore.getState().effects.map(e => e.id)).toEqual(["e2", "e3", "e1"]);
    });
});

// ── Sleep timer ───────────────────────────────────────────────────────────────

describe("sleep timer", () => {
    it("setSleepTimer stores minutes and a future end time", () => {
        const before = Date.now();
        usePlayerStore.getState().setSleepTimer(30);
        const { sleepTimerMinutes, sleepTimerEndTime } = usePlayerStore.getState();
        expect(sleepTimerMinutes).toBe(30);
        expect(sleepTimerEndTime).toBeGreaterThanOrEqual(before + 30 * 60 * 1000);
    });

    it("setSleepTimer(null) clears timer", () => {
        usePlayerStore.getState().setSleepTimer(10);
        usePlayerStore.getState().setSleepTimer(null);
        expect(usePlayerStore.getState().sleepTimerMinutes).toBeNull();
        expect(usePlayerStore.getState().sleepTimerEndTime).toBeNull();
    });

    it("clearSleepTimer resets to null", () => {
        usePlayerStore.getState().setSleepTimer(10);
        usePlayerStore.getState().clearSleepTimer();
        expect(usePlayerStore.getState().sleepTimerMinutes).toBeNull();
        expect(usePlayerStore.getState().sleepTimerEndTime).toBeNull();
    });
});

// ── A-B loop ──────────────────────────────────────────────────────────────────

describe("A-B loop", () => {
    it("setLoopPointA captures current time", () => {
        usePlayerStore.setState({ playback: { ...usePlayerStore.getState().playback, currentTime: 5 } });
        usePlayerStore.getState().setLoopPointA();
        expect(usePlayerStore.getState().abLoop.a).toBe(5);
    });

    it("setLoopPointB captures current time", () => {
        usePlayerStore.setState({ playback: { ...usePlayerStore.getState().playback, currentTime: 15 } });
        usePlayerStore.getState().setLoopPointB();
        expect(usePlayerStore.getState().abLoop.b).toBe(15);
    });

    it("clearAbLoop resets both points", () => {
        usePlayerStore.setState({ abLoop: { a: 5, b: 15 } });
        usePlayerStore.getState().clearAbLoop();
        expect(usePlayerStore.getState().abLoop).toEqual({ a: null, b: null });
    });
});

// ── Chapters & Bookmarks ──────────────────────────────────────────────────────

describe("chapters & bookmarks", () => {
    const chapter = { id: "c1", title: "Intro", startTime: 0, endTime: 60 };
    const bookmark = { id: "b1", label: "Good part", time: 30 };

    it("addChapter then removeChapter", () => {
        usePlayerStore.getState().addChapter(chapter);
        expect(usePlayerStore.getState().chapters).toHaveLength(1);
        usePlayerStore.getState().removeChapter("c1");
        expect(usePlayerStore.getState().chapters).toHaveLength(0);
    });

    it("addBookmark then removeBookmark", () => {
        usePlayerStore.getState().addBookmark(bookmark);
        expect(usePlayerStore.getState().bookmarks).toHaveLength(1);
        usePlayerStore.getState().removeBookmark("b1");
        expect(usePlayerStore.getState().bookmarks).toHaveLength(0);
    });

    it("goToChapter seeks to chapter.startTime", () => {
        usePlayerStore.getState().addChapter({ ...chapter, startTime: 42 });
        usePlayerStore.getState().goToChapter(0);
        expect(usePlayerStore.getState().playback.currentTime).toBe(42);
    });
});

// ── UI toggle actions ─────────────────────────────────────────────────────────

describe("UI panel toggles", () => {
    it.each([
        ["toggleEffectsPanel", "showEffectsPanel"],
        ["toggleChaptersPanel", "showChaptersPanel"],
        ["toggleAudioVisualizer", "showAudioVisualizer"],
        ["toggleModeSelector", "showModeSelector"],
        ["togglePlaylistPanel", "showPlaylistPanel"],
    ] as const)("%s flips %s", (action, field) => {
        const initial = usePlayerStore.getState()[field];
        (usePlayerStore.getState()[action] as () => void)();
        expect(usePlayerStore.getState()[field]).toBe(!initial);
        (usePlayerStore.getState()[action] as () => void)();
        expect(usePlayerStore.getState()[field]).toBe(initial);
    });
});
