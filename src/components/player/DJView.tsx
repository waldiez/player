/**
 * DJView — two-deck mixer with crossfader.
 *
 * Each deck is fully independent: its own audio element, Web Audio chain,
 * volume, pitch, cue point, and loop state.  The crossfader applies an
 * equal-power blend between the two gains.
 *
 * Source modes per deck:
 *   audio   — local file or Piped stream URL → <audio> + Web Audio chain + analyser
 *   youtube — YouTube IFrame embed (Piped unavailable) → volume via effectiveVolume prop
 */
import { ModeMenuDropdown } from "@/components/player/ModeMenuDropdown";
import { Button, DragHandle, Slider } from "@/components/ui";
import { useDeck } from "@/hooks/useDeck";
import { useSplitDrag } from "@/hooks/useSplitDrag";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type React from "react";

import { Pause, Play, RotateCcw, Settings } from "lucide-react";

import { DeckCanvas } from "./DeckCanvas";
import { YouTubeEmbed } from "./YouTubeEmbed";

// ── helpers ───────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── DeckPanel ─────────────────────────────────────────────────────────────

interface DeckHandle {
    setCrossGain: (gain: number) => void;
}

interface DeckPanelProps {
    side: "A" | "B";
    accent: string;
}

const DeckPanel = forwardRef<DeckHandle, DeckPanelProps>(function DeckPanel({ side, accent }, ref) {
    const audioElRef = useRef<HTMLAudioElement>(null);
    const deck = useDeck(audioElRef);

    useImperativeHandle(ref, () => ({ setCrossGain: deck.setCrossGain }), [deck.setCrossGain]);

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) deck.loadFile(file);
    }

    const hasSource = !!(deck.audioSrc || deck.ytVideoId);

    return (
        <div
            className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
        >
            {/* Audio element — only mounted when in audio mode */}
            {!deck.ytVideoId && (
                <audio
                    ref={audioElRef}
                    src={deck.audioSrc ?? undefined}
                    crossOrigin={deck.isCrossOrigin ? "anonymous" : undefined}
                    onTimeUpdate={deck.onTimeUpdate}
                    onLoadedMetadata={deck.onLoadedMetadata}
                    onEnded={deck.onEnded}
                />
            )}

            {/* Deck label + BPM */}
            <div className="flex shrink-0 items-center justify-between">
                <span className="font-mono text-lg font-black tracking-widest" style={{ color: accent }}>
                    DECK {side}
                </span>
                <div className="text-right">
                    <div className="font-mono text-sm font-semibold text-gray-200">
                        {deck.bpm !== null ? `${deck.bpm} BPM` : "— BPM"}
                    </div>
                    <button
                        onClick={deck.tapBpm}
                        className="text-xs text-gray-600 transition-colors hover:text-gray-300 active:text-white"
                    >
                        TAP
                    </button>
                </div>
            </div>

            {/* Visualizer area — canvas for audio mode, YouTube embed for iframe mode */}
            <div className="relative h-24 shrink-0 overflow-hidden rounded" style={{ background: "#020617" }}>
                {deck.ytVideoId ? (
                    <YouTubeEmbed
                        videoId={deck.ytVideoId}
                        isPlaying={deck.isPlaying}
                        volume={deck.effectiveVolume}
                        isMuted={false}
                        playbackRate={deck.pitch}
                        onStateChange={deck.setPlaying}
                    />
                ) : (
                    <>
                        <DeckCanvas analyser={deck.analyser} isPlaying={deck.isPlaying} accent={accent} />
                        {!deck.audioSrc && (
                            <div className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center text-gray-700">
                                <span className="mb-0.5 text-3xl">♬</span>
                                <span className="text-xs">Drop a file or paste a URL</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Track title */}
            <div className="shrink-0 truncate text-xs font-medium text-gray-400" title={deck.title}>
                {deck.title || "No track loaded"}
            </div>

            {/* Source input */}
            <div className="flex shrink-0 gap-1">
                <input
                    type="text"
                    value={deck.sourceInput}
                    onChange={e => deck.setSourceInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && void deck.loadSource()}
                    placeholder="YouTube or audio URL…"
                    className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200 placeholder:text-gray-600 focus:border-cyan-700 focus:outline-none"
                />
                <button
                    onClick={() => void deck.loadSource()}
                    disabled={deck.isLoading || !deck.sourceInput.trim()}
                    className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-600 disabled:opacity-40"
                >
                    {deck.isLoading ? "…" : "LOAD"}
                </button>
                <label className="cursor-pointer rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-600">
                    FILE
                    <input
                        type="file"
                        accept="audio/*,video/*"
                        className="hidden"
                        onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) deck.loadFile(f);
                            e.target.value = "";
                        }}
                    />
                </label>
            </div>

            {/* Progress + cue marker — disabled in YouTube iframe mode */}
            <div className="shrink-0">
                <Slider
                    value={[deck.currentTime]}
                    min={0}
                    max={deck.duration || 1}
                    step={0.1}
                    disabled={!deck.audioSrc}
                    onValueChange={([v]) => deck.seek(v)}
                    className="w-full"
                />
                <div className="mt-0.5 flex justify-between font-mono text-xs text-gray-600">
                    <span>{fmtTime(deck.currentTime)}</span>
                    {deck.cuePoint !== null && (
                        <span style={{ color: accent }}>▾ {fmtTime(deck.cuePoint)}</span>
                    )}
                    <span>{fmtTime(deck.duration)}</span>
                </div>
            </div>

            {/* Transport controls */}
            <div className="flex shrink-0 items-center justify-center gap-2">
                <button
                    onClick={deck.jumpToCue}
                    disabled={!deck.audioSrc || deck.cuePoint === null}
                    className="rounded border border-amber-800 px-2 py-1.5 font-mono text-xs font-bold text-amber-400 transition-colors hover:bg-amber-900/40 disabled:opacity-30"
                >
                    ▶ CUE
                </button>

                <button
                    onClick={deck.togglePlay}
                    disabled={!hasSource}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-all disabled:opacity-40 hover:brightness-110"
                    style={{ background: deck.isPlaying ? accent : "#374151" }}
                >
                    {deck.isPlaying ? (
                        <Pause className="h-4 w-4 text-white" />
                    ) : (
                        <Play className="h-4 w-4 text-white" fill="white" />
                    )}
                </button>

                <button
                    onClick={deck.setCue}
                    disabled={!deck.audioSrc}
                    className="rounded border border-amber-800 px-2 py-1.5 font-mono text-xs font-bold text-amber-400 transition-colors hover:bg-amber-900/40 disabled:opacity-30"
                >
                    SET CUE
                </button>

                <button
                    onClick={deck.toggleLoop}
                    disabled={!deck.audioSrc}
                    className={cn(
                        "rounded px-2 py-1.5 font-mono text-xs font-bold transition-colors disabled:opacity-30",
                        deck.loopEnabled
                            ? "border"
                            : "border border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300",
                    )}
                    style={deck.loopEnabled ? { color: accent, borderColor: accent } : {}}
                >
                    ⟳
                </button>
            </div>

            {/* Volume */}
            <div className="flex shrink-0 items-center gap-2">
                <span className="w-8 text-right font-mono text-xs text-gray-600">VOL</span>
                <Slider
                    value={[Math.round(deck.volume * 100)]}
                    min={0}
                    max={100}
                    onValueChange={([v]) => deck.setVolume(v / 100)}
                    className="flex-1"
                />
                <span className="w-7 font-mono text-xs text-gray-500">{Math.round(deck.volume * 100)}%</span>
            </div>

            {/* Pitch / playback rate: 0.5× – 2.0× mapped to 0–100 */}
            <div className="flex shrink-0 items-center gap-2">
                <span className="w-8 text-right font-mono text-xs text-gray-600">⬆</span>
                <Slider
                    value={[Math.round(((deck.pitch - 0.5) / 1.5) * 100)]}
                    min={0}
                    max={100}
                    onValueChange={([v]) => deck.setPitch(0.5 + (v / 100) * 1.5)}
                    className="flex-1"
                />
                <span className="w-10 text-right font-mono text-xs text-gray-400">
                    {deck.pitch.toFixed(2)}×
                </span>
                <button
                    onClick={() => deck.setPitch(1.0)}
                    title="Reset pitch to 1×"
                    className="text-gray-700 transition-colors hover:text-gray-400"
                >
                    <RotateCcw className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
});

// ── DJView ────────────────────────────────────────────────────────────────

interface DJViewProps {
    onSettingsOpen: () => void;
}

export function DJView({ onSettingsOpen }: DJViewProps) {
    const playerMode = usePlayerStore(s => s.playerMode);
    const playerModeConfig = usePlayerStore(s => s.playerModeConfig);
    const setPlayerMode = usePlayerStore(s => s.setPlayerMode);

    const deckARef = useRef<DeckHandle>(null);
    const deckBRef = useRef<DeckHandle>(null);

    const [crossfader, setCrossfader] = useState(0.5);
    const [showModeMenu, setShowModeMenu] = useState(false);
    const split = useSplitDrag({ initial: 500, min: 200, max: 1600 });

    // Equal-power crossfade: A = cos(x·π/2), B = sin(x·π/2)
    // Both are at -3 dB (0.707) at center, giving constant perceived loudness.
    useEffect(() => {
        const aGain = Math.cos((crossfader * Math.PI) / 2);
        const bGain = Math.sin((crossfader * Math.PI) / 2);
        deckARef.current?.setCrossGain(aGain);
        deckBRef.current?.setCrossGain(bGain);
    }, [crossfader]);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-200">
            {/* ── Header ──────────────────────────────────────────────── */}
            <header className="flex h-10 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900/60 px-4">
                <span className="font-mono text-xs font-bold tracking-[0.2em] text-cyan-500">◈ MIXER</span>
                <div className="flex items-center gap-2">
                    <ModeMenuDropdown
                        playerMode={playerMode}
                        playerModeConfig={playerModeConfig}
                        showModeMenu={showModeMenu}
                        onToggle={() => setShowModeMenu(m => !m)}
                        onClose={() => setShowModeMenu(false)}
                        onModeSelect={setPlayerMode}
                    />
                    <Button variant="ghost" size="icon" onClick={onSettingsOpen}>
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            {/* ── Decks ───────────────────────────────────────────────── */}
            <div className="flex min-h-0 flex-1">
                <div className="min-w-0 overflow-hidden" style={{ width: split.px }}>
                    <DeckPanel ref={deckARef} side="A" accent="#06b6d4" />
                </div>
                <DragHandle
                    direction="horizontal"
                    onPointerDown={split.onPointerDown}
                    onPointerMove={split.onPointerMove}
                    onPointerUp={split.onPointerUp}
                    className="border-x border-gray-800"
                />
                <div className="min-w-0 flex-1 overflow-hidden">
                    <DeckPanel ref={deckBRef} side="B" accent="#a855f7" />
                </div>
            </div>

            {/* ── Crossfader ──────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-3 border-t border-gray-800 bg-gray-900/40 px-6 py-3">
                <span className="w-10 text-right font-mono text-sm font-black text-cyan-400">A</span>
                <div className="flex flex-1 flex-col items-center gap-1">
                    <Slider
                        value={[Math.round(crossfader * 100)]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([v]) => setCrossfader(v / 100)}
                        className="w-full"
                    />
                    <span className="font-mono text-xs tracking-widest text-gray-700">CROSSFADER</span>
                </div>
                <span className="w-10 font-mono text-sm font-black text-purple-400">B</span>
            </div>
        </div>
    );
}
